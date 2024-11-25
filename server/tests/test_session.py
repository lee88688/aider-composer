"""Tests for chat session data structures."""

from server.config import CHAT_MODE_ASK, DIFF_FORMAT_DIFF
from server.session import ChatSessionData, ChatSessionReference, ChatSetting

# Test constants
LONG_STRING_LENGTH = 1000


def test_chat_setting():
    """Test ChatSetting creation and attributes."""
    setting = ChatSetting(
        provider="test",
        api_key="key123",
        model="gpt-3.5",
        base_url="http://test.com",
    )
    assert setting.provider == "test"
    assert setting.api_key == "key123"
    assert setting.model == "gpt-3.5"
    assert setting.base_url == "http://test.com"


def test_chat_session_reference():
    """Test ChatSessionReference creation and attributes."""
    ref = ChatSessionReference(
        readonly=True,
        fs_path="/test/path.py",
    )
    assert ref.readonly is True
    assert ref.fs_path == "/test/path.py"


def test_chat_session_data():
    """Test ChatSessionData creation and attributes."""
    ref = ChatSessionReference(readonly=False, fs_path="test.py")
    data = ChatSessionData(
        chat_type=CHAT_MODE_ASK,
        diff_format=DIFF_FORMAT_DIFF,
        message="test message",
        reference_list=[ref],
    )
    assert data.chat_type == "ask"
    assert data.diff_format == "diff"
    assert data.message == "test message"
    assert len(data.reference_list) == 1
    assert data.reference_list[0] == ref

def test_chat_setting_edge_cases():
    """Test ChatSetting with edge cases."""
    # Test empty strings
    setting = ChatSetting(
        provider="",
        api_key="",
        model="",
        base_url="",
    )
    assert setting.provider == ""
    assert setting.base_url == ""

    # Test None base_url
    setting = ChatSetting(
        provider="test",
        api_key="key",
        model="model",
        base_url=None,
    )
    assert setting.base_url is None

    # Test very long values
    long_str = "x" * LONG_STRING_LENGTH
    setting = ChatSetting(
        provider=long_str,
        api_key=long_str,
        model=long_str,
        base_url=long_str,
    )
    assert len(setting.provider) == LONG_STRING_LENGTH
    assert len(setting.api_key) == LONG_STRING_LENGTH

def test_chat_session_reference_edge_cases():
    """Test ChatSessionReference with edge cases."""
    # Test empty path
    ref = ChatSessionReference(readonly=True, fs_path="")
    assert ref.fs_path == ""

    # Test absolute paths
    ref = ChatSessionReference(readonly=False, fs_path="/absolute/path/file.py")
    assert ref.fs_path == "/absolute/path/file.py"

    # Test relative paths
    ref = ChatSessionReference(readonly=True, fs_path="../relative/path.py")
    assert ref.fs_path == "../relative/path.py"

    # Test paths with spaces and special chars
    ref = ChatSessionReference(readonly=False, fs_path="path with spaces/file#1.py")
    assert ref.fs_path == "path with spaces/file#1.py"
