"""Data structures for chat sessions."""
from dataclasses import dataclass, field
from typing import Literal

ChatModeType = Literal["ask", "code"]
DiffFormatType = Literal["diff", "search-replace"]

@dataclass
class ChatSetting:
    """Configuration settings for chat model providers."""
    provider: str = field(default_factory=str)
    api_key: str = field(default_factory=str)
    model: str = field(default_factory=str)
    base_url: str | None = None

    def __post_init__(self):
        if not all(isinstance(x, str) for x in [self.provider, self.api_key, self.model]):
            raise TypeError("provider, api_key, and model must be strings")
        if self.base_url is not None and not isinstance(self.base_url, str):
            raise TypeError("base_url must be a string or None")

@dataclass
class ChatSessionReference:
    """Reference to a file in the chat session."""
    readonly: bool
    fs_path: str

@dataclass
class ChatSessionData:
    """Data structure for a chat session request."""
    chat_type: ChatModeType = field(default_factory=str)
    diff_format: DiffFormatType = field(default_factory=str)
    message: str = field(default_factory=str)
    reference_list: list[ChatSessionReference] = field(default_factory=list)

    def __post_init__(self):
        if not isinstance(self.chat_type, str) or not isinstance(self.diff_format, str):
            raise TypeError("chat_type and diff_format must be strings")
        if not isinstance(self.reference_list, list):
            raise TypeError("reference_list must be a list")
