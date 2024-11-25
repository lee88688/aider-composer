"""Tests for IO capture functionality."""
import pytest

from server.io import CaptureIO


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


def test_tool_output_invalid_data(io: CaptureIO):
    """Test tool output with invalid data types."""
    with pytest.raises(TypeError):
        io.tool_output(123)

    with pytest.raises(TypeError):
        io.tool_output(["list", "of", "strings"])

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

def test_write_text_invalid_data(io: CaptureIO):
    """Test write_text with invalid data types."""
    with pytest.raises(TypeError):
        io.write_text(123, "content")

    with pytest.raises(TypeError):
        io.write_text("test.txt", 456)

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

def test_write_text_edge_cases(io: CaptureIO):
    """Test write_text with edge cases."""
    # Test empty filename
    io.write_text("", "content")
    assert io.get_captured_write_files() == {"": "content"}

    # Test very long filename
    long_filename = "x" * 255
    io.write_text(long_filename, "content")
    assert io.get_captured_write_files() == {long_filename: "content"}
    """Test tool output with edge cases."""
    # Test empty message
    io.tool_output("")
    assert io.get_captured_lines() == [""]

    # Test None message
    with pytest.raises(TypeError):
        io.tool_output(None)

    # Test very long message
    long_msg = "x" * 10000
    io.tool_output(long_msg)
    assert io.get_captured_lines() == [long_msg]

    # Test multiple messages
    io.tool_output("msg1")
    io.tool_output("msg2")
    assert io.get_captured_lines() == ["msg1", "msg2"]
