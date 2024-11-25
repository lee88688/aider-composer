"""Configuration constants for the Aider chat server."""
from typing import Literal, TypedDict

# Chat modes
CHAT_MODE_ASK = "ask"
CHAT_MODE_CODE = "code"

# Diff formats
DIFF_FORMAT_DIFF = "diff"
DIFF_FORMAT_SEARCH_REPLACE = "search-replace"

# MIME types
MIME_SSE = "text/event-stream"

# Event types
EVENT_DATA = "data"
EVENT_ERROR = "error"
EVENT_WRITE = "write"
EVENT_USAGE = "usage"
EVENT_REFLECTED = "reflected"
EVENT_LOG = "log"
EVENT_END = "end"

# API routes
API_BASE = "/api"
API_CHAT = f"{API_BASE}/chat"
API_CHAT_SESSION = f"{API_CHAT}/session"
API_CHAT_SETTING = f"{API_CHAT}/setting"
API_CHAT_CONFIRM_ASK = f"{API_CHAT}/confirm/ask"
API_CHAT_CONFIRM_REPLY = f"{API_CHAT}/confirm/reply"

# IO settings
ENCODING = "utf-8"
MAX_REFLECTIONS = 10

# Confirmation defaults
CONFIRM_DEFAULT_YES = "y"
CONFIRM_DEFAULT_NO = "n"

# Type aliases
ChatModeType = Literal["ask", "code"]
DiffFormatType = Literal["diff", "search-replace"]
EventType = Literal["data", "usage", "write", "end", "error", "reflected", "log"]

# Provider environment variable mapping
class OllamaConfig(TypedDict):
    """Configuration for Ollama API."""
    base_url: str

class OpenAICompatibleConfig(TypedDict):
    """Configuration for OpenAI-compatible APIs."""
    api_key: str
    base_url: str

ProviderConfig = str | OllamaConfig | OpenAICompatibleConfig

PROVIDER_ENV_MAP: dict[str, str | OllamaConfig | OpenAICompatibleConfig] = {
    "deepseek": "DEEPSEEK_API_KEY",
    "openai": "OPENAI_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
    "openrouter": "OPENROUTER_API_KEY",
    "ollama": OllamaConfig(base_url="OLLAMA_API_BASE"),
    "openai_compatible": OpenAICompatibleConfig(
        api_key="OPENAI_API_KEY",
        base_url="OPENAI_API_BASE",
    ),
}
