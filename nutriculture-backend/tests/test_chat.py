"""Tests for the NuTradish chat endpoint."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_chat_message_no_history(async_client):
    """POST /message with no history should return 200 with reply and two history items."""
    with patch(
        "app.services.chat_service._call_claude",
        new_callable=AsyncMock,
        return_value="I can help with that! Try adding more lentils to your diet.",
    ):
        response = await async_client.post(
            "/api/v1/chat/message",
            json={"message": "What foods are good for iron?", "conversation_history": []},
        )

    assert response.status_code == 200
    data = response.json()
    assert "lentils" in data["response"]
    assert len(data["conversation_history"]) == 2
    assert data["conversation_history"][0]["role"] == "user"
    assert data["conversation_history"][0]["content"] == "What foods are good for iron?"
    assert data["conversation_history"][1]["role"] == "assistant"


@pytest.mark.asyncio
async def test_chat_message_with_history(async_client):
    """POST /message with existing history should append new turns."""
    existing_history = [
        {"role": "user", "content": "Hello!"},
        {"role": "assistant", "content": "Hi! How can I help you today?"},
    ]

    with patch(
        "app.services.chat_service._call_claude",
        new_callable=AsyncMock,
        return_value="Biryani is a wonderful cultural dish with great nutritional value.",
    ):
        response = await async_client.post(
            "/api/v1/chat/message",
            json={
                "message": "Tell me about biryani.",
                "conversation_history": existing_history,
            },
        )

    assert response.status_code == 200
    data = response.json()
    assert len(data["conversation_history"]) == 4  # 2 existing + 2 new
    assert data["conversation_history"][2]["role"] == "user"
    assert data["conversation_history"][2]["content"] == "Tell me about biryani."
    assert data["conversation_history"][3]["role"] == "assistant"


@pytest.mark.asyncio
async def test_chat_history_trimmed_to_max(async_client):
    """History longer than MAX_HISTORY_MESSAGES should be trimmed before sending to Claude."""
    # Build 30 turns (exceeds MAX_HISTORY_MESSAGES=20)
    long_history = [
        {"role": "user" if i % 2 == 0 else "assistant", "content": f"msg {i}"}
        for i in range(30)
    ]

    captured_messages: list = []

    async def fake_call_claude(client, messages):
        captured_messages.extend(messages)
        return "Great question!"

    with patch("app.services.chat_service._call_claude", side_effect=fake_call_claude):
        response = await async_client.post(
            "/api/v1/chat/message",
            json={"message": "Is turmeric anti-inflammatory?", "conversation_history": long_history},
        )

    assert response.status_code == 200
    # trimmed to last 20 + the new user message = 21 messages sent to Claude
    assert len(captured_messages) == 21


@pytest.mark.asyncio
async def test_chat_llm_connection_error_returns_503(async_client):
    """A Claude connection error should surface as HTTP 503."""
    from fastapi import HTTPException, status

    with patch(
        "app.services.chat_service.get_chat_response",
        new_callable=AsyncMock,
        side_effect=HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error": "AI service unavailable", "code": "LLM_CONNECTION_ERROR", "detail": "conn err"},
        ),
    ):
        response = await async_client.post(
            "/api/v1/chat/message",
            json={"message": "Hello", "conversation_history": []},
        )

    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "LLM_CONNECTION_ERROR"


@pytest.mark.asyncio
async def test_chat_llm_api_error_returns_502(async_client):
    """A Claude API error should surface as HTTP 502."""
    from fastapi import HTTPException, status

    with patch(
        "app.services.chat_service.get_chat_response",
        new_callable=AsyncMock,
        side_effect=HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"error": "AI service error", "code": "LLM_API_ERROR", "detail": "api err"},
        ),
    ):
        response = await async_client.post(
            "/api/v1/chat/message",
            json={"message": "Hello", "conversation_history": []},
        )

    assert response.status_code == 502
    assert response.json()["detail"]["code"] == "LLM_API_ERROR"


@pytest.mark.asyncio
async def test_chat_requires_auth(mock_db, mock_settings):
    """Requests without an Authorization header should get 422 (missing required header)."""
    from httpx import ASGITransport, AsyncClient
    from app.main import app
    from app.db.client import get_client

    async def _override_get_client():
        yield mock_db

    app.dependency_overrides[get_client] = _override_get_client
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/v1/chat/message",
                json={"message": "Hello", "conversation_history": []},
            )
    finally:
        app.dependency_overrides.pop(get_client, None)

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_chat_empty_message_still_processed(async_client):
    """An empty string message should still hit Claude and return a response."""
    with patch(
        "app.services.chat_service._call_claude",
        new_callable=AsyncMock,
        return_value="It looks like you sent an empty message. How can I help?",
    ):
        response = await async_client.post(
            "/api/v1/chat/message",
            json={"message": "", "conversation_history": []},
        )

    assert response.status_code == 200
    assert response.json()["response"] != ""
