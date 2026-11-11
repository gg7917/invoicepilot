# InvoicePilot ⚡
> **AI Collections Agent & Invoicing Automation for Freelancers & Small Businesses**

InvoicePilot is an end-to-end intelligent billing and collections platform designed for freelancers, consultants, and agencies. It turns unstructured client messages, emails, and project briefs into professional invoices with granular line items, clear totals, and accurate due dates—then connects with the **PayPal Invoicing API (Sandbox)** to dispatch invoices and track payments.

With Stage 2, InvoicePilot operates as an autonomous collections assistant: monitoring past-due accounts, drafting tiered overdue reminders (friendly, firm, and final notice), negotiating client replies (due date extensions, payment splits), and answering cash flow questions in an **"Ask Your Money"** chat grounded strictly in real invoice records.

**Guiding Principle**: *Nothing is ever sent or changed without explicit human approval.*

---

## 🚀 Key Features

### 1. Executive Collections Dashboard
- **Real-Time Financial Metric Cards**: Total Outstanding, Total Collected/Paid, Overdue Invoices Count, and Total Invoices.
- **Active Invoices Ledger**: Displays status (`Draft`, `Sent`, `Overdue`, `Paid`, `Partially paid`), client info, description, amount, due date, raw PayPal status, and quick actions.
- **Automatic 30-Second Background Status Polling**: Every 30 seconds while the app is open, automatically checks the PayPal Sandbox API for status updates on all active Sent invoices without page reloads. Invoices already `Paid` or `Cancelled` are skipped, background network errors retry gracefully without error popups, and when an invoice becomes `Paid`, a "Payment received" notification appears and the event is written to the audit log.
- **Manual "Refresh status" Control**: One-click manual trigger to immediately query `GET /v2/invoicing/invoices/{id}` on the PayPal Sandbox API and see instant progress.
- **Direct Sandbox Payment Links**: Shows separate **"Pay now (client view)"** (`recipient_view_url`) for the payer and **"View in PayPal"** (`invoicer_view_url`) for the merchant.

### 2. AI Message-to-Invoice Parser (Gemini 3.8 Flash)
- Paste any client message (e.g., *"Hi, I need 3 logo designs and a banner, $400 total, can you send the invoice, due in 10 days. - Ravi (ravi@apexcreative.io)"*).
- Gemini extracts:
  - Client name & email
  - Deliverables & high-level summary
  - Granular line items (quantities, unit prices, totals)
  - Calculated due date based on natural language terms (e.g., *"in 10 days"*, *"net 14"*, *"by Friday"*)
  - Payment notes & delivery terms

### 3. Tiered Overdue Reminders (Gemini 3.8 Flash)
- For every invoice that is Sent or Overdue and past its due date, click **"Draft reminder"**.
- Gemini crafts a short, effective reminder email calibrated by days overdue:
  - **Tier 1 (1–7 days overdue)**: Friendly, warm nudge assuming the invoice was simply overlooked.
  - **Tier 2 (8–21 days overdue)**: Firmer follow-up, requesting payment status or scheduling.
  - **Tier 3 (22+ days overdue)**: Final formal notice before collection escalation or suspension.
- Every email includes the client name, amount, due date, and verified Pay now link.
- **Human Approval Modal**: Review, edit subject/body/recipient, and click **"Approve and send"**.

### 4. Client Reply Assistant & Terms Negotiation
- Click **"Paste client reply"** when a client responds (e.g., *"Can I pay next week?"* or *"Could we split this $3,200 invoice into two payments?"*).
- Gemini evaluates the message:
  - Summarizes intent and classifies sentiment (`cooperative`, `delayed`, `disputing`, `neutral`).
  - Drafts a polite, professional reply to secure payment while maintaining good relations.
  - Proposes structured terms:
    - **Due Date Extension**: Suggests a revised due date (YYYY-MM-DD).
    - **Installment Split**: Proposes two scheduled payments with dates and amounts summing to the total balance.
- **Approval Guardrail**: No dates or terms in your database change until you click **"Approve and Apply Terms"**.

### 5. "Ask Your Money" Conversational Financial Agent
- A dedicated chat interface to query your accounts receivable:
  - *"Who owes me money?"*
  - *"Which client pays late?"*
  - *"What is my total overdue balance?"*
  - *"Show my largest unpaid invoice"*
- **Strict Grounding Rule**: Answers exclusively using your stored invoice database. **Never hallucinates or invents invoices that do not exist.**
- Returns clickable referenced invoice cards allowing you to open invoice details directly from the chat.

### 6. Chronological Activity & Audit Trail
- Comprehensive audit log tracking every lifecycle event:
  - `created`: Invoices extracted by AI or created manually
  - `approved`: User explicitly approved invoice details
  - `sent`: Dispatched via PayPal Invoicing API Sandbox
  - `reminder_drafted`: Gemini generated tone-calibrated reminder
  - `reminder_sent`: User approved and dispatched reminder
  - `reply_analyzed`: Gemini analyzed client message
  - `terms_updated`: User approved date extension or split installments
  - `paid`: Payment confirmed via PayPal Sandbox status check or recorded manually
  - `status_checked`: Remote PayPal Sandbox sync completed
- Filter pills (All, Reminders, Terms, Payments, Sent, Status Syncs) and real-time search.

### 7. Demo Data for Collections & Reminder Testing
- Pre-seeded with 3 clearly marked sample overdue invoices (`[Demo] ...`) covering the 3 reminder tiers:
  - `INV-2026-DEMO1` (4 days overdue): Tests Tier 1 Friendly reminder
  - `INV-2026-DEMO2` (13 days overdue): Tests Tier 2 Firmer follow-up and installment splits
  - `INV-2026-DEMO3` (26 days overdue): Tests Tier 3 Final notice collections

---

## 🏗️ Architecture Overview

```
                                  ┌─────────────────────────────┐
                                  │      Client Browser         │
                                  │   (React + Vite + Tailwind) │
                                  └──────────────┬──────────────┘
                                                 │
                               HTTP / JSON APIs  │ (Port 3000)
                                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Full-Stack Node.js Server                             │
│                                                                                 │
│   ┌────────────────────┐   ┌───────────────────────┐   ┌────────────────────┐   │
│   │   Express Router   │   │     Storage Layer     │   │   Activity Logger  │   │
│   │    (server.ts)     │◄─►│ (invoices_db.json)    │◄─►│   (Audit Trail)    │   │
│   └─────────┬──────────┘   └───────────────────────┘   └────────────────────┘   │
│             │                                                                   │
│             ├─────────────────────────────────┐                                 │
│             ▼                                 ▼                                 │
│   ┌───────────────────┐             ┌───────────────────┐                       │
│   │   PayPal Engine   │             │   Gemini Engine   │                       │
│   │ (server/paypal.ts)│             │ (server/gemini.ts)│                       │
│   └─────────┬─────────┘             └─────────┬─────────┘                       │
└─────────────┼─────────────────────────────────┼─────────────────────────────────┘
              │                                 │
              ▼                                 ▼
   ┌───────────────────────┐         ┌───────────────────────┐
   │ PayPal Sandbox v2 API │         │    Google Gemini AI   │
   │   (Invoicing REST)    │         │  (@google/genai SDK)  │
   │  - OAuth 2.0 Token    │         │  - gemini-3.8-flash   │
   │  - Generate Number    │         │  - Extraction         │
   │  - Create Draft       │         │  - Tiered Reminders   │
   │  - Send Invoice       │         │  - Reply Negotiation  │
   │  - Status Query       │         │  - Financial RAG Chat │
   └───────────────────────┘         └───────────────────────┘
```

---

## 💳 How PayPal is Used (Sandbox Invoicing API)

InvoicePilot integrates with the **PayPal Invoicing REST API v2** in Sandbox mode:

1. **OAuth 2.0 Authentication**:
   - `POST https://api-m.sandbox.paypal.com/v1/oauth2/token`
   - Exchanges `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` via HTTP Basic Auth for a bearer token. Cached until expiration.

2. **Invoice Number Generation & Collision Recovery**:
   - `POST https://api-m.sandbox.paypal.com/v2/invoicing/generate-next-invoice-number`
   - If a duplicate invoice number error (`DUPLICATE_INVOICE_NUMBER` 422) occurs, InvoicePilot automatically requests the next available invoice number and retries.

3. **Invoice Creation & Merchant Email**:
   - `POST https://api-m.sandbox.paypal.com/v2/invoicing/invoices`
   - Merchant email is read from the optional `MERCHANT_EMAIL` env var (defaulting to Sandbox business account `sb-oogc653795134@business.example.com`).
   - Line items, amounts, currency (`USD`), and payment terms are transmitted.
   - Real PayPal ID (`INV2-XXXX-XXXX-XXXX-XXXX`) is extracted from the `Location` header or `href` link.

4. **Invoice Dispatch**:
   - `POST https://api-m.sandbox.paypal.com/v2/invoicing/invoices/{invoice_id}/send`
   - Dispatches the invoice and triggers PayPal's notification service.

5. **Invoice Status & Recipient Payment Link Retrieval**:
   - `GET https://api-m.sandbox.paypal.com/v2/invoicing/invoices/{invoice_id}`
   - Reads `metadata.recipient_view_url` (direct client sandbox checkout page `https://www.sandbox.paypal.com/invoice/p/#...`) and `metadata.invoicer_view_url` (seller sandbox dashboard).
   - Maps raw PayPal status:
     - `PAID` / `MARKED_AS_PAID` ➔ **Paid**
     - `PARTIALLY_PAID` ➔ **Partially paid**
     - `SENT` / `UNPAID` ➔ **Sent**
     - `PAYMENT_PENDING` ➔ **Payment pending**
     - `CANCELLED` ➔ **Cancelled**

---

## 🤖 How Gemini is Used (@google/genai SDK)

All Gemini API calls are strictly executed **server-side** using the official `@google/genai` TypeScript SDK with model `gemini-3.8-flash`:

| Capability | Model | Thinking Level | Pattern |
|---|---|---|---|
| **Invoice Extraction** | `gemini-3.8-flash` | `LOW` | `ai.models.generateContent` with structured JSON `responseSchema` |
| **Tiered Reminders** | `gemini-3.8-flash` | `LOW` | Tone-conditioned collection email drafting with payment link insertion |
| **Client Reply Analysis** | `gemini-3.8-flash` | `LOW` | Intent detection, sentiment analysis, due date extraction, installment plan generation |
| **"Ask Your Money" Chat** | `gemini-3.8-flash` | `LOW` | Grounded financial reasoning strictly over stored invoice records |

*Resilience Guarantee*: Every Gemini feature includes a deterministic offline parser/generator that seamlessly activates if `GEMINI_API_KEY` is not yet configured or during temporary upstream network spikes.

---

## 🔑 Environment Variables & Secrets

InvoicePilot requires three environment variables. **Never hardcode secrets in code or commit them to version control.**

| Environment Variable | Description | Where to Get It |
|---|---|---|
| `GEMINI_API_KEY` | Google Gemini API key for invoice parsing, reminders, and chat | Managed automatically in AI Studio **Settings > Secrets** |
| `PAYPAL_CLIENT_ID` | PayPal Developer Sandbox REST App Client ID | [developer.paypal.com/dashboard/applications/sandbox](https://developer.paypal.com/dashboard/applications/sandbox) |
| `PAYPAL_CLIENT_SECRET` | PayPal Developer Sandbox REST App Secret | [developer.paypal.com/dashboard/applications/sandbox](https://developer.paypal.com/dashboard/applications/sandbox) |
| `MERCHANT_EMAIL` | *(Optional)* Sandbox Merchant Business Email | Defaults to `sb-oogc653795134@business.example.com`. |

### How to Add Secrets in AI Studio:
1. Open the **Settings** menu (gear icon) in the AI Studio sidebar.
2. Select the **Secrets** tab.
3. Click **Add Secret**:
   - Key: `PAYPAL_CLIENT_ID` ➔ Value: `<your-sandbox-client-id>`
   - Key: `PAYPAL_CLIENT_SECRET` ➔ Value: `<your-sandbox-secret>`
   - *(Optional)* Key: `MERCHANT_EMAIL` ➔ Value: `<your-sandbox-business-email>`
4. AI Studio securely injects these into `process.env`.
5. *(Optional for local terminal dev)*: Copy `.env.example` to `.env` and fill in credentials.

---

## 📂 Project Structure

```
├── server.ts                    # Express entrypoint with Vite dev middleware & API routes
├── server/
│   ├── gemini.ts                # Gemini 3.8 Flash extraction, reminders, negotiation & chat
│   ├── paypal.ts                # PayPal Sandbox REST Invoicing API (OAuth, Send, Status)
│   └── storage.ts               # JSON database store, seed data & activity audit logger
├── types/
│   └── invoice.ts               # Unified TypeScript interfaces (Invoices, Reminders, Chats)
├── src/
│   ├── components/              # Modular React components
│   │   ├── Dashboard.tsx        # Financial metrics, filterable ledger, reminder & reply actions
│   │   ├── NewInvoice.tsx       # Message-to-invoice extraction & editable approval form
│   │   ├── ReminderModal.tsx    # AI overdue reminder review, edit & send modal
│   │   ├── ClientReplyModal.tsx # Client reply negotiator (intent, extension, split payments)
│   │   ├── AskMoneyChat.tsx     # Grounded financial Q&A chat assistant
│   │   ├── ActivityLogView.tsx  # Chronological audit trail with category filters
│   │   ├── InvoiceModal.tsx     # Deep invoice inspector & history viewer
│   │   └── PayPalGuideModal.tsx # In-app sandbox credentials setup guide
│   ├── App.tsx                  # Main application shell & tab router
│   ├── main.tsx                 # React DOM root
│   └── index.css                # Tailwind CSS v4 styling
├── data/
│   └── invoices_db.json         # Persistent JSON database (preserves all existing invoices)
└── package.json
```

---

## 💻 Development Commands

- `npm run dev`: Starts the full-stack server on `http://0.0.0.0:3000` via `tsx server.ts`.
- `npm run build`: Compiles production frontend bundle with Vite.
- `npm run lint`: Type-checks with TypeScript compiler (`tsc --noEmit`).

