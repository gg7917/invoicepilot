# InvoicePilot ⚡
> **AI Collections Agent for Freelancers & Small Businesses**

InvoicePilot turns messy client messages, emails, and project briefs into professional invoices with line items, clear totals, and due dates—then dispatches them via the **PayPal Invoicing API (Sandbox)** with a mandatory human approval step.

---

## 🚀 Key Features (Stage 1)

1. **Executive Collections Dashboard**
   - Summary metric cards: Total Outstanding, Total Collected/Paid, Overdue Count, and Total Invoices.
   - Live invoice table with statuses: `Draft`, `Sent`, `Paid`, `Overdue`.
   - Pre-seeded with 5 realistic sample invoices so you can test right away.
   - Filter by status and instant client search.

2. **AI Invoice Extraction from Messages (Gemini 3.8 Flash)**
   - Paste any unstructured client message (e.g., *"Hi, I need 3 logo designs and a banner, $400 total, can you send the invoice, due in 10 days. - Ravi"*).
   - Gemini AI extracts:
     - Client Name & Email
     - Description of services
     - Granular line items (quantities, unit prices, totals)
     - Total USD amount
     - Calculated due date based on natural language terms (e.g., *"in 10 days"*, *"by next Friday"*)
     - Notes and payment terms

3. **Mandatory Review & Approval Guardrail**
   - Extracted data is presented in a clean, fully editable invoice preview.
   - Adjust quantities, prices, descriptions, dates, or client information.
   - **Zero automatic dispatch**: Invoices are never sent without your explicit **"Approve and Send"** click.

4. **PayPal Sandbox Invoicing API Integration**
   - Server-side only (credentials never touch the browser).
   - Generates authentic PayPal Invoicing records via the official PayPal Sandbox REST API (`https://api-m.sandbox.paypal.com/v2/invoicing/invoices`).
   - Dispatches the invoice and records the PayPal Invoice ID and direct `payer-view` payment URL.
   - Features built-in Sandbox Simulation fallback if you want to explore the workflow before adding your PayPal developer keys.

5. **PayPal Status Refresh**
   - Click **"Refresh status"** to query PayPal Sandbox for payment updates.
   - Automatically detects overdue invoices when the due date passes without payment.

6. **Persistent Database & Full Activity Audit Trail**
   - Stored in a resilient server-side JSON database (`/data/invoices_db.json`).
   - Detailed audit log tracks every lifecycle event: `created`, `approved`, `sent`, `paid`, and `status_checked`.

---

## 🔑 Where to Add Your Secrets & Environment Variables

InvoicePilot requires three environment variables. **Never hardcode secrets in code or commit them to version control.**

| Environment Variable | Description | Where to Get It |
|---|---|---|
| `GEMINI_API_KEY` | Google Gemini API key for invoice parsing | Managed automatically in AI Studio **Settings > Secrets** |
| `PAYPAL_CLIENT_ID` | PayPal Developer Sandbox REST App Client ID | [developer.paypal.com/dashboard/applications/sandbox](https://developer.paypal.com/dashboard/applications/sandbox) |
| `PAYPAL_CLIENT_SECRET` | PayPal Developer Sandbox REST App Secret | [developer.paypal.com/dashboard/applications/sandbox](https://developer.paypal.com/dashboard/applications/sandbox) |
| `MERCHANT_EMAIL` | *(Optional)* PayPal Sandbox Merchant Business Email | Defaults to `sb-oogc653795134@business.example.com`. Leave blank to use account's own primary email. |

### How to Add Secrets in AI Studio:
1. Open the **Settings** menu (gear icon) in the AI Studio sidebar.
2. Select the **Secrets** tab.
3. Click **Add Secret**:
   - Key: `PAYPAL_CLIENT_ID` ➔ Value: `<your-sandbox-client-id>`
   - Key: `PAYPAL_CLIENT_SECRET` ➔ Value: `<your-sandbox-secret>`
   - *(Optional)* Key: `MERCHANT_EMAIL` ➔ Value: `<your-sandbox-business-email>`
4. AI Studio will securely inject these into the server's `process.env`.
5. *(Optional for local dev)*: You can also copy `.env.example` to `.env` and paste your credentials there.

---

## 🛠️ Step-by-Step PayPal Sandbox Setup

1. Log in to the [PayPal Developer Dashboard](https://developer.paypal.com/).
2. Under **Apps & Credentials**, ensure the toggle is set to **Sandbox**.
3. Click **Create App** (or select your Default Application).
4. Give your app a name (e.g., `InvoicePilot Sandbox App`) and select **Merchant** as the app type.
5. Copy your **Client ID** and **Secret**.
6. In **Testing Tools > Sandbox Accounts**, PayPal automatically creates a Sandbox Merchant account and a Sandbox Personal (buyer) account for testing payments.
7. Paste the Client ID and Secret into AI Studio **Settings > Secrets**.

*Note: If credentials are not yet entered, InvoicePilot will gracefully use Sandbox Simulation Mode so you can test all UI flows instantly.*

---

## 📂 Project Structure

```
├── server.ts               # Express entrypoint with Vite dev middleware
├── server/
│   ├── gemini.ts           # Gemini 3.8 Flash message extraction
│   ├── paypal.ts           # PayPal Sandbox Invoicing API (OAuth + Send + Status)
│   └── storage.ts          # Persistent database & activity log store
├── types/
│   └── invoice.ts          # Unified TypeScript interfaces
├── src/
│   ├── components/         # Modular React components
│   │   ├── Dashboard.tsx   # Metrics summary & invoices table
│   │   ├── NewInvoice.tsx  # Message parser, presets & editable approval preview
│   │   ├── ActivityLog.tsx # Complete chronological audit trail
│   │   ├── InvoiceModal.tsx# Detailed invoice view & actions
│   │   └── PayPalGuide.tsx # In-app sandbox credentials helper
│   ├── App.tsx             # Main layout & navigation
│   ├── main.tsx            # React root
│   └── index.css           # Tailwind CSS
├── data/
│   └── invoices_db.json    # Persistent JSON database (auto-created & seeded)
└── package.json
```

---

## 💻 Development Commands

- `npm run dev`: Runs the full-stack server on `http://0.0.0.0:3000` via `tsx server.ts`.
- `npm run build`: Compiles production frontend bundle with Vite.
- `npm run lint`: Type-checks with TypeScript (`tsc --noEmit`).
