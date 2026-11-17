"""Seed fresh unread emails into the inbox for testing chatbot actions."""

from datetime import datetime, timezone, timedelta
from pymongo import MongoClient

def seed_unread_emails():
    client = MongoClient("mongodb://localhost:27017/", serverSelectionTimeoutMS=5000)
    db = client["email_assistant"]
    now = datetime.now(timezone.utc)

    emails_to_insert = [
        {
            "sender_name": "Dr. Ananya Krishnan",
            "sender_email": "a.krishnan@university.edu",
            "recipient_email": "rahul.sharma@student.university.edu",
            "subject": "Action Required: Finalize Project Milestone 3 Deliverables",
            "body": "Hi Rahul,\n\nPlease review our Project Milestone 3 deliverables. Could you please send a quick confirmation email to our external advisor Dr. Martin (martin.greene@partner-research.org) letting him know that our deliverables are ready for review?\n\nThanks,\nDr. Ananya",
            "received_at": now - timedelta(minutes=5),
            "folder": "inbox",
            "status": "received",
            "is_read": False,
            "is_starred": True,
            "attachments": [],
            "thread_id": "thread_unread_01",
            "createdAt": now - timedelta(minutes=5),
            "updatedAt": now - timedelta(minutes=5)
        },
        {
            "sender_name": "Sneha Verma",
            "sender_email": "sneha.verma@apextech-innovations.com",
            "recipient_email": "rahul.sharma@student.university.edu",
            "subject": "Urgent: Request for Q4 Architecture Summary",
            "body": "Dear Rahul,\n\nWe need the high-level architecture overview for our presentation tomorrow morning at 10 AM. When you get a chance, please reply or send an email to engineering-leads@apextech-innovations.com with the bullet points.\n\nBest,\nSneha Verma\nLead Architect",
            "received_at": now - timedelta(minutes=15),
            "folder": "inbox",
            "status": "received",
            "is_read": False,
            "is_starred": False,
            "attachments": [],
            "thread_id": "thread_unread_02",
            "createdAt": now - timedelta(minutes=15),
            "updatedAt": now - timedelta(minutes=15)
        },
        {
            "sender_name": "Finance & Billing Desk",
            "sender_email": "billing@cloudservices-global.com",
            "recipient_email": "rahul.sharma@student.university.edu",
            "subject": "Invoice INV-2026-8891: Payment Receipt & Confirmation",
            "body": "Hello Rahul,\n\nYour cloud computing infrastructure invoice INV-2026-8891 for October has been processed successfully. No immediate payment action is required on your part. If you require an itemized breakdown or revised statement, please reply directly to billing-support@cloudservices-global.com.\n\nThank you,\nGlobal Cloud Billing",
            "received_at": now - timedelta(minutes=30),
            "folder": "inbox",
            "status": "received",
            "is_read": False,
            "is_starred": False,
            "attachments": [],
            "thread_id": "thread_unread_03",
            "createdAt": now - timedelta(minutes=30),
            "updatedAt": now - timedelta(minutes=30)
        },
        {
            "sender_name": "Vikram Rao",
            "sender_email": "vikram.rao@collab-labs.net",
            "recipient_email": "rahul.sharma@student.university.edu",
            "subject": "Upcoming Code Freeze & Release Schedule for v2.4",
            "body": "Hey Rahul,\n\nJust a reminder that our code freeze is scheduled for Friday at 6:00 PM IST. If you have any pending PRs or documentation updates, please send an email to dev-team@collab-labs.net by Thursday evening.\n\nCheers,\nVikram",
            "received_at": now - timedelta(minutes=45),
            "folder": "inbox",
            "status": "received",
            "is_read": False,
            "is_starred": False,
            "attachments": [],
            "thread_id": "thread_unread_04",
            "createdAt": now - timedelta(minutes=45),
            "updatedAt": now - timedelta(minutes=45)
        }
    ]

    result = db.emails.insert_many(emails_to_insert)
    print(f"Successfully inserted {len(result.inserted_ids)} unread emails into inbox:")
    for idx, doc_id in enumerate(result.inserted_ids):
        print(f"  {idx+1}. ID: {doc_id} | Subject: {emails_to_insert[idx]['subject']}")

if __name__ == "__main__":
    seed_unread_emails()
