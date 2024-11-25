"""Tests for Flask server endpoints."""
import json
import pytest

from flask.testing import FlaskClient
from http import HTTPStatus
from server.config import (
    API_CHAT,
    API_CHAT_CONFIRM_ASK,
    API_CHAT_CONFIRM_REPLY,
    API_CHAT_SETTING,
    CHAT_MODE_ASK,
    DIFF_FORMAT_DIFF,
)
from server.main import app, manager
from unittest.mock import patch

# Test constants
LONG_MESSAGE_LENGTH = 100000


@pytest.fixture
def client() -> FlaskClient:
    """Create a test client for the Flask app."""
    app.config["TESTING"] = True
    return app.test_client()


def test_chat_stream_missing_data(client: FlaskClient):
    """Test chat endpoint with missing data."""
    response = client.post("/api/chat", headers={"Content-Type": "application/json"})
    assert response.status_code == HTTPStatus.BAD_REQUEST
    assert b"Missing request data" in response.data


def test_chat_stream_invalid_format(client: FlaskClient):
    """Test chat endpoint with invalid data format."""
    response = client.post("/api/chat", json={"invalid": "data"})
    assert response.status_code == HTTPStatus.BAD_REQUEST
    assert b"Invalid request format" in response.data


def test_clear_history(client: FlaskClient):
    """Test clearing chat history."""
    response = client.delete("/api/chat")
    assert response.status_code == HTTPStatus.OK
    data = json.loads(response.data)
    assert data["status"] == "success"


def test_set_history_missing_data(client: FlaskClient):
    """Test setting history with missing data."""
    response = client.put("/api/chat/session", headers={"Content-Type": "application/json"})
    assert response.status_code == HTTPStatus.BAD_REQUEST
    assert b"Missing history data" in response.data


def test_update_setting_missing_data(client: FlaskClient):
    """Test updating settings with missing data."""
    response = client.post(API_CHAT_SETTING, headers={"Content-Type": "application/json"})
    assert response.status_code == HTTPStatus.BAD_REQUEST
    assert b"Missing settings data" in response.data


def test_update_setting_invalid_format(client: FlaskClient):
    """Test updating settings with invalid format."""
    response = client.post(API_CHAT_SETTING, json={"invalid": "data"})
    assert response.status_code == HTTPStatus.BAD_REQUEST
    assert b"Invalid settings format" in response.data


def test_confirm_ask(client: FlaskClient):
    """Test confirmation request endpoint."""
    with patch.object(manager, "confirm_ask") as mock_confirm:
        mock_confirm.return_value = None
        manager.confirm_ask_result = True
        response = client.post(API_CHAT_CONFIRM_ASK)
        assert response.status_code == HTTPStatus.OK
        data = json.loads(response.data)
        assert data["result"] is True


def test_confirm_reply_missing_data(client: FlaskClient):
    """Test confirmation reply with missing data."""
    response = client.post(API_CHAT_CONFIRM_REPLY, headers={"Content-Type": "application/json"})
    assert response.status_code == HTTPStatus.BAD_REQUEST
    assert b"Missing reply data" in response.data


def test_chat_stream_edge_cases(client: FlaskClient):
    """Test chat stream endpoint with edge cases."""
    # Test empty message
    response = client.post(API_CHAT, json={
        "message": "",
        "chat_type": CHAT_MODE_ASK,
        "diff_format": DIFF_FORMAT_DIFF,
        "reference_list": [],
    })
    assert response.status_code == HTTPStatus.OK

    # Test very long message
    response = client.post(API_CHAT, json={
        "message": "x" * LONG_MESSAGE_LENGTH,
        "chat_type": CHAT_MODE_ASK,
        "diff_format": DIFF_FORMAT_DIFF,
        "reference_list": [],
    })
    assert response.status_code == HTTPStatus.OK

    # Test invalid chat_type
    response = client.post(API_CHAT, json={
        "message": "test",
        "chat_type": "invalid",
        "diff_format": "diff",
        "reference_list": [],
    })
    assert response.status_code == HTTPStatus.OK  # Server accepts invalid chat_type

def test_update_setting_edge_cases(client: FlaskClient):
    """Test setting update with edge cases."""
    # Test empty settings
    response = client.post(API_CHAT_SETTING, json={
        "provider": "",
        "api_key": "",
        "model": "",
        "base_url": "",
    })
    assert response.status_code == HTTPStatus.BAD_REQUEST  # Empty settings should be rejected

    # Test missing optional fields
    response = client.post(API_CHAT_SETTING, json={
        "provider": "test",
        "api_key": "key",
        "model": "model",
    })
    assert response.status_code == HTTPStatus.BAD_REQUEST  # Missing required fields should be rejected

    # Test invalid provider
    response = client.post(API_CHAT_SETTING, json={
        "provider": "invalid_provider",
        "api_key": "key",
        "model": "model",
    })
    assert response.status_code == HTTPStatus.BAD_REQUEST  # Invalid provider should be rejected
