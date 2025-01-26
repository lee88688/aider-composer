from typing import Callable, Dict, Iterator, List, Optional, Literal, Any, cast
from flask import Flask, jsonify, request, Response
from aider.models import Model
from aider.coders import Coder, ArchitectCoder
from aider.io import InputOutput
from dataclasses import dataclass
import re
import os
import json
from threading import Event, Thread
from queue import Queue

@dataclass
class ChatChunkData:
    # event: data, usage, write, end, error, reflected, log, editor
    # data: yield chunk message
    # usage: yield usage report
    # write: yield write files
    # end: end of chat
    # error: yield error message
    # reflected: yield reflected message
    # log: yield log message
    # editor: editor start working
    event: str
    data: Optional[dict] = None

# patch Coder
def on_data_update(self, fn):
    self.on_data_update = fn

def emit_data_update(self, data):
    if self.on_data_update:
        self.on_data_update(data)

def on_confirm_ask(self, fn):
    self._confirm_ask = fn

Coder.on_data_update = on_data_update # type: ignore
Coder.emit_data_update = emit_data_update # type: ignore
Coder.on_confirm_ask = on_confirm_ask # type: ignore

def auto_commit(self, edited, context=None):
    print('auto_commit', edited)
    # when auto_commits is True, don't block to confirm
    if self.auto_commits:
        return
    self._on_confirm_ask('auto-commit', list(edited))

Coder.auto_commit = auto_commit

# patch ArchitectCoder
original_reply_completed = ArchitectCoder.reply_completed
def reply_completed(self):
    self.emit_data_update(ChatChunkData(event='editor-start'))
    result = original_reply_completed(self)
    self.emit_data_update(ChatChunkData(event='editor-end'))
    return result


ArchitectCoder.reply_completed = reply_completed


@dataclass
class ModelSetting:
    provider: str
    api_key: str
    model: str
    base_url: Optional[str] = None

@dataclass
class ChatSetting:
    main_model: ModelSetting
    editor_model: Optional[ModelSetting] = None
    auto_commits: bool = False

provider_env_map = {
    'deepseek': 'DEEPSEEK_API_KEY',
    'openai': 'OPENAI_API_KEY',
    'anthropic': 'ANTHROPIC_API_KEY',
    'ollama': {
        'base_url': 'OLLAMA_API_BASE',
    },
    'openrouter': 'OPENROUTER_API_KEY',
    'openai_compatible': {
        'api_key': 'OPENAI_API_KEY',
        'base_url': 'OPENAI_API_BASE',
    },
    'gemini': 'GEMINI_API_KEY',
}

# copy from aider/main.py to void import main.py
def parse_lint_cmds(lint_cmds, io):
    err = False
    res = dict()
    for lint_cmd in lint_cmds:
        if re.match(r"^[a-z]+:.*", lint_cmd):
            pieces = lint_cmd.split(":")
            lang = pieces[0]
            cmd = lint_cmd[len(lang) + 1 :]
            lang = lang.strip()
        else:
            lang = None
            cmd = lint_cmd

        cmd = cmd.strip()

        if cmd:
            res[lang] = cmd
        else:
            io.tool_error(f'Unable to parse --lint-cmd "{lint_cmd}"')
            io.tool_output('The arg should be "language: cmd --args ..."')
            io.tool_output('For example: --lint-cmd "python: flake8 --select=E9"')
            err = True
    if err:
        return
    return res


class CaptureIO(InputOutput):
    lines: List[str]
    error_lines: List[str]
    write_files: Dict[str, str]
    _confirm_ask: Callable[[str], bool] = lambda _: False

    def __init__(self, *args, **kwargs):
        self.lines = []
        # when spawned in node process, tool_error will be called
        # so we need to create before super().__init__
        self.error_lines = []
        self.write_files = {}
        super().__init__(*args, **kwargs)

    def tool_output(self, *messages, log_only=False, bold=False):
        if not log_only:
            self.lines.append(*messages)
        super().tool_output(*messages, log_only=log_only, bold=bold)

    def tool_error(self, message="", strip=True):
        self.error_lines.append(message)
        super().tool_error(message, strip)

    def tool_warning(self, message="", strip=True):
        self.lines.append(message)
        super().tool_warning(message, strip=strip)

    def get_captured_lines(self):
        lines = self.lines
        self.lines = []
        return lines
    
    def get_captured_error_lines(self):
        lines = self.error_lines
        self.error_lines = []
        return lines

    def write_text(self, filename, content, max_retries=3, initial_delay=0.1):
        print(f'write {filename}')
        self.write_files[filename] = content
    
    def read_text(self, filename, silent=False):
        print(f'read {filename}')
        if filename in self.write_files:
            return self.write_files[filename]
        return super().read_text(filename, silent)

    def get_captured_write_files(self):
        write_files = self.write_files
        self.write_files = {}
        return write_files
    
    def on_confirm_ask(self, fn):
        self._confirm_ask = fn
    
    def confirm_ask(
        self,
        question: str,
        default="y",
        subject=None,
        explicit_yes_required=False,
        group=None,
        allow_never=False,
    ):
        print('confirm_ask', question, subject, group)
        question_type = ''
        # create new file
        if 'Create new file' in question:
            return True
        elif 'Edit the files' in question:
            return True
        elif 'Attempt to fix lint errors' in question:
            question_type = 'lint-fix'
        elif 'Attempt to fix test errors' in question:
            question_type = 'test-fix'
        
        if question_type:
            res = self._confirm_ask(question)
            return res

        return False

@dataclass
class ChatSessionReference:
    readonly: bool
    fs_path: str

@dataclass
class ChatSessionExtraConfig:
    lint_cmds: Optional[List[str]] = None
    auto_lint: bool = False
    auto_test: bool = False
    test_cmd: Optional[str] = None

ChatModeType = Literal['ask', 'code', 'architect']

@dataclass
class ChatSessionData:
    chat_type: ChatModeType
    diff_format: str
    message: str
    reference_list: List[ChatSessionReference]
    extra_config: ChatSessionExtraConfig

class ChatSessionManager:
    chat_type: ChatModeType
    diff_format: str
    reference_list: List[ChatSessionReference]
    extra_config: ChatSessionExtraConfig
    setting: Optional[ChatSetting] = None
    confirm_ask_result: Optional[Any] = None

    coder: Coder

    def __init__(self):
        model = Model('gpt-4o')
        io = CaptureIO(
            pretty=False,
            yes=False,
            dry_run=False,
            encoding='utf-8',
            fancy_input=False,
        )
        self.io = io
        self.io.on_confirm_ask(self._confirm_ask)

        self.coder = Coder.create(
            main_model=model,
            io=io,
            edit_format='ask',
            use_git=False,
            auto_commits=False,
        )
        self._update_patch_coder()

        self.chat_type = 'ask'
        self.diff_format = 'diff'
        self.reference_list = []
        self.extra_config = ChatSessionExtraConfig()

        self.confirm_ask_event = Event()
        self.queue = Queue()
    
    def _update_patch_coder(self):
        self.coder.yield_stream = True
        self.coder.stream = True
        self.coder.pretty = False
        # when auto_commits is True, it will set dirty_commits to True
        self.coder.dirty_commits = False
        self.coder.on_data_update(self.queue.put) # type: ignore
        self.coder.on_confirm_ask(self._confirm_ask) # type: ignore

    def _confirm_ask(self, question: str, data: Any = None):
        self.queue.put(ChatChunkData(event='confirm-ask', data={"type": question, "data": data}))
        self.confirm_ask_event.wait()
        return bool(self.confirm_ask_result)

    def update_model(self, setting: ChatSetting):
        if self.setting != setting:
            self.setting = setting
            model = Model(setting.main_model.model)
            
            # Configure main model environment
            self._configure_model_env(setting.main_model)
 
            # Configure editor model if provided
            if setting.editor_model:
                model.editor_model = Model(setting.editor_model.model)
                self._configure_model_env(setting.editor_model)
            
            self.coder = Coder.create(from_coder=self.coder, main_model=model, auto_commits=setting.auto_commits)
    
    def _configure_model_env(self, setting: ModelSetting):
        # update os env
        config = provider_env_map[setting.provider]
        if isinstance(config, str):
            os.environ[config] = setting.api_key
        # explicitly handle configs that need multiple env variables, like base urls and api keys
        elif isinstance(config, dict):
            for key, value in config.items():
                os.environ[value] = getattr(setting, key)
    
    def update_coder(self):
        self.coder = Coder.create(
            from_coder=self.coder,
            summarize_from_coder=False,
            edit_format=self.diff_format if self.chat_type == 'code' else self.chat_type,
            fnames=(item.fs_path for item in self.reference_list if not item.readonly),
            read_only_fnames=(item.fs_path for item in self.reference_list if item.readonly),
            # extra config
            lint_cmds=parse_lint_cmds(self.extra_config.lint_cmds, self.io),
            auto_lint=self.extra_config.auto_lint,
            auto_test=self.extra_config.auto_test,
            test_cmd=self.extra_config.test_cmd,
        )
        if self.chat_type == 'architect':
            self.coder.main_model.editor_edit_format = self.diff_format

        self._update_patch_coder()

    def chat(self, data: ChatSessionData) -> Iterator[ChatChunkData]:
        need_update_coder = False
        data.reference_list.sort(key=lambda x: x.fs_path)

        if data.chat_type != self.chat_type or data.diff_format != self.diff_format:
            need_update_coder = True
            self.chat_type = data.chat_type
            self.diff_format = data.diff_format
        if data.reference_list != self.reference_list:
            need_update_coder = True
            self.reference_list = data.reference_list
        if data.extra_config != self.extra_config:
            need_update_coder = True
            self.extra_config = data.extra_config

        if need_update_coder:
            self.update_coder()
        
        # Start coder thread
        thread = Thread(target=self._coder_thread, args=(data.message,))
        thread.start()

        # Yield data from queue
        while True:
            chunk = self.queue.get()
            yield chunk
            if chunk.event == 'end':
                break

    def _coder_thread(self, message: str):
        try:
            self.coder.init_before_message()
            while message:
                self.coder.reflected_message = None
                for msg in self.coder.run_stream(message):
                    data = {
                        "chunk": msg,
                    }
                    self.queue.put(ChatChunkData(event='data', data=data))

                if self.coder.usage_report:
                    data = { "usage": self.coder.usage_report }
                    self.queue.put(ChatChunkData(event='usage', data=data))
                
                if not self.coder.reflected_message:
                    break

                if self.coder.num_reflections >= self.coder.max_reflections:
                    self.coder.io.tool_warning(f"Only {self.coder.max_reflections} reflections allowed, stopping.")
                    break

                self.coder.num_reflections += 1
                message = self.coder.reflected_message

                self.queue.put(ChatChunkData(event='reflected', data={"message": message}))

                error_lines = self.coder.io.get_captured_error_lines() # type: ignore
                if error_lines:
                    if not message:
                        raise Exception('\n'.join(error_lines))
                    else:
                        self.queue.put(ChatChunkData(event='log', data={"message": '\n'.join(error_lines)}))

            # get write files
            write_files = self.io.get_captured_write_files()
            if write_files:
                data = {
                    "write": write_files,
                    "auto_commits": self.coder.auto_commits,
                }
                self.queue.put(ChatChunkData(event='write', data=data))

        except Exception as e:
            # send error to client
            error_data = {
                "error": str(e)
            }
            self.queue.put(ChatChunkData(event='error', data=error_data))
        finally:
            # send end event to client
            self.queue.put(ChatChunkData(event='end'))

    
    def confirm_ask_reply(self, data: dict):
        self.confirm_ask_result = data['response']
        self.confirm_ask_event.set()

class CORS:
    def __init__(self, app):
        self.app = app
        self.init_app(app)

    def init_app(self, app):
        app.after_request(self.add_cors_headers)

    def add_cors_headers(self, response):
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        return response

app = Flask(__name__)
CORS(app)

manager = ChatSessionManager()

@app.route('/api/chat', methods=['POST', 'OPTIONS'])
def sse():
    if request.method == 'OPTIONS':
        response = Response()
        return response

    data: dict = cast(dict, request.json)
    data['reference_list'] = [ChatSessionReference(**item) for item in data['reference_list']]
    data['extra_config'] = ChatSessionExtraConfig(**data['extra_config'])

    chat_session_data = ChatSessionData(**data)

    def generate():
        for msg in manager.chat(chat_session_data):
            if msg.data:
                yield f"event: {msg.event}\n"
                yield f"data: {json.dumps(msg.data)}\n\n"
            else:
                yield f"event: {msg.event}\n"
                yield f"data:\n\n"

    response = Response(generate(), mimetype='text/event-stream')
    return response

@app.route('/api/chat', methods=['DELETE'])
def clear():
    manager.coder.done_messages = []
    manager.coder.cur_messages = []
    return jsonify({})

@app.route('/api/chat/session', methods=['PUT'])
def set_history():
    data = request.json
    manager.coder.done_messages = data
    manager.coder.cur_messages = []
    return jsonify({})

@app.route('/api/chat/setting', methods=['POST'])
def update_setting():
    data: dict = cast(dict, request.json)
    # Create ModelSetting instances for both main and editor models
    data['main_model'] = ModelSetting(**data['main_model'])
    if 'editor_model' in data and data['editor_model']:
        data['editor_model'] = ModelSetting(**data['editor_model'])
    setting = ChatSetting(**data)

    manager.update_model(setting)
    return jsonify({})

@app.route('/api/chat/confirm/reply', methods=['POST'])
def confirm_reply():
    data: dict = cast(dict, request.json)
    manager.confirm_ask_reply(data)
    return jsonify({})

if __name__ == '__main__':
    app.run()
