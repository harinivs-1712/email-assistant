"""AI Email Assistant Agent.
Coordinates multi-turn conversations, tool calling loops, Gemini interactions,
and telemetry logging.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import uuid

from agent.conversation_manager import conversation_manager
from agent.gemini_service import gemini_service
from agent.system_prompt import EMAIL_ASSISTANT_SYSTEM_PROMPT
from agent.tool_executor import tool_executor


class EmailAssistantAgent:
    def __init__(
        self,
        max_tool_iterations: int = 8,
        system_prompt: str = EMAIL_ASSISTANT_SYSTEM_PROMPT
    ):
        self.max_tool_iterations = max_tool_iterations
        self.system_prompt = system_prompt

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
            conversation_turns.append({
                "role": h.get("role", "user"),
                "content": h.get("content", ""),
                "tool_calls": h.get("tool_calls", []),
                "tool_results": h.get("tool_results", [])
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
