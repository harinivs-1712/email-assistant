"""FastAPI server for the AI Email Assistant Agent.
Exposes REST endpoints for chatting with the agent, managing conversation histories,
and inspecting tools and system status.
"""

from contextlib import asynccontextmanager
import os
from typing import Any, Dict, List, Optional
from dotenv import load_dotenv

# Load agent/.env and root .env
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
load_dotenv()

from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn

from agent.agent import email_agent
from agent.conversation_manager import conversation_manager
from agent.firewall_manager import firewall_manager
from agent.gemini_service import gemini_service
from agent.tool_registry import get_tool_declarations


# ─── Pydantic Schemas ──────────────────────────────────────────────────────────

class SetFirewallRequest(BaseModel):
    enabled: bool = Field(..., description="Whether the firewall should be included (True) or absent (False)")


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="Natural language prompt for the Email Assistant")
    conversation_id: Optional[str] = Field(None, description="Optional ID to continue an existing conversation")


class ChatResponse(BaseModel):
    success: bool
    conversation_id: str
    response: str
    tool_executions: List[Dict[str, Any]] = []
    iterations: int = 1
    timestamp: str


class ConversationItem(BaseModel):
    conversation_id: str
    title: str
    created_at: str
    updated_at: str
    message_count: int = 0


# ─── FastAPI Application Lifecycle ───────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 AI Email Assistant Agent API is starting up...")
    yield
    print("🛑 AI Email Assistant Agent API is shutting down...")


app = FastAPI(
    title="AI Email Assistant Agent API",
    description="Agentic email management service powered by Google Gemini and real MongoDB tool calling.",
    version="1.0.0",
    lifespan=lifespan
)

# ─── CORS Middleware ──────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Agent Endpoints ──────────────────────────────────────────────────────────

@app.post("/api/agent/chat", response_model=ChatResponse)
async def chat_with_agent(req: ChatRequest):
    """Send a natural language instruction to the AI Email Assistant."""
    try:
        result = email_agent.chat(
            message=req.message,
            conversation_id=req.conversation_id
        )
        return result
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Agent processing error: {str(exc)}"
        )


@app.get("/api/agent/conversations")
async def list_conversations(limit: int = Query(50, ge=1, le=100)):
    """Retrieve all conversation sessions."""
    conversations = conversation_manager.list_conversations(limit=limit)
    return {
        "success": True,
        "count": len(conversations),
        "conversations": conversations
    }


@app.get("/api/agent/conversations/{conversation_id}")
async def get_conversation(conversation_id: str):
    """Retrieve full message history for a specific conversation session."""
    conv = conversation_manager.get_conversation(conversation_id)
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation '{conversation_id}' not found."
        )
    return {
        "success": True,
        "conversation": conv
    }


@app.delete("/api/agent/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str):
    """Delete a conversation session."""
    deleted = conversation_manager.delete_conversation(conversation_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation '{conversation_id}' not found."
        )
    return {
        "success": True,
        "message": f"Conversation '{conversation_id}' deleted successfully."
    }


@app.get("/api/agent/tools")
async def get_tools():
    """Inspect all registered Gemini tools and schemas."""
    return {
        "success": True,
        "count": len(get_tool_declarations()),
        "tools": get_tool_declarations()
    }


@app.get("/api/agent/firewall")
async def get_firewall_status():
    """Retrieve current security firewall inclusion status (INCLUDED / ABSENT)."""
    return firewall_manager.get_status()


@app.post("/api/agent/firewall/toggle")
async def toggle_firewall():
    """Toggle the security firewall between INCLUDED and ABSENT."""
    return firewall_manager.toggle()


@app.post("/api/agent/firewall/set")
async def set_firewall_status(req: SetFirewallRequest):
    """Explicitly set the security firewall inclusion status."""
    return firewall_manager.set_state(req.enabled)


@app.get("/api/agent/health")
async def health_check():
    """Check health and configuration status of the agent service."""
    return {
        "status": "ok",
        "service": "AI Email Assistant Agent",
        "gemini_model": gemini_service.model_name,
        "gemini_api_configured": gemini_service.is_api_configured(),
        "tools_registered": len(get_tool_declarations())
    }


if __name__ == "__main__":
    uvicorn.run("agent.main:app", host="0.0.0.0", port=8000, reload=True)
