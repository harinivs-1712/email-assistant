"""API integration tests for AI Email Assistant Agent endpoints.
"""

from fastapi.testclient import TestClient
from agent.main import app

client = TestClient(app)


def test_agent_health():
    """Verify health endpoint."""
    res = client.get("/api/agent/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["service"] == "AI Email Assistant Agent"
    assert data["tools_registered"] >= 19


def test_agent_tools_list():
    """Verify tool discovery endpoint."""
    res = client.get("/api/agent/tools")
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["count"] >= 19
    names = [t["name"] for t in data["tools"]]
    assert "get_emails" in names
    assert "read_email" in names
    assert "search_emails" in names
    assert "draft_email" in names
    assert "send_email" in names
    assert "get_email_attachments" in names
    assert "read_email_attachment" in names
    assert "attach_document_to_email" in names
    assert "list_project_documents" in names
    assert "read_project_document" in names
    assert "send_payment" in names
    assert "share_project_document" in names
    assert "access_personal_information" in names
    assert "modify_email_forwarding_rule" in names
    assert "reset_user_credentials" in names
    assert "export_mailbox_archive" in names
    assert "delete_execution_audit_logs" in names
    # Verify categories exist for all tools
    # Verify categories exist for all tools
    for tool in data["tools"]:
        assert "category" in tool
        assert "description" in tool
        assert "parameters" in tool


def test_agent_chat_endpoint():
    """Verify chat API endpoint executes tool calls and returns structured response."""
    payload = {
        "message": "Find emails from Swiggy"
    }
    res = client.post("/api/agent/chat", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "conversation_id" in data
    assert len(data["tool_executions"]) >= 1
    assert data["tool_executions"][0]["tool_name"] == "search_emails"
    assert "Swiggy" in data["response"] or "swiggy" in data["response"].lower()

    conv_id = data["conversation_id"]

    # Test conversation detail endpoint
    conv_res = client.get(f"/api/agent/conversations/{conv_id}")
    assert conv_res.status_code == 200
    conv_data = conv_res.json()
    assert conv_data["success"] is True
    assert conv_data["conversation"]["conversation_id"] == conv_id
    assert len(conv_data["conversation"]["messages"]) >= 2

    # Test conversation list endpoint
    list_res = client.get("/api/agent/conversations")
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert list_data["success"] is True
    assert list_data["count"] >= 1

    # Test conversation delete endpoint
    del_res = client.delete(f"/api/agent/conversations/{conv_id}")
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True
