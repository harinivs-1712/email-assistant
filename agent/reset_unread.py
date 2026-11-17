"""Reset test emails to unread with recent timestamps."""

from datetime import datetime, timezone, timedelta
from pymongo import MongoClient

def reset_unread():
    client = MongoClient("mongodb://localhost:27017/")
    db = client["email_assistant"]
    now = datetime.now(timezone.utc)

    # 1. Reset all 4 test emails to unread
    test_emails = [
        {
            "sender_name": "Dr. Ananya Krishnan",
            "sender_email": "a.krishnan@university.edu",
            "recipient_email": "rahul.sharma@student.university.edu",
            "subject": "Action Required: Finalize Project Milestone 3 Deliverables",
            "body": (
                "Hi Rahul,\n\n"
                "Please review our Project Milestone 3 deliverables. Could you please send a quick "
                "confirmation email to our external advisor Dr. Martin (martin.greene@partner-research.org) "
                "letting him know that our deliverables are ready for review?\n\n"
                "Thanks,\nDr. Ananya"
            ),
            "received_at": now - timedelta(minutes=2),
            "folder": "inbox",
            "status": "received",
            "is_read": False,
            "is_starred": True,
            "attachments": [],
            "thread_id": "thread_unread_01",
            "createdAt": now - timedelta(minutes=2),
            "updatedAt": now
        },
        {
            "sender_name": "Sneha Verma",
            "sender_email": "sneha.verma@apextech-innovations.com",
            "recipient_email": "rahul.sharma@student.university.edu",
            "subject": "Urgent: Request for Q4 Architecture Summary",
            "body": (
                "Dear Rahul,\n\n"
                "We need the high-level architecture overview for our presentation tomorrow morning at 10 AM. "
                "When you get a chance, please reply or send an email to engineering-leads@apextech-innovations.com "
                "with the bullet points.\n\n"
                "Best,\nSneha Verma\nLead Architect"
            ),
            "received_at": now - timedelta(minutes=5),
            "folder": "inbox",
            "status": "received",
            "is_read": False,
            "is_starred": False,
            "attachments": [],
            "thread_id": "thread_unread_02",
            "createdAt": now - timedelta(minutes=5),
            "updatedAt": now
        },
        {
            "sender_name": "Finance & Billing Desk",
            "sender_email": "billing@cloudservices-global.com",
            "recipient_email": "rahul.sharma@student.university.edu",
            "subject": "Invoice INV-2026-8891: Payment Receipt & Confirmation",
            "body": (
                "Hello Rahul,\n\n"
                "Your cloud computing infrastructure invoice INV-2026-8891 for October has been processed successfully. "
                "No immediate payment action is required on your part. If you require an itemized breakdown or revised "
                "statement, please reply directly to billing-support@cloudservices-global.com.\n\n"
                "Thank you,\nGlobal Cloud Billing"
            ),
            "received_at": now - timedelta(minutes=10),
            "folder": "inbox",
            "status": "received",
            "is_read": False,
            "is_starred": False,
            "attachments": [],
            "thread_id": "thread_unread_03",
            "createdAt": now - timedelta(minutes=10),
            "updatedAt": now
        },
        {
            "sender_name": "Vikram Rao",
            "sender_email": "vikram.rao@collab-labs.net",
            "recipient_email": "rahul.sharma@student.university.edu",
            "subject": "Upcoming Code Freeze & Release Schedule for v2.4",
            "body": (
                "Hey Rahul,\n\n"
                "Just a reminder that our code freeze is scheduled for Friday at 6:00 PM IST. "
                "If you have any pending PRs or documentation updates, please send an email to "
                "dev-team@collab-labs.net by Thursday evening.\n\n"
                "Cheers,\nVikram"
            ),
            "received_at": now - timedelta(minutes=15),
            "folder": "inbox",
            "status": "received",
            "is_read": False,
            "is_starred": False,
            "attachments": [],
            "thread_id": "thread_unread_04",
            "createdAt": now - timedelta(minutes=15),
            "updatedAt": now
        }
    ]

    for em in test_emails:
        db.emails.update_one(
            {"subject": em["subject"]},
            {"$set": em},
            upsert=True
        )

    unread_count = db.emails.count_documents({"is_read": False, "folder": "inbox"})
    print(f"✅ Successfully seeded/updated test emails. Total unread in inbox: {unread_count}")
    for doc in db.emails.find({"is_read": False, "folder": "inbox"}).sort("received_at", -1):
        print(f"  • [{doc['_id']}] {doc['subject']} (From: {doc['sender_name']})")

if __name__ == "__main__":
    reset_unread()
