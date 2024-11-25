"""Flask server that manages chat sessions and handles API requests.

Provides endpoints for chat interactions, settings management, and file operations
for the Aider chat interface.
"""
import json
import os

from .config import (
    API_CHAT,
    API_CHAT_CONFIRM_ASK,
    API_CHAT_CONFIRM_REPLY,
    API_CHAT_SESSION,
    API_CHAT_SETTING,
    CHAT_MODE_ASK,
    DIFF_FORMAT_SEARCH_REPLACE,
    ENCODING,
    EVENT_DATA,
    EVENT_END,
    EVENT_ERROR,
    EVENT_LOG,
    EVENT_REFLECTED,
    EVENT_USAGE,
    EVENT_WRITE,
    MIME_SSE,
    PROVIDER_ENV_MAP,
)
from .cors import CORS
from .events import (
    ChatChunkData,
    DataEventData,
    ErrorEventData,
    LogEventData,
    ReflectedEventData,
    UsageEventData,
    WriteEventData,
)
from .io import CaptureIO
from .session import (
    ChatModeType,
    ChatSessionData,
    ChatSessionReference,
    ChatSetting,
    DiffFormatType,
)
from aider.coders import Coder
from aider.models import DEFAULT_MODEL_NAME, Model
from collections.abc import Iterator
from flask import Flask, Response, jsonify, request
from http import HTTPStatus
from threading import Event
from typing import Any


class ChatSessionManager:
    """Manages chat sessions and coordinates between the UI and Aider coder.

    Handles chat session state, model configuration, and message processing.
    Coordinates file operations and maintains chat history.
    """
    chat_type: ChatModeType
    diff_format: DiffFormatType
    reference_list: list[ChatSessionReference]
    setting: ChatSetting | None = None
    confirm_ask_result: Any | None = None

    def __init__(self) -> None:
        """Initialize the chat session manager with default settings."""
        # Initialize instance variables first
        self.chat_type = CHAT_MODE_ASK
        self.diff_format = DIFF_FORMAT_SEARCH_REPLACE
        self.reference_list = []
        self.confirm_ask_event = Event()

        # Setup IO
        io = CaptureIO(
            pretty=False,
            yes=False,
            dry_run=False,
            encoding=ENCODING,
            fancy_input=False,
        )
        self.io = io

        # Setup model and coder
        model = Model(DEFAULT_MODEL_NAME)
        coder = Coder.create(
            main_model=model,
            io=io,
            edit_format=self.chat_type,
            use_git=False,
        )
        coder.yield_stream = True
        coder.stream = True
        coder.pretty = False
        self.coder = coder

    def update_model(self, setting: ChatSetting) -> None:
        """Updates the AI model configuration with new settings.

        Args:
            setting: New ChatSetting configuration to apply

        Updates environment variables and recreates the coder instance
        with the new model settings.
        """
        if self.setting != setting:
            self.setting = setting
            model = Model(setting.model)
            # update os env
            config = PROVIDER_ENV_MAP[setting.provider]

            if isinstance(config, str):
                os.environ[config] = setting.api_key

            # handle configs needing multiple env vars (base urls, api keys etc)
            elif isinstance(config, dict):
                for key, value in config.items():
                    os.environ[value] = getattr(setting, key)
            self.coder = Coder.create(from_coder=self.coder, main_model=model)

    def update_coder(self) -> None:
        """Updates the coder instance with new chat settings."""
        self.coder = Coder.create(
            from_coder=self.coder,
            edit_format=self.chat_type if self.chat_type == CHAT_MODE_ASK else self.diff_format,
            fnames=(item.fs_path for item in self.reference_list if not item.readonly),
            read_only_fnames=(item.fs_path for item in self.reference_list if item.readonly),
        )

    def _check_and_update_coder(self, data: ChatSessionData) -> None:
        """Check if coder needs updating and update if necessary."""
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

    def _handle_error_lines(self, message: str) -> Iterator[ChatChunkData]:
        """Handle any error lines from the coder IO."""
        error_lines = self.coder.io.get_captured_error_lines()
        if error_lines:
            if not message:
                raise RuntimeError("\n".join(error_lines))
            else:
                yield ChatChunkData(event=EVENT_LOG, data=LogEventData(message="\n".join(error_lines)))

    def _process_message(self, message: str) -> Iterator[ChatChunkData]:
        """Process a single message and yield response chunks."""
        self.coder.reflected_message = None
        for msg in self.coder.run_stream(message):
            data = DataEventData(chunk=msg)
            yield ChatChunkData(event=EVENT_DATA, data=data)

        if manager.coder.usage_report:
            yield ChatChunkData(event=EVENT_USAGE, data=UsageEventData(**self.coder.usage_report))

    def _handle_reflection(self, message: str) -> tuple[bool, str]:
        """Handle message reflection and return whether to continue and next message."""
        if not self.coder.reflected_message:
            return False, message

        if self.coder.num_reflections >= self.coder.max_reflections:
            self.coder.io.tool_warning(f"Only {self.coder.max_reflections} reflections allowed, stopping.")
            return False, message

        self.coder.num_reflections += 1
        return True, self.coder.reflected_message

    def chat(self, data: ChatSessionData) -> Iterator[ChatChunkData]:
        """Process a chat message and generate response chunks.

        Args:
            data: ChatSessionData containing message and configuration

        Yields:
            ChatChunkData events for data, usage, writes, errors etc.

        Handles message reflection and maintains conversation state.
        """
        try:
            self._check_and_update_coder(data)
            self.coder.init_before_message()
            message = data.message

            while message:
                yield from self._process_message(message)

                should_continue, next_message = self._handle_reflection(message)
                if not should_continue:
                    break

                message = next_message
                yield ChatChunkData(event=EVENT_REFLECTED, data=ReflectedEventData(message=message))
                yield from self._handle_error_lines(message)

            # Handle any file writes
            write_files = manager.io.get_captured_write_files()
            if write_files:
                yield ChatChunkData(event=EVENT_WRITE, data=WriteEventData(write=write_files))

        except (OSError, RuntimeError) as e:
            yield ChatChunkData(event=EVENT_ERROR, data=ErrorEventData(error=str(e)))
        finally:
            yield ChatChunkData(event=EVENT_END)

    def confirm_ask(self) -> None:
        """Wait for a confirmation response from the client."""
        self.confirm_ask_event.clear()
        self.confirm_ask_event.wait()

    def confirm_ask_reply(self) -> None:
        """Notify the client that a confirmation response is ready."""
        self.confirm_ask_event.set()

# Route handlers
def chat_stream() -> Response:
    """Handle chat messages via Server-Sent Events."""
    if request.method == "OPTIONS":
        return Response()

    if not request.is_json:
        return Response("Content-Type must be application/json", status=HTTPStatus.BAD_REQUEST)

    try:
        data = request.get_json(silent=True)
        if data is None:
            return Response("Missing request data", status=HTTPStatus.BAD_REQUEST)

        data["reference_list"] = [ChatSessionReference(**item) for item in data["reference_list"]]
        chat_session_data = ChatSessionData(**data)
    except (TypeError, KeyError) as e:
        return Response(f"Invalid request format: {e!s}", status=HTTPStatus.BAD_REQUEST)

    def generate() -> Iterator[str]:
        for msg in manager.chat(chat_session_data):
            if msg.data:
                yield f"event: {msg.event}\n"
                yield f"data: {json.dumps(msg.data)}\n\n"
            else:
                yield f"event: {msg.event}\n\n"

    return Response(generate(), mimetype=MIME_SSE)

def clear_history() -> Response:
    """Clear chat session history."""
    try:
        manager.coder.done_messages = []
        manager.coder.cur_messages = []
        return jsonify({"status": "success"})
    except (AttributeError, RuntimeError) as e:
        return Response(f"Failed to clear history: {e!s}", status=HTTPStatus.INTERNAL_SERVER_ERROR)

def set_history() -> Response:
    """Set chat session history."""
    if not request.is_json:
        return Response("Content-Type must be application/json", status=HTTPStatus.BAD_REQUEST)

    try:
        data = request.get_json(silent=True)
        if data is None:
            return Response("Missing history data", status=HTTPStatus.BAD_REQUEST)

        manager.coder.done_messages = data
        manager.coder.cur_messages = []
        return jsonify({"status": "success"})
    except (AttributeError, ValueError, RuntimeError) as e:
        return Response(f"Failed to set history: {e!s}", status=HTTPStatus.INTERNAL_SERVER_ERROR)

def update_setting() -> Response:
    """Update chat model settings."""
    if not request.is_json:
        return Response("Content-Type must be application/json", status=HTTPStatus.BAD_REQUEST)

    try:
        data = request.get_json(silent=True)
        if data is None:
            return Response("Missing settings data", status=HTTPStatus.BAD_REQUEST)

        setting = ChatSetting(**data)
        manager.update_model(setting)
        return jsonify({"status": "success"})
    except (TypeError, KeyError) as e:
        return Response(f"Invalid settings format: {e!s}", status=HTTPStatus.BAD_REQUEST)
    except (AttributeError, ValueError, RuntimeError) as e:
        return Response(f"Failed to update settings: {e!s}", status=HTTPStatus.INTERNAL_SERVER_ERROR)

def confirm_ask() -> Response:
    """Wait for confirmation response."""
    try:
        manager.confirm_ask()
        return jsonify({"result": manager.confirm_ask_result})
    except (RuntimeError, TimeoutError) as e:
        return Response(f"Confirmation request failed: {e!s}", status=HTTPStatus.INTERNAL_SERVER_ERROR)

def confirm_reply() -> Response:
    """Handle confirmation reply."""
    if not request.is_json:
        return Response("Content-Type must be application/json", status=HTTPStatus.BAD_REQUEST)

    try:
        data = request.get_json(silent=True)
        if data is None:
            return Response("Missing reply data", status=HTTPStatus.BAD_REQUEST)

        manager.confirm_ask_result = data
        manager.confirm_ask_reply()
        return jsonify({"status": "success"})
    except (AttributeError, RuntimeError) as e:
        return Response(f"Confirmation reply failed: {e!s}", status=HTTPStatus.INTERNAL_SERVER_ERROR)

# Create manager instance
manager: ChatSessionManager = ChatSessionManager()

# Create Flask app and setup CORS
app = Flask(__name__)
CORS(app)

# Register routes
app.route(API_CHAT, methods=["POST", "OPTIONS"])(chat_stream)
app.route(API_CHAT, methods=["DELETE"])(clear_history)
app.route(API_CHAT_SESSION, methods=["PUT"])(set_history)
app.route(API_CHAT_SETTING, methods=["POST"])(update_setting)
app.route(API_CHAT_CONFIRM_ASK, methods=["POST"])(confirm_ask)
app.route(API_CHAT_CONFIRM_REPLY, methods=["POST"])(confirm_reply)

if __name__ == "__main__":
    app.run()
