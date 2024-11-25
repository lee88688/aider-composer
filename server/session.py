"""Data structures for chat sessions."""
from dataclasses import dataclass
from typing import Literal

ChatModeType = Literal["ask", "code"]
DiffFormatType = Literal["diff", "search-replace"]

@dataclass
class ChatSetting:
    """Configuration settings for chat model providers."""
    provider: str
    api_key: str
    model: str
    base_url: str | None = None  # API endpoint URL for custom/self-hosted model providers

@dataclass
class ChatSessionReference:
    """Reference to a file in the chat session."""
    readonly: bool
    fs_path: str

@dataclass
class ChatSessionData:
    """Data structure for a chat session request."""
    chat_type: ChatModeType
    diff_format: DiffFormatType
    message: str
    reference_list: list[ChatSessionReference]
