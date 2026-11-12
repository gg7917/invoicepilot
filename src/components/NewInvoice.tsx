import { authFetch } from "../lib/api";
import React, { useState } from 'react';
import {
  Sparkles,
  Send,
  Plus,
  Trash2,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
  ArrowLeft,
  DollarSign,
  FileText,
  Mail,
  User,
  HelpCircle,
} from 'lucide-react';
import { ExtractedInvoiceData, Invoice, LineItem } from '../../types/invoice';

interface NewInvoiceProps {
  onInvoiceCreated: (invoice: Invoice) => void;
  onCancel: () => void;
}

const PRESET_MESSAGES = [
  {
    label: 'Ravi (3 Logos & Banner - $400)',
    text: 'Hi, I need 3 logo designs and a banner, $400 total, can you send the invoice, due in 10 days. - Ravi (ravi@apexcreative.io)',
  },
  {
    label: 'Maya (API Consulting - $2,500)',
    text: 'Hey! Can you bill us for 25 hours of backend TypeScript API development at $90/hr, plus the $250 database migration fee? Net 14 terms please. Thanks, Maya Lin <maya@fintechsurge.com>',
  },
  {
    label: 'Marcus (Figma Mobile UI - $2,400)',
    text: 'Please invoice for the Mobile App UI Redesign ($1,800) and the Interactive Figma Design System ($600). Due in two weeks. - Marcus Vance (marcus@vanguardtech.co)',
  },
];

export const NewInvoice: React.FC<NewInvoiceProps> = ({ onInvoiceCreated, onCancel }) => {
  const [message, setMessage] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  // Extracted & Editable State
  const [isExtracted, setIsExtracted] = useState(false);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  // Approval and Send states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [approvalResult, setApprovalResult] = useState<{
    invoice: Invoice;
    paypalPaymentLink?: string;
    paypalSellerLink?: string;
    paypalInvoiceId: string;
    isSimulated: boolean;
  } | null>(null);

  const [extractedWarning, setExtractedWarning] = useState<string | null>(null);

  // Offline heuristic extraction helper in case network drops or times out
  const clientFallbackExtract = (messageText: string) => {
    const today = new Date().toISOString().split('T')[0];
    const refDate = new Date(today);

    // 1. Extract email
    const emailMatch = messageText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    const clientEmail = emailMatch ? emailMatch[1] : '';

    // 2. Extract Client Name
    let clientName = '';
    const signoffMatch = messageText.match(
      /(?:[-–—]|thanks|regards|cheers|best|sincerely|from)\s*,?\s*([A-Za-z]+(?:\s+[A-Za-z]+)?)/i
    );
    if (signoffMatch && signoffMatch[1]) {
      clientName = signoffMatch[1].trim();
    } else if (clientEmail) {
      const rawName = clientEmail.split('@')[0].replace(/[._-]/g, ' ');
      clientName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
    } else {
      clientName = 'Valued Client';
    }

    // 3. Extract Amount
    const amountMatches = Array.from(
      messageText.matchAll(/\$\s?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)/g)
    ).map((m) => parseFloat(m[1].replace(/,/g, '')));
    const totalAmount = amountMatches.length > 0 ? Math.max(...amountMatches) : 100.0;

    // 4. Extract Due Date
    const daysMatch = messageText.match(/(?:due\s+(?:in|within)\s+([0-9]+)\s+days?|net\s+([0-9]+))/i);
    const weeksMatch = messageText.match(/(?:due\s+(?:in|within)\s+([0-9]+)\s+weeks?|in\s+two\s+weeks)/i);
    let dueDate = '';
    if (daysMatch) {
      const days = parseInt(daysMatch[1] || daysMatch[2] || '14', 10);
      dueDate = new Date(refDate.getTime() + days * 86400000).toISOString().split('T')[0];
    } else if (weeksMatch) {
      const weeks = weeksMatch[1] ? parseInt(weeksMatch[1], 10) : 2;
      dueDate = new Date(refDate.getTime() + weeks * 7 * 86400000).toISOString().split('T')[0];
    } else {
      dueDate = new Date(refDate.getTime() + 14 * 86400000).toISOString().split('T')[0];
    }

    // 5. Build line items
    const items: LineItem[] = [
      {
        id: `item-${Date.now()}-1`,
        name: 'Professional Services',
        description: messageText.substring(0, 90),
        quantity: 1,
        unitPrice: totalAmount,
        total: totalAmount,
      },
    ];

    return {
      clientName,
      clientEmail,
      description: 'Professional Services',
      dueDate,
      notes: 'Payment due via PayPal upon receipt or scheduled due date.',
      lineItems: items,
      total: totalAmount,
    };
  };

  // Handle Extraction with Gemini
  const handleExtract = async () => {
    if (!message.trim()) {
      setExtractError('Please enter or paste a message from your client first.');
      return;
    }

    setIsExtracting(true);
    setExtractError(null);
    setExtractedWarning(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      const response = await authFetch('/api/invoices/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim() }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type') || '';

      if (!response.ok) {
        let errorMsg = `Server error (${response.status})`;
        if (contentType.includes('application/json')) {
          try {
            const errorData = await response.json();
            errorMsg = errorData.error || errorMsg;
          } catch {
            // fallback
          }
        }
        throw new Error(errorMsg);
      }

      if (!contentType.includes('application/json')) {
        throw new Error('Received unexpected non-JSON response from server.');
      }

      const data = await response.json();

      if (data.warning) {
        setExtractedWarning(data.warning);
      }

      setClientName(data.clientName || 'Valued Client');
      setClientEmail(data.clientEmail || '');
      setDescription(data.description || 'Professional Services');
      setDueDate(data.dueDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]);
      setNotes(data.notes || 'Payment due via PayPal upon receipt or scheduled due date.');

      const itemsWithIds: LineItem[] = (data.lineItems || []).map((item: any, idx: number) => ({
        id: `item-${Date.now()}-${idx}`,
        name: item.name || 'Service Item',
        description: item.description || '',
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice || 0,
        total: item.total || (item.quantity || 1) * (item.unitPrice || 0),
      }));

      setLineItems(
        itemsWithIds.length > 0
          ? itemsWithIds
          : [
              {
                id: `item-${Date.now()}`,
                name: data.description || 'Professional Services',
                quantity: 1,
                unitPrice: data.total || 100,
                total: data.total || 100,
              },
            ]
      );

      setIsExtracted(true);
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.warn('Extraction API encountered issue, engaging smart offline parser:', err.message || err);
      // Auto fallback to client-side smart parser so the user is never blocked
      try {
        const fallback = clientFallbackExtract(message.trim());
        setClientName(fallback.clientName);
        setClientEmail(fallback.clientEmail);
        setDescription(fallback.description);
        setDueDate(fallback.dueDate);
        setNotes(fallback.notes);
        setLineItems(fallback.lineItems);
        setExtractedWarning(
          'Network connection was slow or interrupted. Invoice details were automatically extracted using our smart offline parser. Please review and verify values below.'
        );
        setIsExtracted(true);
        setExtractError(null);
      } catch (fallbackErr) {
        if (err.name === 'AbortError') {
          setExtractError(
            'Extraction request timed out. Click "Continue Manually" to create your invoice immediately.'
          );
        } else {
          setExtractError(err.message || 'Error communicating with Gemini AI extraction agent.');
        }
      }
    } finally {
      setIsExtracting(false);
    }
  };

  // Allow user to continue manually if they wish
  const handleContinueManually = () => {
    setExtractError(null);
    setClientName('Client');
    setClientEmail('');
    setDescription('Professional Services');
    setDueDate(new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]);
    setNotes('Payment due via PayPal upon receipt.');
    setLineItems([
      {
        id: `item-${Date.now()}`,
        name: 'Services as agreed',
        description: message.substring(0, 100),
        quantity: 1,
        unitPrice: 100,
        total: 100,
      },
    ]);
    setIsExtracted(true);
  };

  // Line item helpers
  const handleItemChange = (
    id: string,
    field: keyof Omit<LineItem, 'id' | 'total'>,
    value: string | number
  ) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        const updated = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unitPrice') {
          const qty = Number(field === 'quantity' ? value : item.quantity) || 0;
          const price = Number(field === 'unitPrice' ? value : item.unitPrice) || 0;
          updated.total = Number((qty * price).toFixed(2));
        }
        return updated;
      })
    );
  };

  const handleAddItem = () => {
    setLineItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        name: 'New Item or Deliverable',
        description: '',
        quantity: 1,
        unitPrice: 100,
        total: 100,
      },
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (lineItems.length <= 1) {
      setActionError('An invoice must have at least one line item.');
      return;
    }
    setActionError(null);
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  };

  const computedTotal = lineItems.reduce((acc, curr) => acc + (curr.total || 0), 0);

  // Handle Save as Draft
  const handleSaveDraft = async () => {
    setIsSubmitting(true);
    setActionError(null);
    try {
      const response = await authFetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: clientName.trim() || 'Client',
          clientEmail: clientEmail.trim(),
          description: description.trim() || 'Professional Services',
          dueDate,
          issueDate,
          notes,
          rawClientMessage: message,
          lineItems,
          amount: computedTotal,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save draft invoice');
      }

      const createdInvoice = await response.json();
      onInvoiceCreated(createdInvoice);
    } catch (err: any) {
      console.error('Save draft failed:', err);
      setActionError(err.message || 'Error saving invoice draft');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Approve and Send via PayPal Sandbox
  const handleApproveAndSend = async () => {
    setIsSubmitting(true);
    setActionError(null);
    try {
      // Step 1: Create the record in our database
      const createRes = await authFetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: clientName.trim() || 'Client',
          clientEmail: clientEmail.trim(),
          description: description.trim() || 'Professional Services',
          dueDate,
          issueDate,
          notes,
          rawClientMessage: message,
          lineItems,
          amount: computedTotal,
        }),
      });

      if (!createRes.ok) {
        const errorData = await createRes.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create invoice record');
      }

      const draftInvoice = await createRes.json();

      // Step 2: Trigger PayPal Sandbox dispatch (with human approval logged)
      const approveRes = await authFetch(`/api/invoices/${draftInvoice.id}/approve-and-send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!approveRes.ok) {
        const approveError = await approveRes.json().catch(() => ({}));
        throw new Error(approveError.error || 'PayPal Sandbox dispatch failed');
      }

      const sendResult = await approveRes.json();

      setApprovalResult({
        invoice: sendResult.invoice,
        paypalInvoiceId: sendResult.paypalResult.paypalInvoiceId,
        paypalPaymentLink: sendResult.paypalResult.paypalPaymentLink,
        paypalSellerLink: sendResult.paypalResult.paypalSellerLink,
        isSimulated: sendResult.paypalResult.isSimulated,
      });
    } catch (err: any) {
      console.error('Approval failed:', err);
      setActionError(err.message || 'PayPal Sandbox dispatch failed. Please check credentials or retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success Confirmation Screen
  if (approvalResult) {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-2xs">
          <CheckCircle2 className="w-6 h-6" />
        </div>

        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-slate-900">
            Invoice Approved &amp; Sent via PayPal!
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
            Invoice <span className="font-semibold text-slate-800">{approvalResult.invoice.invoiceNumber}</span>{' '}
            for <span className="font-semibold text-slate-800">${approvalResult.invoice.amount.toFixed(2)} USD</span> has
            been created and dispatched to {approvalResult.invoice.clientName}.
          </p>
        </div>

        {/* PayPal Details Box */}
        <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200/80 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-blue-900 uppercase tracking-wider">
              PayPal Sandbox Record
            </span>
            <span className="font-mono text-blue-800 bg-blue-100/80 px-2 py-0.5 rounded text-[11px]">
              {approvalResult.paypalInvoiceId}
            </span>
          </div>

          {/* Client Payment Link */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-blue-100 text-xs">
            <div>
              <span className="text-blue-900 font-semibold block">Client Payment Link:</span>
              <span className="text-[11px] text-blue-700">Official recipient checkout link (Sandbox)</span>
            </div>
            {approvalResult.paypalPaymentLink ? (
              <a
                href={approvalResult.paypalPaymentLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-white bg-blue-600 hover:bg-blue-700 font-semibold px-3.5 py-1.5 rounded-lg shadow-2xs transition-colors shrink-0"
              >
                Client checkout link
                <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
              </a>
            ) : (
              <span className="text-[11px] text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-md shrink-0">
                Payment link unavailable
              </span>
            )}
          </div>

          {/* Seller Link */}
          {approvalResult.paypalSellerLink && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-blue-100/60 text-xs">
              <div>
                <span className="text-slate-800 font-medium block">Seller Invoice Link:</span>
                <span className="text-[11px] text-slate-500">View in PayPal Sandbox dashboard</span>
              </div>
              <a
                href={approvalResult.paypalSellerLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 px-3 py-1.5 rounded-lg shadow-2xs transition-colors shrink-0 font-medium"
              >
                View in PayPal
                <ExternalLink className="w-3.5 h-3.5 ml-1.5 text-slate-400" />
              </a>
            </div>
          )}

          {!approvalResult.paypalPaymentLink && (
            <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 p-2 rounded-lg">
              Note: Generated in Sandbox Simulation mode. Configure <code>PAYPAL_CLIENT_ID</code> and{' '}
              <code>PAYPAL_CLIENT_SECRET</code> in Settings &gt; Secrets to dispatch live PayPal sandbox invoices and generate client checkout links.
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <button
            onClick={() => onInvoiceCreated(approvalResult.invoice)}
            className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-2xs"
          >
            View on Dashboard
          </button>
          <button
            onClick={() => {
              setApprovalResult(null);
              setIsExtracted(false);
              setMessage('');
            }}
            className="w-full sm:w-auto px-5 py-2.5 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl text-sm font-medium transition-colors"
          >
            Create Another Invoice
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <button
            onClick={onCancel}
            className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Dashboard
          </button>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            New Invoice from Message
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Paste any email, Slack message, or client request. Gemini AI extracts the details for your
            review.
          </p>
        </div>
      </div>

      {/* Step 1: Input Client Message */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center">
            <Sparkles className="w-4 h-4 text-blue-600 mr-1.5" />
            Paste Client Message or Email
          </label>
          <span className="text-xs text-slate-400">Powered by Gemini 3.8 Flash</span>
        </div>

        <div className="relative">
          <textarea
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={isExtracting}
            placeholder='e.g., "Hi, I need 3 logo designs and a banner, $400 total, can you send the invoice, due in 10 days. - Ravi (ravi@apexcreative.io)"'
            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:bg-white transition-all disabled:opacity-60"
          />
        </div>

        {/* Quick Presets */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Quick presets to test:
          </span>
          <div className="flex flex-wrap gap-2">
            {PRESET_MESSAGES.map((preset, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setMessage(preset.text)}
                className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 rounded-lg border border-slate-200 transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {extractError && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-2 text-xs">
            <div className="flex items-start space-x-2 text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-rose-900">Extraction Notice</p>
                <p className="text-rose-700 leading-relaxed">{extractError}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 pt-1 pl-6">
              <button
                type="button"
                onClick={handleExtract}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-lg text-xs transition-colors shadow-2xs"
              >
                Try Again
              </button>
              <button
                type="button"
                onClick={handleContinueManually}
                className="px-3 py-1 bg-white hover:bg-slate-50 text-slate-700 font-medium rounded-lg border border-slate-300 text-xs transition-colors"
              >
                Continue Manually
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={handleContinueManually}
            className="text-xs text-slate-500 hover:text-slate-800 font-medium underline-offset-2 hover:underline"
          >
            Or enter details manually without AI
          </button>

          <button
            type="button"
            onClick={handleExtract}
            disabled={isExtracting || !message.trim()}
            className="inline-flex items-center px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors shadow-2xs disabled:opacity-50"
          >
            {isExtracting ? (
              <>
                <Sparkles className="w-4 h-4 mr-2 animate-spin text-blue-200" />
                Extracting with Gemini AI...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Create Invoice
              </>
            )}
          </button>
        </div>
      </div>

      {/* Step 2: Extracted & Editable Preview */}
      {isExtracted && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden animate-in fade-in duration-200 space-y-6 p-5 sm:p-7">
          {extractedWarning && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start space-x-2.5 text-xs text-amber-800">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>{extractedWarning}</span>
            </div>
          )}

          {/* Review Required Callout / Safety Guarantee */}
          <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 flex items-start space-x-3 text-xs">
            <ShieldAlert className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-blue-900 text-sm">
                Mandatory Review: Nothing is sent without your approval
              </p>
              <p className="text-blue-700 mt-0.5">
                Gemini AI extracted the line items, prices, and due date from your message. Review and
                edit the fields below. Once you click <strong>&quot;Approve and send&quot;</strong>, the
                invoice will be dispatched through PayPal Invoicing (Sandbox).
              </p>
            </div>
          </div>

          <div className="border-b border-slate-100 pb-2">
            <h3 className="text-base font-bold text-slate-900">Editable Invoice Preview</h3>
            <p className="text-xs text-slate-500">Edit any details before final approval</p>
          </div>

          {/* Client & Description Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 flex items-center">
                <User className="w-3.5 h-3.5 mr-1 text-slate-400" /> Client Name / Company *
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                placeholder="Client Name"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 flex items-center">
                <Mail className="w-3.5 h-3.5 mr-1 text-slate-400" /> Client Email (for PayPal)
              </label>
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                placeholder="client@company.com"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-600 flex items-center">
                <FileText className="w-3.5 h-3.5 mr-1 text-slate-400" /> Invoice Description *
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                placeholder="High-level description of work"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 flex items-center">
                <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" /> Issue Date
              </label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 flex items-center">
                <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" /> Due Date *
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>
          </div>

          {/* Line Items Editor Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Line Items Breakdown
              </label>
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center text-xs text-blue-600 hover:text-blue-800 font-semibold"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Line Item
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Item Name &amp; Description</th>
                    <th className="py-2.5 px-2 text-right w-20">Qty</th>
                    <th className="py-2.5 px-2 text-right w-28">Unit ($)</th>
                    <th className="py-2.5 px-3 text-right w-28">Total ($)</th>
                    <th className="py-2.5 px-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lineItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3 space-y-1">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => handleItemChange(item.id, 'name', e.target.value)}
                          placeholder="Item or deliverable"
                          className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs font-medium text-slate-900 focus:border-blue-600"
                        />
                        <input
                          type="text"
                          value={item.description || ''}
                          onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                          placeholder="Optional detail/deliverable note"
                          className="w-full px-2 py-0.5 bg-white border border-slate-100 rounded text-[11px] text-slate-500 focus:border-blue-600"
                        />
                      </td>

                      <td className="py-2 px-2 text-right">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={item.quantity}
                          onChange={(e) =>
                            handleItemChange(item.id, 'quantity', parseInt(e.target.value, 10) || 1)
                          }
                          className="w-16 px-2 py-1 text-right bg-white border border-slate-200 rounded text-xs text-slate-900 focus:border-blue-600"
                        />
                      </td>

                      <td className="py-2 px-2 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) =>
                            handleItemChange(
                              item.id,
                              'unitPrice',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-24 px-2 py-1 text-right bg-white border border-slate-200 rounded text-xs text-slate-900 focus:border-blue-600"
                        />
                      </td>

                      <td className="py-2 px-3 text-right font-bold text-slate-900 text-xs">
                        ${item.total.toFixed(2)}
                      </td>

                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200">
                  <tr>
                    <td colSpan={3} className="py-3 px-3 text-right font-semibold text-slate-700">
                      Total Due (USD):
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900 text-sm">
                      ${computedTotal.toFixed(2)} USD
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Notes & Terms */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">
              Payment Terms &amp; Client Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>

          {actionError && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-2">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-rose-900">Dispatch Error</p>
                  <p className="text-rose-700 leading-relaxed">{actionError}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2 pt-1 pl-6">
                <button
                  type="button"
                  onClick={handleApproveAndSend}
                  disabled={isSubmitting}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-lg text-xs transition-colors shadow-2xs disabled:opacity-50"
                >
                  Retry Approval &amp; Send
                </button>
                <button
                  type="button"
                  onClick={() => setActionError(null)}
                  className="px-3 py-1 bg-white hover:bg-slate-50 text-slate-700 font-medium rounded-lg border border-slate-300 text-xs transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons: Human Approval */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-500 flex items-center">
              <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></span>
              Ready for Sandbox Invoicing dispatch
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={isSubmitting}
                className="w-1/2 sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs sm:text-sm font-medium transition-colors disabled:opacity-50"
              >
                Save as Draft
              </button>

              <button
                type="button"
                onClick={handleApproveAndSend}
                disabled={isSubmitting || computedTotal <= 0}
                className="w-1/2 sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold transition-colors shadow-2xs flex items-center justify-center disabled:opacity-50"
              >
                <Send className="w-4 h-4 mr-1.5" />
                {isSubmitting ? 'Sending via PayPal...' : 'Approve and send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
