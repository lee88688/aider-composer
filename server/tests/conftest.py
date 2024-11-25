"""Test configuration and fixtures."""
import os
import pytest

from aider.coders import Coder
from aider.models import Model
from collections.abc import Iterator
from server.events import ChatChunkData, DataEventData, WriteEventData
from server.io import CaptureIO
from unittest.mock import MagicMock, patch

# Test constants
PROMPT_TOKENS = 10
COMPLETION_TOKENS = 20
TOTAL_TOKENS = 30
LONG_STRING_LENGTH = 1000
TEST_FILE_COUNT = 4

@pytest.fixture
def mock_coder():
    """Create a mocked Coder instance for testing."""
    model = Model("gpt-4")
    coder = Coder.create(main_model=model)
    coder.send_receive = MagicMock(return_value="Mocked LLM response")
    return coder

@pytest.fixture(autouse=True)
def mock_env():
    """Mock environment variables for testing."""
    with patch.dict(os.environ, {
        "OPENAI_API_KEY": "sk-test-key-123",
        "ANTHROPIC_API_KEY": "test-key-456",
        "OPENROUTER_API_KEY": "test-key-789",
    }):
        yield

@pytest.fixture(autouse=True)
def mock_llm(mock_coder: Coder):
    """Mock LLM calls to avoid costs during testing."""
    with patch("aider.coders.Coder.create", return_value=mock_coder), \
         patch("litellm.completion", return_value={"choices": [{"message": {"content": "test"}}]}):
        yield mock_coder.send_receive

@pytest.fixture
def io():
    """Create a CaptureIO instance for testing."""
    return CaptureIO(
        pretty=False,
        yes=False,
        dry_run=False,
        encoding="utf-8",
        fancy_input=False,
    )

@pytest.fixture
def chat_chunk_data():
    """Create sample chat chunk data for testing."""
    return ChatChunkData(
        event="data",
        data=DataEventData(chunk="test chunk"),
    )

@pytest.fixture
def write_event_data():
    """Create sample write event data for testing."""
    return WriteEventData(write={"test.py": "content"})

@pytest.fixture
def mock_chat_response():
    """Create mock chat response generator."""
    def generate() -> Iterator[ChatChunkData]:
        yield ChatChunkData(event="data", data=DataEventData(chunk="mocked response"))
        yield ChatChunkData(event="end")
    return generate
