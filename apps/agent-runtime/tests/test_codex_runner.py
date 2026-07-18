from app.codex_runner import final_agent_message, request_is_authorized


def test_runner_secret_comparison_requires_both_values() -> None:
    assert request_is_authorized("secret", "secret") is True
    assert request_is_authorized("wrong", "secret") is False
    assert request_is_authorized(None, "secret") is False


def test_final_agent_message_only_accepts_completed_final_text() -> None:
    assert final_agent_message({"method": "item/completed", "params": {"item": {"type": "agentMessage", "phase": "final_answer", "text": "{\"ok\":true}"}}}) == '{"ok":true}'
    assert final_agent_message({"method": "item/completed", "params": {"item": {"type": "agentMessage", "phase": "commentary", "text": "working"}}}) is None
    assert final_agent_message({"method": "turn/completed", "params": {}}) is None
