import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  CreditCard,
  Send,
  MessageSquare,
  Building2,
  Calendar,
  Receipt,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { PublicInvoiceData } from '../../types/invoice';

interface CustomerPayViewProps {
  token: string;
}

export const CustomerPayView: React.FC<CustomerPayViewProps> = ({ token }) => {
  const [invoice, setInvoice] = useState<PublicInvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Message box state
  const [messageText, setMessageText] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [messageSentSuccess, setMessageSentSuccess] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);

  const fetchInvoice = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    try {
      const res = await fetch(`/api/public/pay/${encodeURIComponent(token)}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Invoice not found. Please check your link or contact the business.');
        }
        throw new Error('Unable to load invoice details.');
      }
      const data: PublicInvoiceData = await res.json();
      setInvoice(data);
      setLastRefreshed(new Date());
      setError(null);
    } catch (err: any) {
      if (!invoice) {
        setError(err.message || 'Error loading invoice');
      }
    } finally {
      setLoading(false);
      if (isManualRefresh) setIsRefreshing(false);
    }
  }, [token, invoice]);

  // Initial load
  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  // Automatic 30-second polling as requested
  useEffect(() => {
    const interval = setInterval(() => {
      fetchInvoice(false);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchInvoice]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || isSendingMessage) return;

    setIsSendingMessage(true);
    setMessageError(null);
    setMessageSentSuccess(false);

    try {
      const res = await fetch(`/api/public/pay/${encodeURIComponent(token)}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText.trim() }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to send message');
      }

      const resData = await res.json();
      setMessageText('');
      setMessageSentSuccess(true);

      // Update local invoice messages if returned
      if (resData.clientMessages && invoice) {
        setInvoice({
          ...invoice,
          clientMessages: resData.clientMessages,
        });
      }

      setTimeout(() => setMessageSentSuccess(false), 5000);
    } catch (err: any) {
      setMessageError(err.message || 'Could not deliver message. Please try again.');
    } finally {
      setIsSendingMessage(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm font-medium text-slate-600">Loading your invoice...</p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center space-y-4">
          <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Invoice Link Error</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            {error || 'This invoice link is invalid or has expired.'}
          </p>
          <button
            onClick={() => {
              setLoading(true);
              fetchInvoice();
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors shadow-xs"
          >
            <RefreshCw className="w-4 h-4" /> Try Again
          </button>
        </div>
      </div>
    );
  }

  const isPaid = invoice.status === 'Paid';
  const isOverdue = invoice.status === 'Overdue';
  const paypalUrl =
    invoice.paypalPaymentLink ||
    `https://www.sandbox.paypal.com/invoice/p/#${invoice.invoiceNumber.replace(/[^A-Za-z0-9]/g, '')}`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Top Branding Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/80 backdrop-blur-md px-6 py-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white flex items-center justify-center shadow-xs">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">
                {invoice.businessName}
              </h1>
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Verified Merchant Portal
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-600' : 'text-slate-400'}`} />
              Auto-refreshes every 30s
            </span>
            <button
              onClick={() => fetchInvoice(true)}
              className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800"
              title="Refresh status now"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Status Alert Banner */}
        {isPaid ? (
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-2 border-emerald-500/30 rounded-2xl p-6 text-emerald-900 shadow-xs">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-emerald-950">Thank you, payment received</h2>
                <p className="text-sm text-emerald-800 leading-relaxed">
                  Your payment of <strong className="font-semibold">${invoice.amount.toFixed(2)} USD</strong> for Invoice #{invoice.invoiceNumber} has been received and confirmed. No further action is required.
                </p>
                <div className="pt-2 flex items-center gap-2 text-xs font-semibold text-emerald-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Official Receipt • Paid in Full
                </div>
              </div>
            </div>
          </div>
        ) : isOverdue ? (
          <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 text-amber-900 shadow-xs flex items-center gap-3.5">
            <AlertCircle className="w-6 h-6 text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-950">Payment Overdue</p>
              <p className="text-xs text-amber-800">
                This invoice was due on {invoice.dueDate}. Please complete your payment below to keep your account in good standing.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 text-blue-900 shadow-xs flex items-center gap-3.5">
            <Clock className="w-6 h-6 text-blue-600 shrink-0" />
            <div>
              <p className="text-sm font-bold text-blue-950">Invoice Ready for Payment</p>
              <p className="text-xs text-blue-800">
                Payment is due on {invoice.dueDate}. You can review your line items and pay securely online below.
              </p>
            </div>
          </div>
        )}

        {/* Main Invoice Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200/90 overflow-hidden">
          {/* Invoice Header */}
          <div className="p-6 sm:p-8 border-b border-slate-100 bg-gradient-to-b from-white to-slate-50/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Invoice Details
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
                  {invoice.invoiceNumber}
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  Billed to <strong className="text-slate-800">{invoice.clientName}</strong>
                  {invoice.clientEmail ? ` (${invoice.clientEmail})` : ''}
                </p>
              </div>

              {/* Status Badge */}
              <div className="sm:text-right">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                    isPaid
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : isOverdue
                      ? 'bg-rose-100 text-rose-800 border border-rose-300'
                      : 'bg-blue-100 text-blue-800 border border-blue-300'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isPaid ? 'bg-emerald-600' : isOverdue ? 'bg-rose-600' : 'bg-blue-600'
                    }`}
                  />
                  {invoice.status}
                </span>
              </div>
            </div>

            {/* Dates row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-200/60 text-xs">
              <div>
                <span className="text-slate-400 font-medium">Issue Date</span>
                <p className="text-slate-800 font-semibold text-sm mt-0.5">{invoice.issueDate}</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Due Date</span>
                <p className={`font-semibold text-sm mt-0.5 ${isOverdue ? 'text-rose-600 font-bold' : 'text-slate-800'}`}>
                  {invoice.dueDate}
                </p>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <span className="text-slate-400 font-medium">Currency</span>
                <p className="text-slate-800 font-semibold text-sm mt-0.5">USD ($)</p>
              </div>
            </div>
          </div>

          {/* Description */}
          {invoice.description && (
            <div className="px-6 sm:px-8 py-4 bg-slate-50/50 border-b border-slate-100 text-xs text-slate-600">
              <span className="font-semibold text-slate-700">Project / Description:</span> {invoice.description}
            </div>
          )}

          {/* Line Items Table */}
          <div className="p-6 sm:p-8">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Line Items
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-xs font-semibold">
                    <th className="pb-3 pr-4">Description</th>
                    <th className="pb-3 px-3 text-right">Qty</th>
                    <th className="pb-3 px-3 text-right">Unit Price</th>
                    <th className="pb-3 pl-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {invoice.lineItems && invoice.lineItems.length > 0 ? (
                    invoice.lineItems.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-slate-50/50">
                        <td className="py-3.5 pr-4">
                          <p className="font-semibold text-slate-900">{item.name}</p>
                          {item.description && (
                            <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono text-slate-600">
                          {item.quantity}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono text-slate-600">
                          ${item.unitPrice.toFixed(2)}
                        </td>
                        <td className="py-3.5 pl-3 text-right font-mono font-semibold text-slate-900">
                          ${item.total.toFixed(2)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-4 text-slate-500 text-center">
                        Standard professional services
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Total Section */}
            <div className="mt-6 pt-6 border-t-2 border-slate-100 flex flex-col sm:flex-row items-end sm:items-center justify-between gap-4">
              <div className="text-xs text-slate-500">
                {invoice.notes && (
                  <p className="max-w-md italic">
                    <span className="font-semibold text-slate-600">Note:</span> {invoice.notes}
                  </p>
                )}
              </div>
              <div className="w-full sm:w-auto bg-slate-50 rounded-2xl p-5 border border-slate-200/80 text-right min-w-[240px]">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Total Amount Due
                </span>
                <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-1 font-mono tracking-tight">
                  ${invoice.amount.toFixed(2)} <span className="text-lg font-normal text-slate-500">USD</span>
                </div>
              </div>
            </div>

            {/* Payment Action Bar */}
            <div className="mt-8 pt-6 border-t border-slate-100">
              {isPaid ? (
                <div className="bg-emerald-50 rounded-2xl p-4 text-center border border-emerald-200 flex items-center justify-center gap-2 text-emerald-800 font-bold">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  This invoice has been fully paid. Thank you!
                </div>
              ) : (
                <div className="space-y-3">
                  <a
                    href={paypalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-2xl text-white font-bold text-base sm:text-lg shadow-lg hover:shadow-xl transition-all duration-200 bg-[#0070BA] hover:bg-[#005ea6] active:scale-[0.99]"
                  >
                    <CreditCard className="w-5 h-5" />
                    <span>Pay Now with PayPal</span>
                    <ExternalLink className="w-4 h-4 opacity-75" />
                  </a>
                  <p className="text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Secure checkout via PayPal Sandbox. Supports credit cards, debit cards, and PayPal balance.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Message the Business Section */}
        <div className="bg-white rounded-3xl shadow-lg border border-slate-200/90 p-6 sm:p-8 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                Message {invoice.businessName}
              </h3>
              <p className="text-xs text-slate-500">
                Need to arrange an extension, discuss installments, or have questions about this invoice? Send a direct message below.
              </p>
            </div>
          </div>

          {/* Existing messages thread if any */}
          {invoice.clientMessages && invoice.clientMessages.length > 0 && (
            <div className="space-y-3 pt-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Message History
              </span>
              <div className="space-y-2.5 max-h-60 overflow-y-auto p-3 rounded-2xl bg-slate-50 border border-slate-200/70">
                {invoice.clientMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-3 rounded-xl text-xs sm:text-sm ${
                      msg.sender === 'client'
                        ? 'bg-purple-100/70 text-purple-950 border border-purple-200/60 ml-4'
                        : 'bg-white text-slate-800 border border-slate-200 mr-4 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1 text-[11px] font-semibold text-slate-500">
                      <span>{msg.sender === 'client' ? 'You' : invoice.businessName}</span>
                      <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Message Form */}
          <form onSubmit={handleSendMessage} className="space-y-3">
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder={`Write a message to ${invoice.businessName} (e.g. "Can I pay half now and half next Friday?" or "Please confirm invoice details")...`}
              rows={3}
              className="w-full text-sm rounded-2xl border border-slate-200 p-3.5 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all placeholder:text-slate-400"
              disabled={isSendingMessage}
            />

            {messageError && (
              <p className="text-xs text-rose-600 flex items-center gap-1.5 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                {messageError}
              </p>
            )}

            {messageSentSuccess && (
              <p className="text-xs text-emerald-600 flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Your message has been sent to the business. They will review it shortly.
              </p>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!messageText.trim() || isSendingMessage}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xs"
              >
                {isSendingMessage ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Message
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-400 py-4">
          Powered by NudgePay • Client Payment Portal
        </div>
      </div>
    </div>
  );
};
