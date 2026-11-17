"""Conversation manager for AI Email Assistant.
Manages persistent multi-turn chat sessions and message histories in MongoDB.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import uuid
from bson import ObjectId
from pymongo import MongoClient, DESCENDING
import os

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/email_assistant")
DB_NAME = os.getenv("DB_NAME", "email_assistant")


class ConversationManager:
    def __init__(self, uri: str = MONGO_URI, db_name: str = DB_NAME):
        self.client = MongoClient(uri, serverSelectionTimeoutMS=5000)
        self.db = self.client[db_name]
        self.collection = self.db["agent_conversations"]

    def _serialize_conv(self, doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        if not doc:
            return None
        serialized = dict(doc)
        serialized["_id"] = str(serialized["_id"])
        if "created_at" in serialized and isinstance(serialized["created_at"], datetime):
            serialized["created_at"] = serialized["created_at"].isoformat()
        if "updated_at" in serialized and isinstance(serialized["updated_at"], datetime):
            serialized["updated_at"] = serialized["updated_at"].isoformat()

        if "messages" in serialized and isinstance(serialized["messages"], list):
            for m in serialized["messages"]:
                if "timestamp" in m and isinstance(m["timestamp"], datetime):
                    m["timestamp"] = m["timestamp"].isoformat()

        return serialized

    def create_conversation(self, title: Optional[str] = None, conv_id: Optional[str] = None) -> Dict[str, Any]:
        """Create a new conversation session."""
        now = datetime.now(timezone.utc)
        final_id = conv_id or f"conv_{uuid.uuid4().hex[:12]}"
        doc = {
            "conversation_id": final_id,
            "title": title or "New Conversation",
            "created_at": now,
            "updated_at": now,
            "messages": []
        }
        res = self.collection.insert_one(doc)
        doc["_id"] = res.inserted_id
        return self._serialize_conv(doc)

    def get_conversation(self, conversation_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve a conversation by its ID."""
        doc = self.collection.find_one({"conversation_id": conversation_id})
        return self._serialize_conv(doc)

    def list_conversations(self, limit: int = 50) -> List[Dict[str, Any]]:
        """List all conversation sessions ordered by last update."""
        cursor = self.collection.find(
            {},
            {"messages": {"$slice": -1}}  # Only return the last message for preview
        ).sort("updated_at", DESCENDING).limit(limit)

        result = []
        for doc in cursor:
            serialized = self._serialize_conv(doc)
            # Add message count
            full_count = len(doc.get("messages", []))
            serialized["message_count"] = full_count
            result.append(serialized)
        return result

    def add_message(
        self,
        conversation_id: str,
        role: str,
        content: str,
        tool_calls: Optional[List[Dict[str, Any]]] = None,
        tool_results: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """Add a message to the conversation history, creating the conversation if it doesn't exist."""
        now = datetime.now(timezone.utc)
        message = {
            "id": f"msg_{uuid.uuid4().hex[:8]}",
            "role": role,
            "content": content,
            "tool_calls": tool_calls or [],
            "tool_results": tool_results or [],
            "timestamp": now
        }

        # Check if conversation exists
        existing = self.collection.find_one({"conversation_id": conversation_id})
        if not existing:
            # Create title from first message
            title = content[:40] + ("..." if len(content) > 40 else "")
            doc = {
                "conversation_id": conversation_id,
                "title": title or "Conversation",
                "created_at": now,
                "updated_at": now,
                "messages": [message]
            }
            res = self.collection.insert_one(doc)
            doc["_id"] = res.inserted_id
            return message

        # Update existing conversation
        update_fields: Dict[str, Any] = {"updated_at": now}
        # If title is default and user sends first message, update title
        if existing.get("title") == "New Conversation" and role == "user":
            update_fields["title"] = content[:40] + ("..." if len(content) > 40 else "")

        self.collection.update_one(
            {"conversation_id": conversation_id},
            {
                "$push": {"messages": message},
                "$set": update_fields
            }
        )
        return message

    def delete_conversation(self, conversation_id: str) -> bool:
        """Delete a conversation session."""
        res = self.collection.delete_one({"conversation_id": conversation_id})
        return res.deleted_count > 0

    def get_messages(self, conversation_id: str) -> List[Dict[str, Any]]:
        """Get all messages for a conversation session."""
        conv = self.get_conversation(conversation_id)
        if not conv:
            return []
        return conv.get("messages", [])


# Singleton instance
conversation_manager = ConversationManager()
