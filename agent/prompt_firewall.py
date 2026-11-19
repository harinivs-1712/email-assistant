"""Bridge the Email Assistant to the prompt-injection-firewall audit store."""
from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any
from uuid import uuid4


class PromptFirewall:
    def __init__(self) -> None:
        self.sessions_by_conversation: dict[str, str] = {}
        root = Path(os.getenv(
            "PROMPT_FIREWALL_PATH",
            r"C:\Users\RAHUL S\Downloads\prompt-injection-firewall",
        )).expanduser().resolve()
        if str(root) not in sys.path:
            sys.path.insert(0, str(root))

        from firewall.adapters.layer1 import Layer1Scanner
        from firewall.api import Firewall
        from firewall.audit import SQLiteAuditStore

        audit_path = Path(os.getenv(
            "FIREWALL_AUDIT_DB", str(root / "var" / "demo" / "audit.sqlite")
        )).expanduser().resolve()
        audit_path.parent.mkdir(parents=True, exist_ok=True)
        self.audit = SQLiteAuditStore(audit_path, store_user_task=False)
        self.firewall = Firewall(
            {
                "policy_version": "email-assistant-v1",
                "agent_name": "Email Assistant",
                "tools": {},
            },
            scanner=Layer1Scanner(
                mode=os.getenv("PROMPT_FIREWALL_JUDGE_MODE", "cascade"),
                offline_cache_only=os.getenv("PROMPT_FIREWALL_LIVE_SCAN", "0").casefold() not in {"1", "true", "yes"},
            ),
            audit_sink=self.audit,
        )

    def start_session(self, task: str, conversation_id: str | None = None):
        session = self.firewall.start_session(task)
        if conversation_id:
            self.sessions_by_conversation[conversation_id] = session.session_id
        return session

    def record_tool_detection(self, tool_name: str, conversation_id: str | None, reason: str) -> None:
        code = "TOOL_NOT_ALLOWED_FOR_TASK"
        if "payment" in tool_name:
            code = "ALWAYS_ASK_TOOL"
        self.audit.record({
            "event_type": "tool_check",
            "session_id": self.sessions_by_conversation.get(conversation_id or "", new_scan_id("firewall")),
            "tool": tool_name,
            "tool_name": tool_name,
            "action": "block",
            "reason_codes": [code],
            "rule_ids": ["EMAIL_ASSISTANT_GUARD"],
            "argument_names": [],
            "link_level": "NONE",
            "evidence": [],
            "user_provided_args": [],
        })

    def scan(self, session: Any, content: str, *, source: str, doc_id: str):
        if not content or not content.strip():
            return None
        outcome = self.firewall.scan_content(
            session, content, source, doc_id=doc_id,
            context_note="Untrusted content processed by the Email Assistant.",
        )
        levels = {name: 0 for name in ("none", "low", "medium", "high", "needs_review")}
        for segment in outcome.segments:
            levels[segment.suspicion_level] += 1
        rank = {"none": 0, "low": 1, "medium": 2, "needs_review": 3, "high": 4}
        max_level = max(levels, key=lambda level: rank[level])
        flagged = max_level in {"medium", "high", "needs_review"}
        self.audit.record({
            "event_type": "tool_output_inspection",
            "session_id": session.session_id,
            "tool": "email_content_scan" if source == "email" else "assistant_input_scan",
            "action": "hold" if max_level == "high" else "pass",
            "reason_codes": ["OUTPUT_HELD" if max_level == "high" else "OUTPUT_UNREVIEWED"] if flagged else ["OUTPUT_PASSED"],
            "output_id": doc_id,
            "max_level": max_level,
            "level_counts": levels,
            "segment_ids": [s.segment_id for s in outcome.segments],
            "unreviewed_segment_ids": [s.segment_id for s in outcome.segments if not s.judge_ran or s.suspicion_level == "needs_review"],
            "unscanned_chars": 0,
            "judge_calls_made": outcome.judge_calls_made,
        })
        return outcome

    def scan_tool_result(self, session: Any, tool_name: str, result: Any):
        def collect_text(value):
            if isinstance(value, str):
                return [value]
            if isinstance(value, dict):
                return [part for child in value.values() for part in collect_text(child)]
            if isinstance(value, (list, tuple)):
                return [part for child in value for part in collect_text(child)]
            return []

        content = "\n".join(collect_text(result))
        if not content.strip():
            return result
        outcome = self.scan(
            session, content, source="tool_output", doc_id=new_scan_id("tool-output")
        )
        if outcome and any(segment.suspicion_level == "high" for segment in outcome.segments):
            return {
                "success": False,
                "blocked": True,
                "error": f"The firewall withheld {tool_name} content because it detected a high risk prompt injection.",
            }
        return result


_prompt_firewall: PromptFirewall | None = None


def get_prompt_firewall() -> PromptFirewall:
    global _prompt_firewall
    if _prompt_firewall is None:
        _prompt_firewall = PromptFirewall()
    return _prompt_firewall


def new_scan_id(prefix: str) -> str:
    return f"{prefix}-{uuid4().hex[:12]}"
