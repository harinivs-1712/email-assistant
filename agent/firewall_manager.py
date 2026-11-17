"""Firewall Manager for AI Email Assistant.

Manages the inclusion (Active) or absence (Disabled) of the security firewall authorizer
for tool calls. Supports dynamically plugging in external prompt injection firewall packages.

Example usage when importing an external firewall package:
    from agent.firewall_manager import register_firewall_package

    def my_custom_firewall(tool_name: str, arguments: dict, conversation_id: str) -> dict:
        # Custom inspection logic...
        if suspicious:
            return {"allowed": False, "reason": "Blocked by MyFirewall"}
        return {"allowed": True}

    register_firewall_package(my_custom_firewall, name="MyFirewall v1.0")
"""

from typing import Any, Callable, Dict, Optional
from agent.tool_executor import tool_executor

# Type alias for firewall authorizer hook: (tool_name, arguments, conversation_id) -> dict
FirewallAuthorizer = Callable[[str, Dict[str, Any], Optional[str]], Dict[str, Any]]


class FirewallManager:
    """Central controller for the security firewall middleware.
    
    Toggles between:
      - INCLUDED (Active): Tool calls are inspected and validated before DB execution.
      - ABSENT (Disabled): Tool calls run directly in baseline mode without firewall interception.
    """

    def __init__(self):
        self.enabled: bool = False
        self.custom_authorizer: Optional[FirewallAuthorizer] = None
        self.custom_package_name: Optional[str] = None
        self.block_count: int = 0
        self.pass_count: int = 0

    def default_rule_authorizer(
        self,
        tool_name: str,
        arguments: Dict[str, Any],
        conversation_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Default security authorizer used when firewall is enabled but no custom package is provided.
        Blocks high-impact financial, credential, and export operations triggered by untrusted sources.
        """
        # Block unauthorized payment attempts
        if tool_name == "send_payment":
            return {
                "allowed": False,
                "reason": "Firewall Rule Block: High-impact payment operation blocked by active security firewall."
            }

        # Block unauthorized credential reset attempts
        if tool_name == "request_credential_reset":
            return {
                "allowed": False,
                "reason": "Firewall Rule Block: Credential reset request blocked by active security firewall."
            }

        # Block unauthorized audit log purge attempts
        if tool_name == "purge_audit_logs":
            return {
                "allowed": False,
                "reason": "Firewall Rule Block: Audit log purge operation blocked by active security firewall."
            }

        # Block unauthorized mailbox export operations
        if tool_name == "export_mailbox_archive":
            return {
                "allowed": False,
                "reason": "Firewall Rule Block: Full mailbox archive export blocked by active security firewall."
            }

        return {"allowed": True}

    def _get_active_authorizer(self) -> FirewallAuthorizer:
        """Wrap the active authorizer to record pass/block metrics."""
        base_fn = self.custom_authorizer or self.default_rule_authorizer

        def wrapped(tool_name: str, arguments: Dict[str, Any], conversation_id: Optional[str] = None) -> Dict[str, Any]:
            res = base_fn(tool_name, arguments, conversation_id)
            if isinstance(res, dict) and not res.get("allowed", True):
                self.block_count += 1
            else:
                self.pass_count += 1
            return res

        return wrapped

    def register_package(self, authorizer: FirewallAuthorizer, name: str = "External Firewall Package"):
        """Register an external firewall package provided by the user or security team.
        
        Args:
            authorizer: Callable taking (tool_name, arguments, conversation_id) and returning
                        {"allowed": True} or {"allowed": False, "reason": "..."}
            name: Friendly display name of the firewall package
        """
        self.custom_authorizer = authorizer
        self.custom_package_name = name
        print(f"🛡️ [FirewallManager] Registered external firewall package: '{name}'")
        if self.enabled:
            tool_executor.set_firewall_authorizer(self._get_active_authorizer())

    def unregister_package(self):
        """Remove the custom package and fall back to built-in rules if enabled."""
        self.custom_authorizer = None
        self.custom_package_name = None
        if self.enabled:
            tool_executor.set_firewall_authorizer(self._get_active_authorizer())

    def enable(self) -> Dict[str, Any]:
        """Activate the security firewall (INCLUDED)."""
        self.enabled = True
        tool_executor.set_firewall_authorizer(self._get_active_authorizer())
        print("🛡️ [FirewallManager] Firewall status changed to INCLUDED (Active).")
        return self.get_status()

    def disable(self) -> Dict[str, Any]:
        """Deactivate the security firewall (ABSENT / Baseline mode)."""
        self.enabled = False
        tool_executor.set_firewall_authorizer(None)
        print("⚠️ [FirewallManager] Firewall status changed to ABSENT (Disabled).")
        return self.get_status()

    def toggle(self) -> Dict[str, Any]:
        """Toggle firewall inclusion on or off."""
        if self.enabled:
            return self.disable()
        return self.enable()

    def set_state(self, enabled: bool) -> Dict[str, Any]:
        """Explicitly set firewall state."""
        if enabled:
            return self.enable()
        return self.disable()

    def get_status(self) -> Dict[str, Any]:
        """Return full firewall status for UI and telemetry."""
        package = (
            self.custom_package_name
            if self.custom_authorizer
            else ("Built-in Guard" if self.enabled else "None")
        )
        return {
            "success": True,
            "enabled": self.enabled,
            "status": "INCLUDED" if self.enabled else "ABSENT",
            "mode": "ACTIVE" if self.enabled else "DISABLED",
            "package_name": package,
            "has_custom_package": self.custom_authorizer is not None,
            "block_count": self.block_count,
            "pass_count": self.pass_count,
            "description": (
                f"Firewall is INCLUDED and actively inspecting tool calls ({package})."
                if self.enabled
                else "Firewall is ABSENT. Tool calls execute directly in baseline mode."
            ),
        }


# Singleton instance
firewall_manager = FirewallManager()


def register_firewall_package(authorizer: FirewallAuthorizer, name: str = "External Firewall Package"):
    """Global helper function for external packages to plug directly into the firewall pipeline."""
    firewall_manager.register_package(authorizer, name=name)
