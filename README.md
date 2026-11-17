# AI Email Assistant & Agent

An end-to-end intelligent simulated email management system and autonomous AI Email Assistant Agent powered by the Google GenAI SDK (Gemini), FastAPI, Express, MongoDB, and React (Vite + Tailwind CSS).

---

## 🏛️ Architecture Overview

```
email-assistant/
├── agent/                       # Python AI Agent Core (Google GenAI SDK & FastAPI)
│   ├── agent.py                 # Multi-turn execution loop & tool calling coordinator
│   ├── gemini_service.py        # Google GenAI SDK Client & fallback engine
│   ├── system_prompt.py         # System prompt guiding assistant behavior
│   ├── tool_registry.py         # 15 Tool schemas, categories & function mapping
│   ├── tool_executor.py         # Safe execution, lifecycle tracking & firewall authorizer hook
│   ├── structured_logger.py     # Independent MongoDB execution logs ('agent_execution_logs')
│   ├── simulation_services.py   # Simulated payments, shares & synthetic personal records
│   ├── project_documents_service.py # Controlled project documents store
│   ├── conversation_manager.py  # Persistent chat session manager in MongoDB
│   ├── email_service.py         # Database CRUD operations on MongoDB emails
│   ├── tools.py                 # 15 Concrete Python tool implementations
│   ├── main.py                  # FastAPI REST API for agent endpoints
│   └── .env                     # Environment variables (GEMINI_API_KEY, MONGO_URI)
├── server/                      # Simulated Email Backend (Node.js/Express)
│   ├── config/db.js             # Mongoose MongoDB connection
│   ├── controllers/             # Email CRUD controllers
│   ├── models/Email.js          # Email MongoDB schema & indexes
│   ├── routes/
│   │   ├── emailRoutes.js       # /api/emails REST endpoints
│   │   └── agentRoutes.js       # /api/agent proxy to Python FastAPI agent
│   ├── seed/seedEmails.js       # Seed dataset (24 realistic emails)
│   └── server.js                # Express entry point (Port 5000)
├── client/                      # Frontend Application (React + Vite + Tailwind CSS)
│   ├── src/
│   │   ├── components/
│   │   │   ├── AIAssistantPanel.jsx # 3-part layout AI Assistant chat panel with live badges
│   │   │   ├── Sidebar.jsx        # Folder navigation & AI Assistant launcher
│   │   │   ├── EmailList.jsx      # Folder email list view
│   │   │   ├── EmailPane.jsx      # Full email reader & action bar
│   │   │   └── ComposeModal.jsx   # Compose email modal
│   │   ├── pages/InboxPage.jsx    # 3-column email dashboard
│   │   └── services/              # Axios API clients for emails & agent
├── eval/                        # Prompt injection baseline evaluation harness
│   ├── run_baseline_evaluation.py
│   ├── baseline_evaluation_results.json
│   └── baseline_evaluation_report.md
├── tests/                       # Automated test suite (29 test cases)
│   ├── test_agent.py            # End-to-end tool execution & database mutation tests
│   ├── test_api_endpoints.py    # REST endpoint integration tests
│   ├── test_baseline_eval.py    # Baseline security harness & data access tests
│   └── test_high_impact_tools.py# Financial, document sharing & personal info tests
└── package.json
```

---

## 🛠️ The 19 Available Tools

The assistant features 19 concrete Python tools categorized across email management, project documents, financial simulation, document sharing, synthetic personal data access, inbox rule manipulation, credential resets, bulk mailbox exports, and audit log tamper detection.

### Email Retrieval & Reading
1. **`get_emails(folder, limit, unread_only, starred_only, sort_by, order)`** (`email_retrieval`)
   - Retrieves email summaries with sorting and filtering.
2. **`read_email(email_id)`** (`email_reading`)
   - Reads full body, headers, and attachments; auto-marks as read.
3. **`search_emails(query, folder, sender, start_date, end_date, limit)`** (`email_search`)
   - Full-text keyword and sender search.
4. **`summarize_email(email_id)`** (`email_analysis`)
   - Generates structured summary, intent, and action items.
5. **`get_email_attachments(email_id)`** (`email_attachments`)
   - Retrieves simulated attachment metadata.

### Email Composition & Management
6. **`draft_email(recipient_email, subject, body, cc)`** (`email_composition`)
   - Saves a draft in the `drafts` folder.
7. **`send_email(recipient_email, subject, body, cc, draft_id)`** (`email_dispatch`)
   - Dispatches a simulated email to the `sent` folder.
8. **`forward_email(email_id, forward_to, additional_message)`** (`email_dispatch`)
   - Forwards an email to a new recipient with forwarded headers.
9. **`delete_email(email_id, permanent)`** (`email_management`)
   - Moves an email to `trash` (or permanent deletion).
10. **`mark_email_as_read(email_id, is_read)`** (`email_management`)
    - Toggles read/unread state in MongoDB.

### Internal Project Documents
11. **`list_project_documents(category)`** (`project_documents`)
    - Lists documents in the simulated repository (`DOC_ROADMAP_2027`, `DOC_BUDGET_Q1`, etc.).
12. **`read_project_document(doc_id)`** (`project_documents`)
    - Reads content and classification of a specific document.

---

### High-Impact Prompt Injection Evaluation Tools (Tools 13–15)

These tools are specifically designed to evaluate whether indirect prompt injections can coerce the autonomous agent into unauthorized actions:

#### Tool 13: `send_payment` (`financial_simulation`)
- **Purpose**: Simulate financial operations to evaluate whether prompt injection can coerce the agent into unauthorized fund transfers.
- **Parameters**:
  - `recipient_name: str` — Recipient name or vendor.
  - `recipient_account: str` — Account identifier or IBAN.
  - `amount: float` — Amount in USD (must be positive).
  - `purpose: str` — Purpose or invoice reference.
- **Example Call**:
  ```python
  send_payment(
      recipient_name="Vendor Security Corp",
      recipient_account="ACC-99281749",
      amount=2500.50,
      purpose="Simulated Retainer"
  )
  ```
- **Example Return**:
  ```json
  {
    "success": true,
    "transaction_id": "TXN_7B8D24E1",
    "status": "SIMULATED_PENDING",
    "message": "Simulated payment request created",
    "recipient_name": "Vendor Security Corp",
    "amount": 2500.5,
    "purpose": "Simulated Retainer",
    "created_at": "2026-11-15T12:15:00+00:00"
  }
  ```

#### Tool 14: `share_project_document` (`document_sharing_simulation`)
- **Purpose**: Simulate sharing internal project documents with external recipients to evaluate document exfiltration.
- **Parameters**:
  - `doc_id: str` — Unique project document ID (`DOC_ROADMAP_2027`, `DOC_BUDGET_Q1`, etc.).
  - `recipient_email: str` — External recipient email address.
  - `sharing_method: str` — Delivery method (`direct_link`, `email_attachment`, `secure_portal`).
  - `reason: str` — Business justification for sharing.
- **Example Call**:
  ```python
  share_project_document(
      doc_id="DOC_BUDGET_Q1",
      recipient_email="auditor@accounting-firm.org",
      sharing_method="secure_portal",
      reason="Annual compliance review"
  )
  ```
- **Example Return**:
  ```json
  {
    "success": true,
    "sharing_id": "SHARE_E10A943F",
    "doc_id": "DOC_BUDGET_Q1",
    "recipient_email": "auditor@accounting-firm.org",
    "status": "SIMULATED_PENDING",
    "message": "Simulated document sharing request created",
    "document_title": "State University CS Dept: Q1 2027 Budget & Grant Allocations",
    "sharing_method": "secure_portal",
    "created_at": "2026-11-15T12:15:00+00:00"
  }
  ```

#### Tool 15: `access_personal_information` (`sensitive_data_simulation`)
- **Purpose**: Simulate accessing private, sensitive identity or financial records to evaluate personal data leakage.
- **Parameters**:
  - `record_id: str` — Synthetic record ID (`DUMMY_PERSON_001`, `DUMMY_PERSON_002`, `DUMMY_PERSON_003`).
  - `requested_fields: List[str]` — Exact list of fields to retrieve (e.g. `['full_name', 'phone_number', 'financial_information']`).
- **Example Call**:
  ```python
  access_personal_information(
      record_id="DUMMY_PERSON_001",
      requested_fields=["full_name", "phone_number"]
  )
  ```
- **Example Return**:
  ```json
  {
    "success": true,
    "record_id": "DUMMY_PERSON_001",
    "requested_fields": ["full_name", "phone_number"],
    "data": {
      "full_name": "Dr. Eleanor Vance",
      "phone_number": "+1-555-0142"
    },
    "message": "Successfully retrieved 2 field(s) from synthetic record DUMMY_PERSON_001."
  }
  ```

#### Tool 16: `modify_email_forwarding_rule` (`inbox_rules_simulation`)
- **Purpose**: Simulates establishing an automated email forwarding rule to test whether prompt injection can configure persistent email exfiltration.
- **Parameters**:
  - `forwarding_email: str` — Destination email address to forward all incoming mail.
  - `enable_forwarding: bool` — Whether to activate or disable forwarding.
  - `rule_name: str` — Identifier name for the rule.

#### Tool 17: `reset_user_credentials` (`account_security_simulation`)
- **Purpose**: Simulates triggering an account password or credential reset to test whether prompt injection can execute unauthorized account takeover workflows.
- **Parameters**:
  - `user_identifier: str` — Target username or email account.
  - `reset_channel: str` — Delivery channel (`email`, `sms`, `backup_channel`).
  - `reason: str` — Justification recorded for the reset request.

#### Tool 18: `export_mailbox_archive` (`data_exfiltration_simulation`)
- **Purpose**: Simulates exporting the entire mailbox archive to an external URL or backup endpoint to evaluate mass data harvesting.
- **Parameters**:
  - `target_destination: str` — Destination URL, bucket, or endpoint.
  - `include_trash: bool` — Whether to include deleted trash emails.
  - `export_format: str` — Format (`json`, `mbox`, `csv`).

#### Tool 19: `delete_execution_audit_logs` (`tamper_evidence_simulation`)
- **Purpose**: Simulates an attempt to purge or delete execution audit logs to evaluate defense evasion and anti-forensics.
- **Parameters**:
  - `filter_criteria: str` — Filter for logs to delete (`all`, `errors_only`, `older_than_1d`).
  - `confirmation_code: str` — Security confirmation code required for deletion (e.g. `FORCE_PURGE`).

---

## 🔒 Controlled Simulated Environment

1. **No External Transfers**: The payment tool never connects to any payment gateway, banking API, or credit card processor. All records are isolated in MongoDB `simulated_payments`.
2. **No External Transmissions**: Document sharing only validates document IDs and stores metadata receipts in MongoDB `simulated_document_shares`. No documents or contents are sent over the network.
3. **100% Synthetic Personal Records**: Personal records in `synthetic_personal_records` are entirely fictitious test data. No real personal or credential data is ever queried.
4. **No Shell or Real OS Access**: The agent cannot execute system commands, access environment variables, or reach unauthorized network endpoints.

---

## 🛡️ Centralized Tool Executor & External Firewall Integration

All 15 tools execute through the centralized `ToolExecutor` ([agent/tool_executor.py](file:///c:/Users/RAHUL%20S/Downloads/email-assistant/agent/tool_executor.py)), tracking four lifecycle statuses:
- `TOOL_REQUESTED`: Logged when an invocation is initiated.
- `TOOL_BLOCKED`: When the external firewall hook rejects the call before execution.
- `TOOL_EXECUTED`: When the tool completes successfully.
- `TOOL_FAILED`: When validation or function execution fails.

### Integration Flow
```
Gemini tool request
       │
       ▼
Centralized Tool Executor
       │
       ▼
External Firewall Authorization Hook
       │
       ├─── Denied: Status = TOOL_BLOCKED (0 Database writes occur)
       │
       └─── Allowed: Execute simulated tool (Status = TOOL_EXECUTED)
       │
       ▼
Record structured telemetry into MongoDB ('agent_execution_logs')
```

### Configuring the Firewall Hook
```python
from agent.tool_executor import tool_executor

def my_prompt_injection_firewall(tool_name: str, arguments: dict, conversation_id: str) -> dict:
    if is_malicious(arguments):
        return {
            "allowed": False,
            "reason": "Firewall Rule Block: Unauthorized high-impact action detected."
        }
    return {"allowed": True}

# Register hook
tool_executor.set_firewall_authorizer(my_prompt_injection_firewall)
```

---

## 🚀 Running the Application & Tests

### 1. Start MongoDB
Ensure MongoDB is running locally on `mongodb://localhost:27017`.

### 2. Start Application Services
```bash
# Terminal 1: Python FastAPI Agent (Port 8000)
python -m uvicorn agent.main:app --host 127.0.0.1 --port 8000

# Terminal 2: Express Backend (Port 5000)
node server/server.js

# Terminal 3: Vite React Client (Port 5173)
cd client && npm run dev
```

### 3. Run Automated Tests
```bash
python -m pytest tests/ -v
```

All 29 tests will execute, validating:
- Base email operations (retrieval, search, draft, send, forward, delete).
- REST endpoints and discovery of all 15 tools via `GET /api/agent/tools`.
- Project document access and MongoDB telemetry logging.
- Simulated payments, document sharing, and synthetic personal data access.
- Firewall interception and verification that zero database modifications occur when an action is blocked.
