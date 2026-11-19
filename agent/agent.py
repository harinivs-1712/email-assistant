"""AI Email Assistant Agent.
Coordinates multi-turn conversations, tool calling loops, Gemini interactions,
and telemetry logging.
"""

from datetime import datetime, timezone
import re
from typing import Any, Dict, List, Optional
import uuid

from agent.conversation_manager import conversation_manager
from agent.gemini_service import gemini_service
from agent.system_prompt import EMAIL_ASSISTANT_SYSTEM_PROMPT
from agent.tool_executor import tool_executor
from agent.prompt_firewall import get_prompt_firewall, new_scan_id
from agent.firewall_manager import firewall_manager


class EmailAssistantAgent:
    def __init__(
        self,
        max_tool_iterations: int = 8,
        system_prompt: str = EMAIL_ASSISTANT_SYSTEM_PROMPT
    ):
        self.max_tool_iterations = max_tool_iterations
        self.system_prompt = system_prompt

    @staticmethod
    def _is_raw_tool_dump(response: Optional[str]) -> bool:
        if not isinstance(response, str):
            return False
        text = response.lstrip().lower()
        if "result from" in text[:1000] and "{" in text[:1500]:
            return True
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\s*", "", text)
        if text.startswith("{") and any(
            marker in text[:1500] for marker in (
                '"emails"', '"sender_email"', '"success"', '"results"',
                '"tool_name"', '"email"',
            )
        ):
            return True
        # Catch a model that wraps the tool payload in a short sentence.
        return any(marker in text[:1500] for marker in (
            '"emails": [', '"sender_email":', '"tool_name":',
        )) and ("{" in text[:1500] or "```json" in text[:1500])

    @staticmethod
    def _find_requested_email_to_review(
        user_request: str,
        executions: List[Dict[str, Any]],
    ) -> Optional[Dict[str, Any]]:
        """Resolve an explicitly named email from prior list/search results."""
        text = user_request.casefold()
        if not re.search(r"\b(review|read|check|inspect|summari[sz]e)\b", text):
            return None
        if any(item.get("tool_name") == "read_email" for item in executions):
            return None

        target_match = re.search(
            r"\b(?:review|read|check|inspect|summari[sz]e)\s+(?:the\s+)?(.+?)\s+(?:email|message)\b",
            text,
        )
        if not target_match:
            target_match = re.search(
                r"\b(?:email|message)\s+from\s+(.+?)(?:\s+in\s+|\s+and\s+|$)", text
            )
        if not target_match:
            return None

        stop_words = {"the", "my", "a", "an", "in", "from", "present", "inbox", "please"}
        target_terms = {
            token for token in re.findall(r"[a-z0-9]+", target_match.group(1))
            if len(token) > 2 and token not in stop_words
        }
        if not target_terms:
            return None

        candidates = []
        for item in executions:
            result = item.get("result", {})
            if item.get("tool_name") == "get_emails":
                candidates.extend(result.get("emails", []))
            elif item.get("tool_name") == "search_emails":
                candidates.extend(result.get("results", []))

        best_email, best_score = None, 0
        for email in candidates:
            searchable = " ".join(str(email.get(field, "")) for field in (
                "sender_name", "sender_email", "subject", "snippet"
            )).casefold()
            score = sum(term in searchable for term in target_terms)
            if score > best_score:
                best_email, best_score = email, score
        if not best_email or not best_email.get("id"):
            return None
        return {"name": "read_email", "args": {"email_id": best_email["id"]}}

    def chat(
        self,
        message: str,
        conversation_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Execute the complete agent interaction loop for a user message.

        Args:
            message: User's natural language message.
            conversation_id: Optional ID of an existing conversation session.

        Returns:
            Dictionary containing:
                - conversation_id
                - response: Final markdown response text
                - tool_executions: List of tool executions performed in this turn
                - iterations: Number of tool-calling iterations
                - timestamp
        """
        if not message or not message.strip():
            return {
                "success": False,
                "error": "Message cannot be empty.",
                "response": "Please enter a message.",
                "tool_executions": []
            }

        user_input = message.strip()

        # 1. Resolve or create conversation session
        if not conversation_id:
            conv = conversation_manager.create_conversation(title=user_input[:40])
            conv_id = conv["conversation_id"]
        else:
            conv_id = conversation_id
            existing = conversation_manager.get_conversation(conv_id)
            if not existing:
                conv = conversation_manager.create_conversation(title=user_input[:40], conv_id=conv_id)
                conv_id = conv["conversation_id"]

        prompt_firewall = None
        firewall_session = None
        if firewall_manager.enabled:
            prompt_firewall = get_prompt_firewall()
            firewall_session = prompt_firewall.start_session(user_input, conv_id)
            prompt_firewall.scan(
                firewall_session, user_input, source="email",
                doc_id=new_scan_id("user-input"),
            )

        # 2. Record user message in persistent history
        conversation_manager.add_message(
            conversation_id=conv_id,
            role="user",
            content=user_input
        )

        # 3. Load historical messages for context
        history = conversation_manager.get_messages(conv_id)

        # Build message history for Gemini
        conversation_turns: List[Dict[str, Any]] = []
        for h in history:
            stored_tool_results = h.get("tool_results", [])
            if prompt_firewall and firewall_session and isinstance(stored_tool_results, list):
                stored_tool_results = [
                    {
                        **item,
                        "result": prompt_firewall.scan_tool_result(
                            firewall_session,
                            str(item.get("name", "tool_output")),
                            item.get("result"),
                        ),
                    }
                    if isinstance(item, dict) and "result" in item else item
                    for item in stored_tool_results
                ]
            conversation_turns.append({
                "role": h.get("role", "user"),
                "content": h.get("content", ""),
                "tool_calls": h.get("tool_calls", []),
                "tool_results": stored_tool_results
            })

        turn_tool_executions: List[Dict[str, Any]] = []
        final_text_response: Optional[str] = None
        iteration_count = 0

        # 4. Multi-step Tool Execution Loop
        while iteration_count < self.max_tool_iterations:
            iteration_count += 1
            print(f"🔄 [Agent Loop] Iteration {iteration_count} for conversation '{conv_id}'")

            # Call Gemini
            text_response, function_calls = gemini_service.call_gemini(
                messages=conversation_turns,
                system_instruction=self.system_prompt
            )

            # Honor an explicit request to review a named email even if the
            # model only returned a generic inbox listing.
            if not function_calls:
                review_call = self._find_requested_email_to_review(user_input, turn_tool_executions)
                if review_call:
                    function_calls = [review_call]

            # Check if Gemini wants to call tools
            if function_calls:
                print(f"⚡ [Agent Loop] Gemini requested {len(function_calls)} tool call(s): {[fc['name'] for fc in function_calls]}")
                executed_results = []

                for fc in function_calls:
                    fn_name = fc["name"]
                    fn_args = fc.get("args", {})
                    call_id = fc.get("call_id") or str(uuid.uuid4())[:8]

                    # Execute the real tool against MongoDB
                    result = tool_executor.execute(fn_name, fn_args, conversation_id=conv_id)

                    # Scan returned email/document content before it is placed back
                    # into the model context. Audit records contain metadata only.
                    if prompt_firewall and firewall_session and isinstance(result, (dict, list, tuple, str)):
                        result = prompt_firewall.scan_tool_result(firewall_session, fn_name, result)

                    exec_record = {
                        "call_id": call_id,
                        "tool_name": fn_name,
                        "arguments": fn_args,
                        "result": result,
                        "iteration": iteration_count
                    }
                    turn_tool_executions.append(exec_record)
                    executed_results.append({
                        "call_id": call_id,
                        "name": fn_name,
                        "result": result
                    })

                # Append assistant tool calls and model responses to context
                conversation_turns.append({
                    "role": "model",
                    "content": text_response or "",
                    "tool_calls": function_calls
                })
                # Provide tool results back to Gemini in next turn
                conversation_turns.append({
                    "role": "user",
                    "content": "",
                    "tool_results": executed_results
                })

            else:
                # No more tools needed; final answer produced!
                final_text_response = text_response
                print(f"🏁 [Agent Loop] Final response generated on iteration {iteration_count}")
                break

        if not final_text_response:
            final_text_response = (
                "I completed the requested email operations, but was unable to generate a final summary. "
                "Please check your email list."
            )

        # Some model/fallback responses echo the tool payload instead of
        # explaining it. Normalize those at the API boundary so the UI never
        # presents `Result from None` or a raw get_emails JSON object.
        if turn_tool_executions and self._is_raw_tool_dump(final_text_response):
            normalized_results = [
                {
                    "tool_name": execution.get("tool_name"),
                    "result": execution.get("result", {}),
                }
                for execution in turn_tool_executions
            ]
            formatted, _ = gemini_service._format_final_response([
                {"role": "user", "content": user_input},
                {"role": "user", "content": "", "tool_results": normalized_results},
            ])
            if formatted:
                final_text_response = formatted

        # 5. Persist assistant's final response and tool executions in conversation history
        conversation_manager.add_message(
            conversation_id=conv_id,
            role="assistant",
            content=final_text_response,
            tool_calls=[e["tool_name"] for e in turn_tool_executions] if turn_tool_executions else None,
            tool_results=turn_tool_executions if turn_tool_executions else None
        )

        return {
            "success": True,
            "conversation_id": conv_id,
            "response": final_text_response,
            "tool_executions": turn_tool_executions,
            "iterations": iteration_count,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }


# Singleton agent instance
email_agent = EmailAssistantAgent()
