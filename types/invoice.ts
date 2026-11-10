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
  action: 'created' | 'approved' | 'sent' | 'paid' | 'status_checked' | 'edited' | 'deleted';
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
  createdAt: string;
  updatedAt: string;
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
