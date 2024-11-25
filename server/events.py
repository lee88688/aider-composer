"""Event data structures for the chat server."""
from dataclasses import dataclass, field
from typing import Any


@dataclass
class DataEventData:
    """Data event containing a response chunk."""
    chunk: str = field(default_factory=str)

    def __post_init__(self):
        if not isinstance(self.chunk, str):
            raise TypeError("chunk must be a string")

@dataclass
class UsageEventData:
    """Token usage statistics for the chat interaction."""
    prompt_tokens: int = field(default_factory=int)
    completion_tokens: int = field(default_factory=int)
    total_tokens: int = field(default_factory=int)

    def __post_init__(self):
        if not all(isinstance(x, int) for x in [self.prompt_tokens, self.completion_tokens, self.total_tokens]):
            raise TypeError("All token counts must be integers")

@dataclass
class WriteEventData:
    """Data for file write operations."""
    write: dict[str, str]

@dataclass
class ErrorEventData:
    """Data for error events."""
    error: str

@dataclass
class ReflectedEventData:
    """Data for reflected messages from the AI."""
    message: str

@dataclass
class LogEventData:
    """Data for log message events."""
    message: str

@dataclass
class ChatChunkData:
    """Container for chat response chunks and events."""
    event: str
    data: Any | None = None
