"""Test configuration and fixtures."""
import os
import pytest

from aider.coders import Coder
from aider.models import Model
from unittest.mock import MagicMock, patch


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
def mock_llm(mock_coder : Coder):
    """Mock LLM calls to avoid costs during testing."""
    with patch("aider.coders.Coder.create", return_value=mock_coder), \
         patch("litellm.completion", return_value={"choices": [{"message": {"content": "test"}}]}):
        yield mock_coder.send_receive
