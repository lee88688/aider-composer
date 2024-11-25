"""Tests for event data structures."""

import pytest

from server.events import (
    ChatChunkData,
    DataEventData,
    ErrorEventData,
    LogEventData,
    ReflectedEventData,
    UsageEventData,
    WriteEventData,
)

# Test constants
PROMPT_TOKENS = 10
COMPLETION_TOKENS = 20
TOTAL_TOKENS = 30
LARGE_TOKEN_COUNT = 999999
LARGE_TOTAL_TOKENS = 1999998
TEST_FILE_COUNT = 4

def test_data_event():
    """Test DataEventData creation and attributes."""
    data = DataEventData(chunk="test chunk")
    assert data.chunk == "test chunk"

def test_data_event_empty():
    """Test DataEventData with empty chunk."""
    data = DataEventData(chunk="")
    assert data.chunk == ""

def test_data_event_long():
    """Test DataEventData with long chunk."""
    long_chunk = "x" * 10000
    data = DataEventData(chunk=long_chunk)
    assert data.chunk == long_chunk

def test_data_event_invalid_data():
    """Test DataEventData with invalid data types."""
    with pytest.raises(TypeError):
        DataEventData(chunk=123)

def test_usage_event():
    """Test UsageEventData creation and attributes."""
    data = UsageEventData(
        prompt_tokens=PROMPT_TOKENS,
        completion_tokens=COMPLETION_TOKENS,
        total_tokens=TOTAL_TOKENS,
    )
    assert data.prompt_tokens == PROMPT_TOKENS
    assert data.completion_tokens == COMPLETION_TOKENS
    assert data.total_tokens == TOTAL_TOKENS


def test_usage_event_invalid_data():
    """Test UsageEventData with invalid data types."""
    with pytest.raises(TypeError):
        UsageEventData(prompt_tokens="ten", completion_tokens="twenty", total_tokens="thirty")

def test_write_event():
    """Test WriteEventData creation and attributes."""
    files = {"test.py": "content"}
    data = WriteEventData(write=files)
    assert data.write == files


def test_error_event():
    """Test ErrorEventData creation and attributes."""
    data = ErrorEventData(error="test error")
    assert data.error == "test error"


def test_reflected_event():
    """Test ReflectedEventData creation and attributes."""
    data = ReflectedEventData(message="test message")
    assert data.message == "test message"


def test_log_event():
    """Test LogEventData creation and attributes."""
    data = LogEventData(message="test log")
    assert data.message == "test log"


def test_chat_chunk_data():
    """Test ChatChunkData creation and attributes."""
    data = ChatChunkData(event="data", data=DataEventData(chunk="test"))
    assert data.event == "data"
    assert isinstance(data.data, DataEventData)
    assert data.data.chunk == "test"

    # Test with no data
    data = ChatChunkData(event="end")
    assert data.event == "end"
    assert data.data is None

    # Test with empty string chunk
    data = ChatChunkData(event="data", data=DataEventData(chunk=""))
    assert data.event == "data"
    assert data.data.chunk == ""

    # Test with very long chunk
    long_chunk = "x" * 10000
    data = ChatChunkData(event="data", data=DataEventData(chunk=long_chunk))
    assert data.event == "data"
    assert data.data.chunk == long_chunk

def test_data_event_edge_cases():
    """Test DataEventData with edge cases."""
    # Test empty chunk
    data = DataEventData(chunk="")
    assert data.chunk == ""

    # Test very long chunk
    long_chunk = "x" * 10000
    data = DataEventData(chunk=long_chunk)
    assert data.chunk == long_chunk
    """Test UsageEventData with edge cases."""
    # Test zero tokens
    data = UsageEventData(prompt_tokens=0, completion_tokens=0, total_tokens=0)
    assert data.prompt_tokens == 0
    assert data.total_tokens == 0

    # Test large numbers
    data = UsageEventData(prompt_tokens=LARGE_TOKEN_COUNT, completion_tokens=LARGE_TOKEN_COUNT, total_tokens=LARGE_TOTAL_TOKENS)
    assert data.prompt_tokens == LARGE_TOKEN_COUNT
    assert data.total_tokens == LARGE_TOTAL_TOKENS

def test_write_event_edge_cases():
    """Test WriteEventData with edge cases."""
    # Test empty dict
    data = WriteEventData(write={})
    assert data.write == {}

    # Test multiple files
    files = {
        "test1.py": "content1",
        "test2.py": "content2",
        "": "empty key",
        "test3.py": "",
    }
    data = WriteEventData(write=files)
    assert len(data.write) == TEST_FILE_COUNT
    assert data.write[""] == "empty key"
    assert data.write["test3.py"] == ""
