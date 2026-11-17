"""Email database service for AI Email Assistant.
Interacts directly with the simulated email MongoDB collection.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from bson import ObjectId
from pymongo import MongoClient, DESCENDING, ASCENDING
import os
import re

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/email_assistant")
DB_NAME = os.getenv("DB_NAME", "email_assistant")


class EmailService:
    def __init__(self, uri: str = MONGO_URI, db_name: str = DB_NAME):
        self.client = MongoClient(uri, serverSelectionTimeoutMS=5000)
        self.db = self.client[db_name]
        self.collection = self.db["emails"]

    def _serialize_email(self, doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Convert MongoDB document with ObjectId and datetime into JSON-serializable dict."""
        if not doc:
            return None
        serialized = dict(doc)
        serialized["id"] = str(serialized["_id"])
        serialized["_id"] = str(serialized["_id"])

        if "received_at" in serialized and isinstance(serialized["received_at"], datetime):
            serialized["received_at"] = serialized["received_at"].isoformat()
        if "createdAt" in serialized and isinstance(serialized["createdAt"], datetime):
            serialized["createdAt"] = serialized["createdAt"].isoformat()
        if "updatedAt" in serialized and isinstance(serialized["updatedAt"], datetime):
            serialized["updatedAt"] = serialized["updatedAt"].isoformat()

        if "attachments" in serialized and isinstance(serialized["attachments"], list):
            clean_atts = []
            for att in serialized["attachments"]:
                att_dict = dict(att)
                if "_id" in att_dict:
                    att_dict["id"] = str(att_dict["_id"])
                    att_dict["_id"] = str(att_dict["_id"])
                clean_atts.append(att_dict)
            serialized["attachments"] = clean_atts

        return serialized

    def _parse_id(self, email_id: str) -> Optional[ObjectId]:
        try:
            return ObjectId(email_id)
        except Exception:
            return None

    def get_emails(
        self,
        folder: Optional[str] = "inbox",
        is_read: Optional[bool] = None,
        is_starred: Optional[bool] = None,
        limit: int = 20,
        sort_by: str = "received_at",
        order: str = "desc"
    ) -> List[Dict[str, Any]]:
        """Fetch emails with filters."""
        query: Dict[str, Any] = {}

        if folder:
            f_lower = folder.lower()
            if f_lower == "starred":
                query["is_starred"] = True
                query["folder"] = {"$ne": "trash"}
            elif f_lower != "all":
                query["folder"] = f_lower

        if is_read is not None:
            query["is_read"] = is_read

        if is_starred is not None and folder != "starred":
            query["is_starred"] = is_starred

        sort_dir = DESCENDING if order.lower() == "desc" else ASCENDING
        cursor = self.collection.find(query).sort(sort_by, sort_dir).limit(limit)
        return [self._serialize_email(doc) for doc in cursor]

    def get_email_by_id(self, email_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve a single email by its ID."""
        oid = self._parse_id(email_id)
        if not oid:
            return None
        doc = self.collection.find_one({"_id": oid})
        return self._serialize_email(doc)

    def search_emails(
        self,
        query: Optional[str] = None,
        folder: Optional[str] = None,
        sender: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 15
    ) -> List[Dict[str, Any]]:
        """Search emails using text/regex query across sender, subject, and body, with optional filters."""
        filter_query: Dict[str, Any] = {}

        if folder and folder.lower() != "all":
            filter_query["folder"] = folder.lower()

        if sender:
            filter_query["$or"] = [
                {"sender_name": {"$regex": re.escape(sender), "$options": "i"}},
                {"sender_email": {"$regex": re.escape(sender), "$options": "i"}},
            ]

        if query:
            regex_term = {"$regex": re.escape(query), "$options": "i"}
            term_condition = [
                {"subject": regex_term},
                {"body": regex_term},
                {"sender_name": regex_term},
                {"sender_email": regex_term},
            ]
            if "$or" in filter_query:
                filter_query["$and"] = [{"$or": filter_query.pop("$or")}, {"$or": term_condition}]
            else:
                filter_query["$or"] = term_condition

        date_filter: Dict[str, Any] = {}
        if start_date:
            try:
                date_filter["$gte"] = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
            except ValueError:
                try:
                    date_filter["$gte"] = datetime.strptime(start_date, "%Y-%m-%d")
                except ValueError:
                    pass
        if end_date:
            try:
                date_filter["$lte"] = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
            except ValueError:
                try:
                    date_filter["$lte"] = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
                except ValueError:
                    pass

        if date_filter:
            filter_query["received_at"] = date_filter

        cursor = self.collection.find(filter_query).sort("received_at", DESCENDING).limit(limit)
        return [self._serialize_email(doc) for doc in cursor]

    def create_draft(
        self,
        recipient_email: str,
        subject: str,
        body: str,
        cc: Optional[List[str]] = None,
        sender_name: str = "Rahul Sharma",
        sender_email: str = "rahul.sharma@student.university.edu"
    ) -> Dict[str, Any]:
        """Save a new email draft."""
        now = datetime.now(timezone.utc)
        doc = {
            "sender_name": sender_name,
            "sender_email": sender_email,
            "recipient_email": recipient_email.strip().lower(),
            "cc": [c.strip().lower() for c in (cc or [])],
            "subject": subject.strip(),
            "body": body,
            "received_at": now,
            "status": "draft",
            "folder": "drafts",
            "attachments": [],
            "is_read": True,
            "is_starred": False,
            "thread_id": None,
            "createdAt": now,
            "updatedAt": now,
        }
        res = self.collection.insert_one(doc)
        doc["_id"] = res.inserted_id
        return self._serialize_email(doc)

    def send_email(
        self,
        recipient_email: str,
        subject: str,
        body: str,
        cc: Optional[List[str]] = None,
        draft_id: Optional[str] = None,
        sender_name: str = "Rahul Sharma",
        sender_email: str = "rahul.sharma@student.university.edu"
    ) -> Dict[str, Any]:
        """Send a new email or convert a draft to sent."""
        now = datetime.now(timezone.utc)

        if draft_id:
            oid = self._parse_id(draft_id)
            if oid:
                existing = self.collection.find_one({"_id": oid})
                if existing:
                    self.collection.update_one(
                        {"_id": oid},
                        {
                            "$set": {
                                "folder": "sent",
                                "status": "sent",
                                "recipient_email": recipient_email.strip().lower(),
                                "subject": subject.strip(),
                                "body": body,
                                "cc": [c.strip().lower() for c in (cc or [])],
                                "received_at": now,
                                "updatedAt": now,
                            }
                        }
                    )
                    updated = self.collection.find_one({"_id": oid})
                    return self._serialize_email(updated)

        doc = {
            "sender_name": sender_name,
            "sender_email": sender_email,
            "recipient_email": recipient_email.strip().lower(),
            "cc": [c.strip().lower() for c in (cc or [])],
            "subject": subject.strip(),
            "body": body,
            "received_at": now,
            "status": "sent",
            "folder": "sent",
            "attachments": [],
            "is_read": True,
            "is_starred": False,
            "thread_id": None,
            "createdAt": now,
            "updatedAt": now,
        }
        res = self.collection.insert_one(doc)
        doc["_id"] = res.inserted_id
        return self._serialize_email(doc)

    def forward_email(
        self,
        email_id: str,
        forward_to: str,
        additional_message: Optional[str] = None,
        sender_name: str = "Rahul Sharma",
        sender_email: str = "rahul.sharma@student.university.edu"
    ) -> Optional[Dict[str, Any]]:
        """Forward an email to another recipient, saving the forwarded copy in Sent."""
        original = self.get_email_by_id(email_id)
        if not original:
            return None

        now = datetime.now(timezone.utc)
        fw_subject = original["subject"]
        if not fw_subject.lower().startswith("fwd:"):
            fw_subject = f"Fwd: {fw_subject}"

        fw_body = ""
        if additional_message:
            fw_body += f"{additional_message}\n\n"
        fw_body += (
            "---------- Forwarded message ---------\n"
            f"From: {original['sender_name']} <{original['sender_email']}>\n"
            f"Date: {original.get('received_at', '')}\n"
            f"Subject: {original['subject']}\n"
            f"To: {original['recipient_email']}\n\n"
            f"{original['body']}"
        )

        doc = {
            "sender_name": sender_name,
            "sender_email": sender_email,
            "recipient_email": forward_to.strip().lower(),
            "cc": [],
            "subject": fw_subject,
            "body": fw_body,
            "received_at": now,
            "status": "sent",
            "folder": "sent",
            "attachments": original.get("attachments", []),
            "is_read": True,
            "is_starred": False,
            "thread_id": original.get("thread_id"),
            "createdAt": now,
            "updatedAt": now,
        }
        res = self.collection.insert_one(doc)
        doc["_id"] = res.inserted_id
        return self._serialize_email(doc)

    def delete_email(self, email_id: str, permanent: bool = False) -> bool:
        """Move email to trash or delete permanently."""
        oid = self._parse_id(email_id)
        if not oid:
            return False

        if permanent:
            res = self.collection.delete_one({"_id": oid})
            return res.deleted_count > 0
        else:
            now = datetime.now(timezone.utc)
            res = self.collection.update_one(
                {"_id": oid},
                {"$set": {"folder": "trash", "status": "deleted", "updatedAt": now}}
            )
            return res.matched_count > 0

    def mark_as_read(self, email_id: str, is_read: bool = True) -> bool:
        """Mark email as read or unread."""
        oid = self._parse_id(email_id)
        if not oid:
            return False
        res = self.collection.update_one(
            {"_id": oid},
            {"$set": {"is_read": is_read, "updatedAt": datetime.now(timezone.utc)}}
        )
        return res.matched_count > 0

    def get_thread_emails(self, thread_id: str) -> List[Dict[str, Any]]:
        """Retrieve all emails belonging to a thread."""
        cursor = self.collection.find({"thread_id": thread_id}).sort("received_at", ASCENDING)
        return [self._serialize_email(doc) for doc in cursor]


# Singleton instance
email_service = EmailService()
