/**
 * Types for InvoicePilot
 */

export type InvoiceStatus =
  | 'Draft'
  | 'Sent'
  | 'Paid'
  | 'Overdue'
  | 'Partially paid'
  | 'Payment pending'
  | 'Cancelled';

export interface LineItem {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ActivityLogEntry {
  id: string;
  invoiceId?: string;
  invoiceNumber?: string;
  action:
    | 'created'
    | 'approved'
    | 'sent'
    | 'paid'
    | 'status_checked'
    | 'edited'
    | 'deleted'
    | 'reminder_drafted'
    | 'reminder_sent'
    | 'reminder_rejected'
    | 'reply_analyzed'
    | 'terms_updated'
    | 'agent_scan';
  description: string;
  timestamp: string; // ISO string
  metadata?: Record<string, any>;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  description: string;
  lineItems: LineItem[];
  amount: number; // Total USD
  currency: 'USD';
  issueDate: string; // YYYY-MM-DD
  dueDate: string;   // YYYY-MM-DD
  status: InvoiceStatus;
  paypalInvoiceId?: string;
  paypalPaymentLink?: string; // Client payment link (recipient_view_url)
  paypalSellerLink?: string;  // Seller view in PayPal (invoicer_view_url)
  rawPayPalStatus?: string;   // Exact status returned by PayPal Sandbox (e.g. PAID, SENT, UNPAID, MARKED_AS_PAID)
  lastSyncError?: string;     // If PayPal Sandbox call failed, store the error description
  rawClientMessage?: string;
  notes?: string;
  isDemo?: boolean;           // Clearly marks demo/sample data
  lastReminderSentAt?: string;
  remindersCount?: number;
  installments?: Array<{
    amount: number;
    dueDate: string;
    status: 'pending' | 'paid';
    label: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface ReminderDraft {
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  amount: number;
  dueDate: string;
  daysOverdue: number;
  tone: 'friendly' | 'firm' | 'final';
  toneLabel: string;
  subject: string;
  body: string;
  paymentLink?: string;
}

export interface ApprovalDraft {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  amount: number;
  currency: 'USD';
  dueDate: string;
  daysOverdue: number;
  tone: 'friendly' | 'firm' | 'final';
  toneLabel: string;
  subject: string;
  body: string;
  paymentLink?: string;
  reasoning: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string; // ISO
  reviewedAt?: string;
}

export interface DraftReasoningLine {
  clientName: string;
  invoiceNumber: string;
  daysOverdue: number;
  tone: string;
  line: string;
}

export interface LastAgentRunSummary {
  timestamp: string;
  overdueCount: number;
  draftsCreatedCount: number;
  scannedCount?: number;
  draftsReasoning: DraftReasoningLine[];
}

export interface AgentRunResult {
  scannedCount: number;
  overdueCount: number;
  newDraftsCount: number;
  alreadyDraftedCount: number;
  drafts: ApprovalDraft[];
  message: string;
  timestamp: string;
  lastAgentRun?: LastAgentRunSummary;
}

export interface ClientReplyAnalysis {
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  clientReply: string;
  intent: string;
  sentiment: 'cooperative' | 'delayed' | 'disputing' | 'neutral';
  suggestedResponse: string;
  suggestedDueDate?: string;
  suggestedSplit?: {
    installments: Array<{
      amount: number;
      dueDate: string;
      label: string;
    }>;
    reason: string;
  };
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  suggestedQuestions?: string[];
  citedInvoices?: Array<{
    id: string;
    invoiceNumber: string;
    clientName: string;
    amount: number;
    status: InvoiceStatus;
    dueDate: string;
  }>;
}

export interface InvoiceSummary {
  totalOutstanding: number;
  totalPaid: number;
  overdueCount: number;
  totalCount: number;
  draftCount: number;
  sentCount: number;
  paidCount: number;
  cancelledCount?: number;
}

export interface ExtractedInvoiceData {
  clientName: string;
  clientEmail: string;
  description: string;
  lineItems: Array<{
    name: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  total: number;
  dueDate: string;
  notes?: string;
}

export interface PayPalConfigStatus {
  hasPayPalClientId: boolean;
  hasPayPalSecret: boolean;
  hasGeminiKey: boolean;
  isSandboxReady: boolean;
}

