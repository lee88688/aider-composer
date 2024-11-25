"""Tests for IO capture functionality."""
import pytest

from server.io import CaptureIO


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


def test_tool_output(io: CaptureIO):
    """Test capturing tool output."""
    io.tool_output("test message")
    assert io.get_captured_lines() == ["test message"]
    assert io.get_captured_lines() == []  # Buffer should be cleared


def test_tool_error(io: CaptureIO):
    """Test capturing tool errors."""
    io.tool_error("test error")
    assert io.get_captured_error_lines() == ["test error"]
    assert io.get_captured_error_lines() == []  # Buffer should be cleared


def test_tool_warning(io: CaptureIO):
    """Test capturing tool warnings."""
    io.tool_warning("test warning")
    assert io.get_captured_lines() == ["test warning"]


def test_write_text(io: CaptureIO):
    """Test capturing file writes."""
    io.write_text("test.txt", "content")
    files = io.get_captured_write_files()
    assert files == {"test.txt": "content"}
    assert io.get_captured_write_files() == {}  # Buffer should be cleared


def test_read_text(io: CaptureIO):
    """Test reading from captured writes."""
    io.write_text("test.txt", "content")
    assert io.read_text("test.txt") == "content"

    # Test reading non-existent file
    with pytest.raises(FileNotFoundError) as exc_info:
        io.read_text("nonexistent.txt")
    assert "No such file" in str(exc_info.value)

    # Test empty file
    io.write_text("empty.txt", "")
    assert io.read_text("empty.txt") == ""

    # Test unicode content
    unicode_content = "Hello 世界 🌍"
    io.write_text("unicode.txt", unicode_content)
    assert io.read_text("unicode.txt") == unicode_content

def test_confirm_ask(io: CaptureIO):
    """Test confirmation prompts."""
    assert io.confirm_ask("Create new file test.txt?", subject="test.txt") is True
    assert io.confirm_ask("Delete file?", subject="test.txt") is False

    # Test with empty strings
    assert io.confirm_ask("", subject="") is False

    # Test with None values
    assert io.confirm_ask("Question?", subject=None) is False

    # Test with various group values
    assert io.confirm_ask("Create new file test.txt?", subject="test.txt", group="files") is True
    assert io.confirm_ask("Delete test.txt?", subject="test.txt", group="dangerous") is False

def test_tool_output_edge_cases(io: CaptureIO):
    """Test tool output with edge cases."""
    # Test empty message
    io.tool_output("")
    assert io.get_captured_lines() == [""]

    # Test None message
    io.tool_output(None)
    assert io.get_captured_lines() == ["None"]

    # Test very long message
    long_msg = "x" * 10000
    io.tool_output(long_msg)
    assert io.get_captured_lines() == [long_msg]

    # Test multiple messages
    io.tool_output("msg1")
    io.tool_output("msg2")
    assert io.get_captured_lines() == ["msg1", "msg2"]
