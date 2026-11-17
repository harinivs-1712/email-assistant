"""Tests for the FirewallManager and external firewall package integration.
"""

import pytest
from fastapi.testclient import TestClient

from agent.main import app
from agent.firewall_manager import firewall_manager, register_firewall_package
from agent.tool_executor import tool_executor


@pytest.fixture(autouse=True)
def reset_firewall_state():
    """Ensure firewall is disabled and custom package unregistered before and after each test."""
    firewall_manager.disable()
    firewall_manager.unregister_package()
    tool_executor.set_firewall_authorizer(None)
    yield
    firewall_manager.disable()
    firewall_manager.unregister_package()
    tool_executor.set_firewall_authorizer(None)


client = TestClient(app)


def test_firewall_initial_state_is_absent():
    status = firewall_manager.get_status()
    assert status["enabled"] is False
    assert status["status"] == "ABSENT"
    assert status["mode"] == "DISABLED"


def test_firewall_toggle_and_enable():
    # Toggle to enabled
    s1 = firewall_manager.toggle()
    assert s1["enabled"] is True
    assert s1["status"] == "INCLUDED"
    assert s1["mode"] == "ACTIVE"
    assert tool_executor.firewall_authorizer is not None

    # Toggle to disabled
    s2 = firewall_manager.toggle()
    assert s2["enabled"] is False
    assert s2["status"] == "ABSENT"
    assert s2["mode"] == "DISABLED"
    assert tool_executor.firewall_authorizer is None


def test_firewall_blocks_when_included():
    # 1. When absent (baseline), payment tool executes or succeeds validation
    firewall_manager.disable()
    res_absent = tool_executor.execute(
        tool_name="send_payment",
        arguments={
            "recipient_name": "Tech Corp",
            "recipient_account": "ACC-001",
            "amount": 500.0,
            "purpose": "Hardware invoice",
        },
        conversation_id="test_conv",
    )
    assert res_absent.get("status") != "TOOL_BLOCKED"

    # 2. When included (active), payment tool is intercepted and blocked before DB write
    firewall_manager.enable()
    res_included = tool_executor.execute(
        tool_name="send_payment",
        arguments={
            "recipient_name": "Tech Corp",
            "recipient_account": "ACC-001",
            "amount": 500.0,
            "purpose": "Hardware invoice",
        },
        conversation_id="test_conv",
    )
    assert res_included.get("status") == "TOOL_BLOCKED"
    assert res_included.get("blocked") is True
    assert "Firewall Rule Block" in res_included.get("error", "")


def test_register_custom_firewall_package():
    # Define a custom firewall package
    def my_custom_package(tool_name, arguments, conversation_id):
        if tool_name == "share_project_document" and "untrusted" in arguments.get("recipient_email", ""):
            return {"allowed": False, "reason": "CustomFirewall: Untrusted recipient blocked."}
        return {"allowed": True}

    register_firewall_package(my_custom_package, name="PromptDefense AI v1.0")

    firewall_manager.enable()
    status = firewall_manager.get_status()
    assert status["package_name"] == "PromptDefense AI v1.0"
    assert status["has_custom_package"] is True

    # Call with untrusted recipient
    res = tool_executor.execute(
        tool_name="share_project_document",
        arguments={"doc_id": "DOC_BUDGET", "recipient_email": "untrusted@attacker.com"},
        conversation_id="test_conv",
    )
    assert res.get("status") == "TOOL_BLOCKED"
    assert "CustomFirewall: Untrusted recipient blocked." in res.get("error", "")


def test_firewall_api_endpoints():
    # 1. GET status
    r_get = client.get("/api/agent/firewall")
    assert r_get.status_code == 200
    assert r_get.json()["status"] == "ABSENT"

    # 2. POST toggle (turn ON)
    r_toggle = client.post("/api/agent/firewall/toggle")
    assert r_toggle.status_code == 200
    assert r_toggle.json()["status"] == "INCLUDED"
    assert r_toggle.json()["enabled"] is True

    # 3. POST set explicitly (turn OFF)
    r_set = client.post("/api/agent/firewall/set", json={"enabled": False})
    assert r_set.status_code == 200
    assert r_set.json()["status"] == "ABSENT"
    assert r_set.json()["enabled"] is False
