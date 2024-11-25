"""Test to verify correct mock path for aider.coders."""
from aider.coders import Coder
from aider.models import Model
from unittest.mock import patch


def test_mock_import_path():
    """Verify the correct import path for mocking Coder."""
    model = Model("gpt-4")
    coder = Coder.create(main_model=model)

    with patch.object(coder, "send_receive", return_value="test response"):
        result = coder.send_receive([{"role": "user", "content": "test"}])
        assert result == "test response"
