from typing import Dict, Iterator, List, Optional, Literal, Any
from flask import Flask, jsonify, request, Response
from aider.models import Model
from aider.coders import Coder
from aider.io import InputOutput
from dataclasses import dataclass, asdict
import os
import json
from threading import Event

@dataclass
class ChatSetting:
    provider: str
    api_key: str
    model: str
    base_url: Optional[str] = None

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
    }
}


class CaptureIO(InputOutput):
    lines: List[str]
    error_lines: List[str]
    write_files: Dict[str, str]

    def __init__(self, *args, **kwargs):
        self.lines = []
        # when spawned in node process, tool_error will be called
        # so we need to create before super().__init__
        self.error_lines = []
        self.write_files = {}
        super().__init__(*args, **kwargs)

    def tool_output(self, msg="", log_only=False, bold=False):
        if not log_only:
            self.lines.append(msg)
        super().tool_output(msg, log_only=log_only, bold=bold)

    def tool_error(self, msg):
        self.error_lines.append(msg)
        super().tool_error(msg)

    def tool_warning(self, msg):
        self.lines.append(msg)
        super().tool_warning(msg)

    def get_captured_lines(self):
        lines = self.lines
        self.lines = []
        return lines
    
    def get_captured_error_lines(self):
        lines = self.error_lines
        self.error_lines = []
        return lines

    def write_text(self, filename, content):
        print(f'write {filename}')
        self.write_files[filename] = content
    
    def read_text(self, filename):
        print(f'read {filename}')
        if filename in self.write_files:
            return self.write_files[filename]
        return super().read_text(filename)

    def get_captured_write_files(self):
        write_files = self.write_files
        self.write_files = {}
        return write_files
    
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
        # create new file
        if 'Create new file' in question:
            return True
        return False

@dataclass
class ChatSessionReference:
    readonly: bool
    fs_path: str

@dataclass
class ChatSessionData:
    chat_type: str
    diff_format: str
    message: str
    reference_list: List[ChatSessionReference]

ChatModeType = Literal['ask', 'code']

@dataclass
class ChatChunkData:
    # event: data, usage, write, end, error, reflected, log
    # data: yield chunk message
    # usage: yield usage report
    # write: yield write files
    # end: end of chat
    # error: yield error message
    # reflected: yield reflected message
    # log: yield log message
    event: str
    data: Optional[dict] = None

class ChatSessionManager:
    chat_type: ChatModeType
    diff_format: str
    reference_list: List[ChatSessionReference]
    setting: Optional[ChatSetting] = None
    confirm_ask_result: Optional[Any] = None

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

        coder = Coder.create(
            main_model=model,
            io=io,
            edit_format='ask',
            use_git=False,
        )
        coder.yield_stream = True
        coder.stream = True
        coder.pretty = False

        self.coder = coder
        self.chat_type = 'ask'
        self.diff_format = 'diff'
        self.reference_list = []

        self.confirm_ask_event = Event()

    def update_model(self, setting: ChatSetting):
        if self.setting != setting:
            self.setting = setting
            model = Model(setting.model)
            # update os env
            config = provider_env_map[setting.provider]
            
            if isinstance(config, str):
                os.environ[config] = setting.api_key
                
            # explicitly handle configs that need multiple env variables, like base urls and api keys
            elif isinstance(config, dict):
                for key, value in config.items():
                    os.environ[value] = getattr(setting, key)
            self.coder = Coder.create(from_coder=self.coder, main_model=model)
    
    def update_coder(self):
        self.coder = Coder.create(
            from_coder=self.coder,
            edit_format=self.chat_type if self.chat_type == 'ask' else self.diff_format,
            fnames=(item.fs_path for item in self.reference_list if not item.readonly),
            read_only_fnames=(item.fs_path for item in self.reference_list if item.readonly),
        )

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

        if need_update_coder:
            self.update_coder()
        
        try:
            self.coder.init_before_message()
            message = data.message
            while message:
                self.coder.reflected_message = None
                for msg in self.coder.run_stream(message):
                    data = {
                        "chunk": msg,
                    }
                    yield ChatChunkData(event='data', data=data)

                if manager.coder.usage_report:
                    yield ChatChunkData(event='usage', data=manager.coder.usage_report)
                
                if not self.coder.reflected_message:
                    break

                if self.coder.num_reflections >= self.coder.max_reflections:
                    self.coder.io.tool_warning(f"Only {self.coder.max_reflections} reflections allowed, stopping.")
                    return

                self.coder.num_reflections += 1
                message = self.coder.reflected_message

                yield ChatChunkData(event='reflected', data={"message": message})

                error_lines = self.coder.io.get_captured_error_lines()
                if error_lines:
                    if not message:
                        raise Exception('\n'.join(error_lines))
                    else:
                        yield ChatChunkData(event='log', data={"message": '\n'.join(error_lines)})

            # get write files
            write_files = manager.io.get_captured_write_files()
            if write_files:
                data = {
                    "write": write_files,
                }
                yield ChatChunkData(event='write', data=data)

        except Exception as e:
            # send error to client
            error_data = {
                "error": str(e)
            }
            yield ChatChunkData(event='error', data=error_data)
        finally:
            # send end event to client
            yield ChatChunkData(event='end')
    
    def confirm_ask(self):
        self.confirm_ask_event.clear()
        self.confirm_ask_event.wait()

    def confirm_ask_reply(self):
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

    data = request.json
    data['reference_list'] = [ChatSessionReference(**item) for item in data['reference_list']]

    chat_session_data = ChatSessionData(**data)

    def generate():
        for msg in manager.chat(chat_session_data):
            if msg.data:
                yield f"event: {msg.event}\n"
                yield f"data: {json.dumps(msg.data)}\n\n"
            else:
                yield f"event: {msg.event}\n\n"

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
    data = request.json
    setting = ChatSetting(**data)

    manager.update_model(setting)
    return jsonify({})

@app.route('/api/chat/confirm/ask', methods=['POST'])
def confirm_ask():
    manager.confirm_ask()
    return jsonify(manager.confirm_ask_result)

@app.route('/api/chat/confirm/reply', methods=['POST'])
def confirm_reply():
    data = request.json
    manager.confirm_ask_result = data
    manager.confirm_ask_reply()
    return jsonify({})

if __name__ == '__main__':
    app.run()
