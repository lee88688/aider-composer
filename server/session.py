"""Data structures for chat sessions."""
from dataclasses import dataclass, field
from typing import Literal

ChatModeType = Literal["ask", "code"]
DiffFormatType = Literal["diff", "search-replace"]

class InvalidSettingTypeError(TypeError):
    """Error raised when setting fields have invalid types."""
    def __init__(self) -> None:
        """Initialize the error with a message."""
        super().__init__("provider, api_key, and model must be strings")

class InvalidBaseUrlError(TypeError):
    """Error raised when base_url is invalid."""
    def __init__(self) -> None:
        """Initialize the error with a message."""
        super().__init__("base_url must be a string or None")

class InvalidChatDataError(TypeError):
    """Error raised when chat data fields have invalid types."""
    def __init__(self, field: str) -> None:
        """Initialize the error with a message."""
        super().__init__(f"{field} must be strings")

class InvalidReferenceListError(TypeError):
    """Error raised when reference_list is not a list."""
    def __init__(self) -> None:
        """Initialize the error with a message."""
        super().__init__("reference_list must be a list")

@dataclass
class ChatSetting:
    """Configuration settings for chat model providers."""
    provider: str = field(default_factory=str)
    api_key: str = field(default_factory=str)
    model: str = field(default_factory=str)
    base_url: str | None = None

    def __post_init__(self) -> None:
        """Validate all fields have correct types."""
        if not all(isinstance(x, str) for x in [self.provider, self.api_key, self.model]):
            raise InvalidSettingTypeError
        if self.base_url is not None and not isinstance(self.base_url, str):
            raise InvalidBaseUrlError

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

    def __post_init__(self) -> None:
        """Validate all fields have correct types."""
        if not isinstance(self.chat_type, str) or not isinstance(self.diff_format, str):
            raise InvalidChatDataError("fields")
        if not isinstance(self.reference_list, list):
            raise InvalidReferenceListError
