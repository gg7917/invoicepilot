# NudgePay ⚡
> **The AI collections agent that chases late payments for you**

NudgePay is an end-to-end intelligent billing and collections platform designed for freelancers, consultants, and agencies. It transforms unstructured client messages, emails, and project briefs into professional invoices with granular line items, clear totals, and accurate due dates—then connects with the **PayPal Invoicing API (Sandbox)** to dispatch invoices and track payments.

As an autonomous collections agent, NudgePay continuously monitors past-due accounts, drafts tiered overdue reminders (friendly, firm, and final notice), manages an **Approval Queue**, analyzes client replies to negotiate terms (due date extensions, payment splits), and answers cash flow questions in an **"Ask Your Money"** financial chat grounded strictly in real invoice records.

**Guiding Principle**: *Nothing is ever sent or changed without explicit human approval.*

---

## 🚀 Key Features

### 1. Multi-Tenant Business Accounts & Authentication
- **Secure Sign Up & Log In**: Business accounts with email, password, and business name.
- **Cryptographic Security**: Passwords are securely hashed with salted `scrypt` (never stored in plain text).
- **Session Cookie**: Managed via secure, HTTP-only session cookies (`nudgepay_session`, 30-day lifetime).
- **Data Isolation**: Invoices, approval drafts, and activity logs are strictly isolated per business account. A business only ever sees its own records.
- **1-Click Demo Login for Judges**:
  - Email: `demo@example.com`
  - Password: `Demo1234!`
  - Business: `Apex Creative Studio`
  - Features 10 pre-loaded invoices, overdue sample accounts, past activity history, and ready-to-test collections workflows.
- **Header Profile**: Displays the active business name and a **Log out** button.

### 2. Autonomous Collections Agent & Approval Queue
- **Automated Scanning**: The collections agent scans all invoices on startup and whenever **"Run collections agent"** is clicked.
- **Overdue Detection & Tone Calibration**:
  - **1–7 days overdue**: Gentle, friendly nudge.
  - **8–21 days overdue**: Direct, firm follow-up.
  - **22+ days overdue**: Formal final collection notice.
- **Approval Queue**:
  - Displays pending drafts with days overdue, tone badge, client info, and reasoning.
  - **1-Click Actions**: Approve & Send, Inline Edit, or Reject/Dismiss.
  - **Batch Approve**: Approve all pending reminders in one click.
  - **Duplicate Prevention**: Never creates duplicate drafts for an invoice that already has a pending reminder.
- **"Last Agent Run" Summary**: Displays timestamp, overdue invoices found, drafts created, and a clear reasoning line per draft (e.g. *"Sam: 12 days overdue, firm tone"*).

### 3. Automatic 30-Second PayPal Status Auto-Sync
- **Background Polling**: Every 30 seconds while the app is open, checks the status of all active `Sent` invoices from the PayPal Sandbox API.
- **Zero Page Reloads**: Updates the dashboard table and summary metric cards seamlessly.
- **Smart Filtering**: Does not poll invoices that are already `Paid` or `Cancelled`.
- **Payment Notifications**: Displays a "Payment received" banner and records an entry in the Activity Log when an invoice becomes `Paid`.
- **Manual "Refresh status" Control**: Retains manual instant sync button with live feedback.
- **Raw PayPal Status Badge**: Displays the exact status returned by PayPal (e.g., `PayPal: PAID`, `PayPal: SENT`, `PayPal: UNPAID`).

### 4. Compact & Responsive Invoice Table
- Optimized for standard laptop screens (~1366px) and mobile devices without horizontal scrolling.
- **Merged Client Info Cell**: Client name on top, invoice number and email smaller underneath with text wrapping.
- **Merged Amount & Due Date**: Compact presentation with overdue badges and formatted amounts.
- **Clean Action Menu**: Single prominent "Pay now" button for unpaid invoices, plus a compact `⋯` menu for "View in PayPal", "Draft reminder", "Mark as paid", and "Details".
- **Mobile Card View**: Responsive layout transforms table rows into clean cards on screens under 768px.

### 5. AI Message-to-Invoice Parser (Gemini 3.8 Flash)
- Paste any natural language client message, chat, or project brief.
- Gemini automatically extracts:
  - Client name & email
  - High-level project summary
  - Granular line items (names, descriptions, quantities, unit prices, totals)
  - Calculated due date based on natural language terms (*"due in 10 days"*, *"net 14"*, *"by Friday"*)
  - Payment notes & delivery terms

### 6. Client Reply Assistant & Terms Negotiation
- Paste any client message (e.g., *"Can I pay next week?"* or *"Could we split this $3,200 invoice into two payments?"*).
- Gemini analyzes sentiment and intent, drafts a courteous response, and recommends structured terms:
  - **Due Date Extension**: Proposes a revised due date (YYYY-MM-DD).
  - **Installment Split**: Proposes two scheduled payments with dates and amounts summing to the total balance.
- **Approval Guardrail**: No terms change until you click **"Approve and Apply Terms"**.

### 7. "Ask Your Money" Financial Assistant
- Natural language chat assistant to query your accounts receivable:
  - *"Who owes me money?"*
  - *"Which client pays late?"*
  - *"How much did Ravi pay me?"*
  - *"What is my total outstanding balance?"*
- **Strict Grounding Rule**: Answers exclusively using your stored invoice database. If asked about a client or date not in your records, it clearly states there is no matching data and never hallucinates numbers or invents invoices.

### 8. Activity Log & Audit Trail
- Comprehensive audit log tracking every lifecycle event: `created`, `approved`, `sent`, `reminder_drafted`, `reminder_sent`, `reminder_rejected`, `agent_scan`, `reply_analyzed`, `terms_updated`, `paid`, `status_checked`.
- Real-time search and filter tabs (All, Reminders, Terms, Payments, Dispatched).

---

## 🏗️ Architecture Overview

```
                                  ┌─────────────────────────────┐
                                  │      Client Browser         │
                                  │   (React + Vite + Tailwind) │
                                  └──────────────┬──────────────┘
                                                 │
                                HTTP / Cookies   │ (Port 3000)
                                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Full-Stack Node.js Server                             │
│                                                                                 │
│   ┌────────────────────┐   ┌───────────────────────┐   ┌────────────────────┐   │
│   │   Express Router   │   │   Storage & Tenants   │   │   Activity Logger  │   │
│   │    (server.ts)     │◄─►│ (invoices_db.json)    │◄─►│   (Audit Trail)    │   │
│   │  Auth Middleware   │   │ Business Data Scoping │   │   Session Store    │   │
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
   │  - Next Number Gen    │         │  - Invoice Extraction │
   │  - Create & Send      │         │  - Tiered Reminders   │
   │  - Remote Status GET  │         │  - Client Negotiation │
   │  - Search Invoices    │         │  - Grounded Chat RAG  │
   └───────────────────────┘         └───────────────────────┘
```

---

## 💳 How PayPal is Used (Sandbox Invoicing API)

NudgePay integrates with the official **PayPal Invoicing REST API v2** in Sandbox mode:

1. **OAuth 2.0 Bearer Authentication**:
   - `POST https://api-m.sandbox.paypal.com/v1/oauth2/token`
   - Authenticates using `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` via Basic Auth.
2. **Next Invoice Number Generation**:
   - `POST https://api-m.sandbox.paypal.com/v2/invoicing/generate-next-invoice-number`
   - Recovers from potential duplicate number collisions automatically.
3. **Invoice Creation & Merchant Email**:
   - `POST https://api-m.sandbox.paypal.com/v2/invoicing/invoices`
   - Sets line items, quantities, currency (`USD`), and payment terms. Real IDs match `INV2-XXXX-XXXX-XXXX-XXXX`.
4. **Invoice Dispatch**:
   - `POST https://api-m.sandbox.paypal.com/v2/invoicing/invoices/{invoice_id}/send`
   - Sends the invoice to the client's email via PayPal Sandbox.
5. **Invoice Status & URL Retrieval**:
   - `GET https://api-m.sandbox.paypal.com/v2/invoicing/invoices/{invoice_id}`
   - Retrieves live status and extracts `recipient_view_url` (client checkout link) and `invoicer_view_url` (merchant view).
   - Maps raw PayPal status:
     - `PAID` / `MARKED_AS_PAID` ➔ **Paid**
     - `PARTIALLY_PAID` ➔ **Partially paid**
     - `SENT` / `UNPAID` ➔ **Sent**
     - `PAYMENT_PENDING` ➔ **Payment pending**
     - `CANCELLED` ➔ **Cancelled**

> **⚠️ Multi-Business PayPal Sandbox Limitation**:
> In this deployment, all business accounts use the same PayPal sandbox merchant account configured in the server's environment variables (`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, and `MERCHANT_EMAIL`). Each business sees and manages only its own invoices within NudgePay, while outward Sandbox dispatches route through the shared merchant credentials.

---

## 🤖 How Gemini is Used (@google/genai SDK)

All Gemini API calls are strictly executed **server-side** using the modern `@google/genai` TypeScript SDK:

| Capability | Model | Thinking Level | Pattern |
|---|---|---|---|
| **Invoice Extraction** | `gemini-3.8-flash` | `LOW` | `ai.models.generateContent` with structured JSON `responseSchema` |
| **Tiered Reminders** | `gemini-3.8-flash` | `LOW` | Calibrated collection email drafting with verified payment link insertion |
| **Client Reply Analysis** | `gemini-3.8-flash` | `LOW` | Intent detection, sentiment analysis, due date extraction, installment plan proposal |
| **"Ask Your Money" Chat** | `gemini-3.8-flash` | `LOW` | Grounded financial reasoning strictly over stored invoice records |

*Resilience Guarantee*: Every Gemini feature includes a deterministic offline parser/generator that seamlessly activates if `GEMINI_API_KEY` is not yet configured or during temporary upstream network spikes.

---

## 🔑 Environment Variables & Secrets

NudgePay requires environment variables configured on the server. **Never commit real keys or secrets to version control.**

| Environment Variable | Description | Where to Get It |
|---|---|---|
| `GEMINI_API_KEY` | Google Gemini API key for invoice parsing, reminders, and chat | Managed in AI Studio **Settings > Secrets** |
| `PAYPAL_CLIENT_ID` | PayPal Developer Sandbox REST App Client ID | [developer.paypal.com/dashboard/applications/sandbox](https://developer.paypal.com/dashboard/applications/sandbox) |
| `PAYPAL_CLIENT_SECRET` | PayPal Developer Sandbox REST App Secret | [developer.paypal.com/dashboard/applications/sandbox](https://developer.paypal.com/dashboard/applications/sandbox) |
| `MERCHANT_EMAIL` | *(Optional)* Sandbox Merchant Business Email | Defaults to `sb-oogc653795134@business.example.com`. |

### Setup Steps:
1. Open the **Settings** menu (gear icon) in the AI Studio sidebar.
2. Select the **Secrets** tab.
3. Click **Add Secret**:
   - Key: `PAYPAL_CLIENT_ID` ➔ Value: `<your-sandbox-client-id>`
   - Key: `PAYPAL_CLIENT_SECRET` ➔ Value: `<your-sandbox-secret>`
   - *(Optional)* Key: `MERCHANT_EMAIL` ➔ Value: `<your-sandbox-business-email>`
4. AI Studio securely injects these into `process.env`.
5. Run `npm run dev` to start the app.
6. Open the app and click **"Log in as Demo Business"** or sign up for a new account.

---

## 💻 Development Commands

- `npm run dev`: Starts the full-stack server on `http://0.0.0.0:3000` via `tsx server.ts`.
- `npm run build`: Compiles production frontend bundle with Vite.
- `npm run lint`: Type-checks with TypeScript compiler (`tsc --noEmit`).
