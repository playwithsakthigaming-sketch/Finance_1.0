# Finance Management System — Weekly Microfinance & WhatsApp Automation

A secure, full-stack Weekly Microfinance Loan Management System designed for small loan businesses in India (Tamil Nadu / Salem District standard rules).

---

## 1. Core Financial Business Rules

| Term | Value / Rule |
| :--- | :--- |
| **Original Principal** | ₹10,000 |
| **Upfront Deduction** | ₹1,500 (Tracked separately; not counted as interest or collected principal) |
| **Net Disbursement** | ₹8,500 (`Original Principal - Upfront Deduction`) |
| **Duration** | 10 Weeks |
| **Weekly Principal Repayment** | ₹1,000 per week |
| **Interest Rate** | ₹0 (Zero interest for standard loan product) |
| **Repayment Due Day** | Sunday |
| **Overdue Evaluation Day** | Tuesday |
| **Late Penalty** | ₹150 once per eligible missed weekly due |
| **Penalty Constraint** | Assessed strictly ONCE per weekly due (idempotent, never compounded into interest) |
| **Reminder Suppression** | Future Sunday & Tuesday reminders are automatically suppressed once a due is fully settled |
| **Currency Representation** | Strict Integer Paise (1 INR = 100 Paise) for zero floating-point calculation errors |
| **Timezone** | `Asia/Kolkata` (IST · UTC+5:30) |

---

## 2. Technology Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide Icons, Bilingual (Tamil / English)
- **Backend**: Node.js & Express API routes (`/api/whatsapp/send`, `/api/whatsapp/webhook`, `/api/health`, `/api/tests/run`)
- **Database**: PostgreSQL / Supabase with 15 normalized tables, RLS policies, and unique constraints
- **Messaging**: Meta WhatsApp Business Cloud API (Graph API v19.0) with server-side secrets and sandbox simulation fallback
- **Testing**: Built-in 12-scenario automated test suite executing across loan math, Tuesday penalty idempotency, partial payment allocations, and WhatsApp reminder suppression

---

## 3. Database Schema Migration

The complete production-ready migration is in `src/db/schema.sql`. It includes:

1. `profiles`: Admin and cashier user accounts
2. `customers`: Customer profiles, Aadhaar/Voter IDs, WhatsApp consent status & source
3. `loans`: Loan agreements, principal, upfront deductions, and net disbursements in integer paise
4. `weekly_dues`: 10-week Sunday repayment schedule with remaining principal and reminder suppression flags
5. `penalty_ledger`: Enforces `CONSTRAINT unique_penalty_per_due UNIQUE(weekly_due_id)` so only one ₹150 assessment ever exists per due
6. `payments`: Manual cashier payments with allocations to principal and penalty
7. `payment_allocations`: Line-item breakdown per weekly due
8. `receipts`: Unique numbered receipts (`RCPT-XXXXXX`) with customer statement balance
9. `account_ledger`: Double-entry accounting audit trail
10. `message_outbox`: Transactional outbox for WhatsApp messages with retry counts and status tracking
11. `webhook_events`: Meta webhook event receiver log
12. `audit_logs`: Immutable audit trail for payment reversals, penalty waivers, and settings changes
13. `application_settings`: Business profile and WhatsApp Cloud API configuration

---

## 4. Local Development & Deployment

### Running Locally
```bash
npm install
npm test    # Runs the 12 automated unit and integration tests
npm run dev # Starts the full-stack server on port 3000
```

### Environment Variables (.env)
```env
BUSINESS_NAME="Sri Murugan Finance"
BUSINESS_NAME_TA="ஸ்ரீ முருகன் பைனான்ஸ்"
BUSINESS_PHONE="+91 98400 12345"
BUSINESS_TIMEZONE="Asia/Kolkata"

# WhatsApp Business Cloud API (from developers.facebook.com)
WHATSAPP_ACCESS_TOKEN="EAA..."
WHATSAPP_PHONE_NUMBER_ID="104928172819201"
WHATSAPP_BUSINESS_ACCOUNT_ID="918273645019283"
WHATSAPP_VERIFY_TOKEN="finance_mgmt_secret_verify_token_2026"
```

---

## 5. WhatsApp Cloud API Webhook Setup

1. In the **Meta App Dashboard**, go to **WhatsApp > Configuration**.
2. Set the **Callback URL** to: `https://your-domain.com/api/whatsapp/webhook`
3. Set the **Verify Token** to match your `WHATSAPP_VERIFY_TOKEN`.
4. Subscribe to the `messages` webhook field to receive delivery receipts (`sent`, `delivered`, `read`, `failed`).
