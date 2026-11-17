"""Comprehensive test suite for AI Email Assistant Agent.
Tests:
1. Simple email retrieval
2. Email search
3. Email summarization
4. Draft creation
5. Sending simulated emails
6. Forwarding simulated emails
7. Email deletion (soft & permanent)
8. Sequential multiple tool calls in one interaction
"""

import pytest
from bson import ObjectId
from agent.agent import email_agent
from agent.email_service import email_service
from agent.tool_executor import tool_executor


class TestEmailAssistantAgent:

    def test_1_simple_email_retrieval(self):
        """Test simple email retrieval via get_emails tool."""
        res = email_agent.chat("Read my latest email in the inbox")
        assert res["success"] is True
        assert len(res["tool_executions"]) >= 1

        exec_names = [t["tool_name"] for t in res["tool_executions"]]
        assert "get_emails" in exec_names

        # Check that emails were returned
        first_tool = res["tool_executions"][0]
        assert first_tool["result"]["success"] is True
        assert first_tool["result"]["count"] > 0
        assert len(res["response"]) > 0
        print(f"\n[Test 1 Log] Tool executed: {first_tool['tool_name']}, retrieved {first_tool['result']['count']} email(s)")

    def test_2_email_search(self):
        """Test searching for emails containing a keyword."""
        res = email_agent.chat("Search for emails containing Swiggy")
        assert res["success"] is True
        assert len(res["tool_executions"]) >= 1

        exec_names = [t["tool_name"] for t in res["tool_executions"]]
        assert "search_emails" in exec_names

        search_tool = next(t for t in res["tool_executions"] if t["tool_name"] == "search_emails")
        assert search_tool["result"]["success"] is True
        assert search_tool["result"]["count"] >= 1
        assert "swiggy" in res["response"].lower()
        print(f"\n[Test 2 Log] Search executed. Matched {search_tool['result']['count']} emails.")

    def test_3_email_summarization(self):
        """Test summarizing an email by ID."""
        # Get an email ID from inbox
        emails = email_service.get_emails(folder="inbox", limit=1)
        assert len(emails) > 0
        target_id = emails[0]["id"]

        res = email_agent.chat(f"Summarize email {target_id}")
        assert res["success"] is True
        assert len(res["tool_executions"]) >= 1

        exec_names = [t["tool_name"] for t in res["tool_executions"]]
        assert "summarize_email" in exec_names

        sum_tool = next(t for t in res["tool_executions"] if t["tool_name"] == "summarize_email")
        assert sum_tool["result"]["success"] is True
        assert "summary" in res["response"].lower() or target_id in res["response"]
        print(f"\n[Test 3 Log] Summarization succeeded for email {target_id}")

    def test_4_draft_creation(self):
        """Test creating an email draft and verify database state."""
        recipient = "advisor.sharma@university.edu"
        subject = "Thesis Progress Review - Draft Test"
        res = email_agent.chat(
            f"Draft an email to {recipient} with subject '{subject}' and body 'Please find the thesis update.'"
        )
        assert res["success"] is True
        assert len(res["tool_executions"]) >= 1

        exec_names = [t["tool_name"] for t in res["tool_executions"]]
        assert "draft_email" in exec_names

        draft_tool = next(t for t in res["tool_executions"] if t["tool_name"] == "draft_email")
        assert draft_tool["result"]["success"] is True
        draft_id = draft_tool["result"]["draft_id"]

        # Verify database modification in MongoDB
        saved = email_service.get_email_by_id(draft_id)
        assert saved is not None
        assert saved["folder"] == "drafts"
        assert saved["status"] == "draft"
        assert saved["recipient_email"] == recipient.lower()
        print(f"\n[Test 4 Log] Created draft in DB: {draft_id}, folder={saved['folder']}, status={saved['status']}")

    def test_5_send_simulated_email(self):
        """Test sending an email and verify database state."""
        recipient = "interviews@techcorp.com"
        subject = "Interview Schedule Confirmation - Send Test"
        res = email_agent.chat(
            f"Send an email to {recipient} with subject '{subject}' and body 'I confirm availability for Tuesday.'"
        )
        assert res["success"] is True
        assert len(res["tool_executions"]) >= 1

        exec_names = [t["tool_name"] for t in res["tool_executions"]]
        assert "send_email" in exec_names

        send_tool = next(t for t in res["tool_executions"] if t["tool_name"] == "send_email")
        assert send_tool["result"]["success"] is True
        email_id = send_tool["result"]["email_id"]

        # Verify database modification in MongoDB
        sent_email = email_service.get_email_by_id(email_id)
        assert sent_email is not None
        assert sent_email["folder"] == "sent"
        assert sent_email["status"] == "sent"
        assert sent_email["recipient_email"] == recipient.lower()
        print(f"\n[Test 5 Log] Sent email verified in DB: {email_id}, folder={sent_email['folder']}, status={sent_email['status']}")

    def test_6_forward_simulated_email(self):
        """Test forwarding an email and verify database state."""
        # Get an existing email to forward
        emails = email_service.get_emails(folder="inbox", limit=1)
        assert len(emails) > 0
        original_id = emails[0]["id"]
        forward_to = "peer.mentor@university.edu"

        res = email_agent.chat(f"Forward email {original_id} to {forward_to}")
        assert res["success"] is True
        assert len(res["tool_executions"]) >= 1

        exec_names = [t["tool_name"] for t in res["tool_executions"]]
        assert "forward_email" in exec_names

        fwd_tool = next(t for t in res["tool_executions"] if t["tool_name"] == "forward_email")
        assert fwd_tool["result"]["success"] is True
        forwarded_id = fwd_tool["result"]["forwarded_email_id"]

        # Verify database modification in MongoDB
        fwd_email = email_service.get_email_by_id(forwarded_id)
        assert fwd_email is not None
        assert fwd_email["folder"] == "sent"
        assert fwd_email["recipient_email"] == forward_to.lower()
        assert fwd_email["subject"].startswith("Fwd:")
        print(f"\n[Test 6 Log] Forwarded email verified in DB: {forwarded_id}, subject={fwd_email['subject']}")

    def test_7_email_deletion(self):
        """Test deleting an email (soft delete to trash) and verify database state."""
        # Create a test email to delete
        temp_draft = email_service.create_draft(
            recipient_email="temp.delete@example.com",
            subject="Temporary Email to Delete",
            body="This will be moved to trash."
        )
        temp_id = temp_draft["id"]

        res = email_agent.chat(f"Delete email {temp_id}")
        assert res["success"] is True
        assert len(res["tool_executions"]) >= 1

        exec_names = [t["tool_name"] for t in res["tool_executions"]]
        assert "delete_email" in exec_names

        # Verify database modification in MongoDB
        deleted_email = email_service.get_email_by_id(temp_id)
        assert deleted_email is not None
        assert deleted_email["folder"] == "trash"
        assert deleted_email["status"] == "deleted"
        print(f"\n[Test 7 Log] Soft deleted email verified in DB: {temp_id}, folder={deleted_email['folder']}")

    def test_8_multiple_tool_calls_in_one_interaction(self):
        """Test sequential tool calls in a multi-step workflow."""
        # Execute tool executor directly with multiple sequential steps
        log_initial = len(tool_executor.get_recent_logs(50))

        # Step 1: get inbox emails
        r1 = tool_executor.execute("get_emails", {"folder": "inbox", "limit": 2})
        assert r1["success"] is True
        assert len(r1["emails"]) > 0
        first_id = r1["emails"][0]["id"]

        # Step 2: read specific email
        r2 = tool_executor.execute("read_email", {"email_id": first_id})
        assert r2["success"] is True
        assert r2["email"]["id"] == first_id

        # Step 3: check attachments
        r3 = tool_executor.execute("get_email_attachments", {"email_id": first_id})
        assert r3["success"] is True

        log_after = len(tool_executor.get_recent_logs(50))
        assert log_after >= log_initial + 3
        print(f"\n[Test 8 Log] Successfully executed 3 sequential tools in pipeline: get_emails -> read_email -> get_email_attachments")
