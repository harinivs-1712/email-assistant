"""Safe, modular tool executor for AI Email Assistant.
Handles parameter validation, tool execution, telemetry/logging, lifecycle tracking,
and integration-ready external firewall authorization hooks.
"""

from datetime import datetime, timezone
import time
from typing import Any, Callable, Dict, List, Optional
from agent.tool_registry import get_registered_tool
from agent.structured_logger import structured_logger


class ToolExecutionLog:
    def __init__(
        self,
        tool_name: str,
        arguments: Dict[str, Any],
        start_time: str,
        end_time: str,
        duration_ms: float,
        status: str,
        success: bool,
        result: Any,
        error: Optional[str] = None,
        conversation_id: Optional[str] = None,
        email_id: Optional[str] = None,
        doc_id: Optional[str] = None,
    ):
        self.tool_name = tool_name
        self.arguments = arguments
        self.start_time = start_time
        self.end_time = end_time
        self.duration_ms = duration_ms
        self.status = status  # 'TOOL_REQUESTED', 'TOOL_EXECUTED', 'TOOL_FAILED', 'TOOL_BLOCKED'
        self.success = success
        self.result = result
        self.error = error
        self.conversation_id = conversation_id
        self.email_id = email_id
        self.doc_id = doc_id

    def to_dict(self) -> Dict[str, Any]:
        return {
            "tool_name": self.tool_name,
            "arguments": self.arguments,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "duration_ms": self.duration_ms,
            "status": self.status,
            "success": self.success,
            "result": self.result,
            "error": self.error,
            "conversation_id": self.conversation_id,
            "email_id": self.email_id,
            "doc_id": self.doc_id,
        }


class ToolExecutor:
    """Executes tools with modular interception hooks for security inspection/firewalls.
    Supports external firewall authorization middleware to intercept and deny tool calls before DB writes.
    """

    def __init__(self):
        # External firewall authorizer hook: Callable[[tool_name, arguments, conversation_id], Dict[str, Any]]
        # Return {"allowed": True} or {"allowed": False, "reason": "..."}
        self.firewall_authorizer: Optional[Callable[[str, Dict[str, Any], Optional[str]], Dict[str, Any]]] = None
        # Additional pre-hooks
        self.pre_hooks: List[Callable[[str, Dict[str, Any]], Optional[Dict[str, Any]]]] = []
        # In-memory execution history logs
        self.execution_logs: List[ToolExecutionLog] = []

    def set_firewall_authorizer(
        self,
        authorizer: Optional[Callable[[str, Dict[str, Any], Optional[str]], Dict[str, Any]]]
    ):
        """Register or clear the external firewall authorization middleware hook.
        
        The authorizer function signature:
            authorizer(tool_name: str, arguments: Dict[str, Any], conversation_id: Optional[str]) -> Dict[str, Any]
        Expected return:
            {"allowed": True} to permit execution, or
            {"allowed": False, "reason": "Explanation"} to block execution prior to DB modification.
        """
        self.firewall_authorizer = authorizer
        print(f"🛡️ [ToolExecutor] External firewall authorizer {'configured' if authorizer else 'cleared'}.")

    def register_pre_hook(self, hook: Callable[[str, Dict[str, Any]], Optional[Dict[str, Any]]]):
        """Register a general pre-execution inspection hook."""
        self.pre_hooks.append(hook)

    def execute(
        self,
        tool_name: str,
        arguments: Optional[Dict[str, Any]] = None,
        conversation_id: Optional[str] = None,
        email_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Execute a tool safely through the authorization hook, recording lifecycle telemetry.
        
        Lifecycle States:
            - TOOL_REQUESTED: Captured at start of invocation
            - TOOL_BLOCKED: Intercepted and rejected by external firewall before execution
            - TOOL_EXECUTED: Successfully executed by the underlying function
            - TOOL_FAILED: Execution threw an error or validation failed
        """
        args = arguments or {}
        start_dt = datetime.now(timezone.utc)
        start_t = time.perf_counter()
        inferred_doc_id = args.get("doc_id")
        inferred_email_id = email_id or args.get("email_id")

        print(f"🔧 [ToolExecutor] Status: TOOL_REQUESTED for {tool_name}({args})")

        # ─── 1. External Firewall Authorization Hook ───────────────────────────
        if self.firewall_authorizer is not None:
            try:
                auth_res = self.firewall_authorizer(tool_name, args, conversation_id)
                if isinstance(auth_res, dict) and not auth_res.get("allowed", True):
                    # Authorization DENIED by external firewall: prevent all database modifications
                    end_dt = datetime.now(timezone.utc)
                    duration_ms = round((time.perf_counter() - start_t) * 1000, 2)
                    block_reason = auth_res.get("reason", "Blocked by external prompt injection firewall.")
                    blocked_result = {
                        "success": False,
                        "blocked": True,
                        "status": "TOOL_BLOCKED",
                        "error": block_reason,
                    }

                    log_entry = ToolExecutionLog(
                        tool_name=tool_name,
                        arguments=args,
                        start_time=start_dt.isoformat(),
                        end_time=end_dt.isoformat(),
                        duration_ms=duration_ms,
                        status="TOOL_BLOCKED",
                        success=False,
                        result=blocked_result,
                        error=block_reason,
                        conversation_id=conversation_id,
                        email_id=inferred_email_id,
                        doc_id=inferred_doc_id,
                    )
                    self.execution_logs.append(log_entry)
                    structured_logger.log_tool_execution(
                        tool_name=tool_name,
                        arguments=args,
                        execution_result=blocked_result,
                        duration_ms=duration_ms,
                        conversation_id=conversation_id,
                        email_id=inferred_email_id,
                        error=block_reason,
                        status="TOOL_BLOCKED",
                    )
                    print(f"🛑 [ToolExecutor] Status: TOOL_BLOCKED for {tool_name} - Reason: {block_reason}")
                    return blocked_result

            except Exception as auth_err:
                print(f"⚠️ [ToolExecutor] Firewall authorizer exception: {auth_err}")

        # ─── 2. Additional Pre-hooks ──────────────────────────────────────────
        for hook in self.pre_hooks:
            try:
                hook_res = hook(tool_name, args)
                if hook_res is not None:
                    end_dt = datetime.now(timezone.utc)
                    duration_ms = round((time.perf_counter() - start_t) * 1000, 2)
                    log_entry = ToolExecutionLog(
                        tool_name=tool_name,
                        arguments=args,
                        start_time=start_dt.isoformat(),
                        end_time=end_dt.isoformat(),
                        duration_ms=duration_ms,
                        status="TOOL_BLOCKED",
                        success=False,
                        result=hook_res,
                        error="Execution intercepted by middleware hook",
                        conversation_id=conversation_id,
                        email_id=inferred_email_id,
                        doc_id=inferred_doc_id,
                    )
                    self.execution_logs.append(log_entry)
                    structured_logger.log_tool_execution(
                        tool_name=tool_name,
                        arguments=args,
                        execution_result=hook_res,
                        duration_ms=duration_ms,
                        conversation_id=conversation_id,
                        email_id=inferred_email_id,
                        error="Execution intercepted by middleware hook",
                        status="TOOL_BLOCKED",
                    )
                    return hook_res
            except Exception as hook_err:
                print(f"⚠️ [ToolExecutor] Pre-hook warning: {hook_err}")

        # ─── 3. Lookup Registered Tool Function ────────────────────────────────
        tool_fn = get_registered_tool(tool_name)
        if not tool_fn:
            end_dt = datetime.now(timezone.utc)
            duration_ms = round((time.perf_counter() - start_t) * 1000, 2)
            error_msg = f"Unknown tool: '{tool_name}'."
            result = {"success": False, "error": error_msg}
            log_entry = ToolExecutionLog(
                tool_name=tool_name,
                arguments=args,
                start_time=start_dt.isoformat(),
                end_time=end_dt.isoformat(),
                duration_ms=duration_ms,
                status="TOOL_FAILED",
                success=False,
                result=result,
                error=error_msg,
                conversation_id=conversation_id,
                email_id=inferred_email_id,
                doc_id=inferred_doc_id,
            )
            self.execution_logs.append(log_entry)
            structured_logger.log_tool_execution(
                tool_name=tool_name,
                arguments=args,
                execution_result=result,
                duration_ms=duration_ms,
                conversation_id=conversation_id,
                email_id=inferred_email_id,
                error=error_msg,
                status="TOOL_FAILED",
            )
            return result

        # ─── 4. Execute the Tool Function ─────────────────────────────────────
        try:
            raw_result = tool_fn(**args)
            end_dt = datetime.now(timezone.utc)
            duration_ms = round((time.perf_counter() - start_t) * 1000, 2)

            is_success = isinstance(raw_result, dict) and raw_result.get("success", True)
            final_status = "TOOL_EXECUTED" if is_success else "TOOL_FAILED"

            log_entry = ToolExecutionLog(
                tool_name=tool_name,
                arguments=args,
                start_time=start_dt.isoformat(),
                end_time=end_dt.isoformat(),
                duration_ms=duration_ms,
                status=final_status,
                success=is_success,
                result=raw_result,
                error=raw_result.get("error") if isinstance(raw_result, dict) and not is_success else None,
                conversation_id=conversation_id,
                email_id=inferred_email_id,
                doc_id=inferred_doc_id,
            )
            self.execution_logs.append(log_entry)

            # Persist to structured database logs
            structured_logger.log_tool_execution(
                tool_name=tool_name,
                arguments=args,
                execution_result=raw_result,
                duration_ms=duration_ms,
                conversation_id=conversation_id,
                email_id=inferred_email_id,
                error=raw_result.get("error") if isinstance(raw_result, dict) and not is_success else None,
                status=final_status,
            )

            icon = "✅" if is_success else "⚠️"
            print(f"{icon} [ToolExecutor] Status: {final_status} for {tool_name} in {duration_ms}ms (success={is_success})")
            return raw_result

        except TypeError as type_err:
            end_dt = datetime.now(timezone.utc)
            duration_ms = round((time.perf_counter() - start_t) * 1000, 2)
            err_result = {"success": False, "error": f"Invalid arguments for {tool_name}: {str(type_err)}"}
            log_entry = ToolExecutionLog(
                tool_name=tool_name,
                arguments=args,
                start_time=start_dt.isoformat(),
                end_time=end_dt.isoformat(),
                duration_ms=duration_ms,
                status="TOOL_FAILED",
                success=False,
                result=err_result,
                error=str(type_err),
                conversation_id=conversation_id,
                email_id=inferred_email_id,
                doc_id=inferred_doc_id,
            )
            self.execution_logs.append(log_entry)
            structured_logger.log_tool_execution(
                tool_name=tool_name,
                arguments=args,
                execution_result=err_result,
                duration_ms=duration_ms,
                conversation_id=conversation_id,
                email_id=inferred_email_id,
                error=str(type_err),
                status="TOOL_FAILED",
            )
            print(f"❌ [ToolExecutor] Status: TOOL_FAILED for {tool_name} (TypeError): {type_err}")
            return err_result

        except Exception as exc:
            end_dt = datetime.now(timezone.utc)
            duration_ms = round((time.perf_counter() - start_t) * 1000, 2)
            err_result = {"success": False, "error": f"Error executing {tool_name}: {str(exc)}"}
            log_entry = ToolExecutionLog(
                tool_name=tool_name,
                arguments=args,
                start_time=start_dt.isoformat(),
                end_time=end_dt.isoformat(),
                duration_ms=duration_ms,
                status="TOOL_FAILED",
                success=False,
                result=err_result,
                error=str(exc),
                conversation_id=conversation_id,
                email_id=inferred_email_id,
                doc_id=inferred_doc_id,
            )
            self.execution_logs.append(log_entry)
            structured_logger.log_tool_execution(
                tool_name=tool_name,
                arguments=args,
                execution_result=err_result,
                duration_ms=duration_ms,
                conversation_id=conversation_id,
                email_id=inferred_email_id,
                error=str(exc),
                status="TOOL_FAILED",
            )
            print(f"❌ [ToolExecutor] Status: TOOL_FAILED for {tool_name}: {exc}")
            return err_result

    def get_recent_logs(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Get recently recorded tool execution logs."""
        return [log.to_dict() for log in self.execution_logs[-limit:]]

    def clear_logs(self):
        """Clear execution logs in memory."""
        self.execution_logs.clear()


# Default singleton executor
tool_executor = ToolExecutor()
