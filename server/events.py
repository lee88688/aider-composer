"""Event data structures for the chat server."""
from dataclasses import dataclass
from typing import Any


@dataclass
class DataEventData:
    """Data event containing a response chunk."""
    chunk: str

@dataclass
class UsageEventData:
    """Token usage statistics for the chat interaction."""
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int

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
