"""Structured execution logger for AI Email Assistant.
Records all tool invocations, arguments, returned data, and execution context
into MongoDB ('agent_execution_logs' collection) independently from email records.
"""

from datetime import datetime, timezone
import os
from typing import Any, Dict, List, Optional
from pymongo import MongoClient, DESCENDING

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/email_assistant")
DB_NAME = os.getenv("DB_NAME", "email_assistant")


class StructuredExecutionLogger:
    def __init__(self, uri: str = MONGO_URI, db_name: str = DB_NAME):
        self.client = MongoClient(uri, serverSelectionTimeoutMS=5000)
        self.db = self.client[db_name]
        self.collection = self.db["agent_execution_logs"]

    def _extract_data_accessed(self, tool_name: str, arguments: Dict[str, Any], result: Dict[str, Any]) -> List[str]:
        """Determine what specific data items/documents were accessed during this execution."""
        accessed = []
        if tool_name in ("read_email", "summarize_email", "delete_email", "mark_email_as_read", "get_email_attachments"):
            if "email_id" in arguments:
                accessed.append(f"email:{arguments['email_id']}")
        elif tool_name == "get_emails":
            folder = arguments.get("folder", "inbox")
            accessed.append(f"folder:{folder}")
            if result.get("emails"):
                for em in result["emails"][:5]:
                    accessed.append(f"email:{em.get('id')}")
        elif tool_name == "search_emails":
            query = arguments.get("query", "")
            accessed.append(f"search_query:{query}")
            if result.get("results"):
                for em in result["results"][:5]:
                    accessed.append(f"email:{em.get('id')}")
        elif tool_name == "read_project_document":
            if "doc_id" in arguments:
                accessed.append(f"project_doc:{arguments['doc_id']}")
        elif tool_name == "list_project_documents":
            accessed.append("project_documents:catalog")
        elif tool_name in ("send_email", "forward_email", "draft_email"):
            if "recipient_email" in arguments:
                accessed.append(f"recipient:{arguments['recipient_email']}")
            if "forward_to" in arguments:
                accessed.append(f"forward_to:{arguments['forward_to']}")
            if "email_id" in arguments:
                accessed.append(f"email:{arguments['email_id']}")
        elif tool_name == "send_payment":
            if "recipient_name" in arguments:
                accessed.append(f"payment_recipient:{arguments['recipient_name']}")
            if "recipient_account" in arguments:
                accessed.append(f"account:{arguments['recipient_account']}")
            if "amount" in arguments:
                accessed.append(f"amount:${arguments['amount']}")
        elif tool_name == "share_project_document":
            if "doc_id" in arguments:
                accessed.append(f"project_doc:{arguments['doc_id']}")
            if "recipient_email" in arguments:
                accessed.append(f"share_recipient:{arguments['recipient_email']}")
        elif tool_name == "access_personal_information":
            if "record_id" in arguments:
                accessed.append(f"personal_record:{arguments['record_id']}")
            if "requested_fields" in arguments and isinstance(arguments["requested_fields"], list):
                accessed.append(f"fields:{','.join(arguments['requested_fields'])}")
        elif tool_name == "modify_email_forwarding_rule":
            if "forwarding_email" in arguments:
                accessed.append(f"forwarding_target:{arguments['forwarding_email']}")
        elif tool_name == "reset_user_credentials":
            if "user_identifier" in arguments:
                accessed.append(f"target_account:{arguments['user_identifier']}")
        elif tool_name == "export_mailbox_archive":
            if "target_destination" in arguments:
                accessed.append(f"export_target:{arguments['target_destination']}")
        elif tool_name == "delete_execution_audit_logs":
            if "filter_criteria" in arguments:
                accessed.append(f"purge_criteria:{arguments['filter_criteria']}")

        return accessed

    def log_tool_execution(
        self,
        tool_name: str,
        arguments: Dict[str, Any],
        execution_result: Any,
        duration_ms: float,
        conversation_id: Optional[str] = None,
        email_id: Optional[str] = None,
        error: Optional[str] = None,
        status: str = "TOOL_EXECUTED",
    ) -> Dict[str, Any]:
        """Record structured tool call execution details into MongoDB."""
        now = datetime.now(timezone.utc)
        result_dict = execution_result if isinstance(execution_result, dict) else {"raw": str(execution_result)}

        # Extract email_id or doc_id from arguments if not explicitly provided
        inferred_email_id = email_id or arguments.get("email_id")
        inferred_doc_id = arguments.get("doc_id")
        data_accessed = self._extract_data_accessed(tool_name, arguments, result_dict)

        entry = {
            "tool_name": tool_name,
            "arguments": arguments,
            "execution_result": result_dict,
            "status": status,
            "success": result_dict.get("success", error is None and status == "TOOL_EXECUTED"),
            "error": error or result_dict.get("error"),
            "duration_ms": duration_ms,
            "timestamp": now.isoformat(),
            "conversation_id": conversation_id,
            "email_id": inferred_email_id,
            "doc_id": inferred_doc_id,
            "data_accessed": data_accessed,
        }

        try:
            self.collection.insert_one(dict(entry))
        except Exception as e:
            print(f"⚠️ [StructuredLogger] Failed to write log to MongoDB: {e}")

        return entry

    def get_logs(
        self,
        conversation_id: Optional[str] = None,
        tool_name: Optional[str] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """Retrieve recent structured execution logs."""
        query = {}
        if conversation_id:
            query["conversation_id"] = conversation_id
        if tool_name:
            query["tool_name"] = tool_name

        cursor = self.collection.find(query, {"_id": 0}).sort("timestamp", DESCENDING).limit(limit)
        return list(cursor)

    def clear_logs(self):
        """Clear execution logs."""
        self.collection.delete_many({})


# Singleton instance
structured_logger = StructuredExecutionLogger()
