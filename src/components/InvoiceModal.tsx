import React from 'react';
import {
  X,
  ExternalLink,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  DollarSign,
  Mail,
  User,
  History,
  MessageSquare,
  Split,
} from 'lucide-react';
import { Invoice, ActivityLogEntry } from '../../types/invoice';

interface InvoiceModalProps {
  invoice: Invoice | null;
  activityLogs: ActivityLogEntry[];
  isOpen: boolean;
  onClose: () => void;
  onMarkPaid: (id: string) => void;
  onApproveAndSend: (invoice: Invoice) => void;
  onDraftReminder?: (invoice: Invoice) => void;
  onClientReply?: (invoice: Invoice) => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  invoice,
  activityLogs,
  isOpen,
  onClose,
  onMarkPaid,
  onApproveAndSend,
  onDraftReminder,
  onClientReply,
}) => {
  if (!isOpen || !invoice) return null;

  const getStatusBadge = (status: Invoice['status']) => {
    switch (status) {
      case 'Paid':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Paid
          </span>
        );
      case 'Overdue':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Overdue
          </span>
        );
      case 'Sent':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            <Clock className="w-3.5 h-3.5 mr-1" /> Sent
          </span>
        );
      case 'Partially paid':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3.5 h-3.5 mr-1" /> Partially paid
          </span>
        );
      case 'Payment pending':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
            <Clock className="w-3.5 h-3.5 mr-1" /> Payment pending
          </span>
        );
      case 'Cancelled':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-200 text-slate-600 border border-slate-300">
            <X className="w-3.5 h-3.5 mr-1" /> Cancelled
          </span>
        );
      case 'Draft':
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
            <FileText className="w-3.5 h-3.5 mr-1" /> Draft
          </span>
        );
    }
  };

  const invoiceLogs = activityLogs.filter(
    (l) => l.invoiceId === invoice.id || l.invoiceNumber === invoice.invoiceNumber
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900">{invoice.invoiceNumber}</h3>
                {getStatusBadge(invoice.status)}
                {invoice.rawPayPalStatus && (
                  <span className="text-xs text-slate-400 font-mono">
                    (PayPal: {invoice.rawPayPalStatus})
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{invoice.description}</p>
              {invoice.lastSyncError && (
                <p className="text-xs text-rose-600 font-medium mt-1">
                  Sync Error: {invoice.lastSyncError}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 space-y-6 overflow-y-auto text-slate-700 text-sm">
          {/* Key Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Client Information
              </p>
              <div className="space-y-1">
                <div className="flex items-center text-slate-900 font-medium">
                  <User className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                  {invoice.clientName}
                </div>
                {invoice.clientEmail ? (
                  <div className="flex items-center text-slate-600 text-xs">
                    <Mail className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                    {invoice.clientEmail}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 italic">No email provided</div>
                )}
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Dates & Amount
              </p>
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center">
                    <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" /> Issue Date:
                  </span>
                  <span className="font-medium text-slate-800">{invoice.issueDate}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center">
                    <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" /> Due Date:
                  </span>
                  <span
                    className={`font-semibold ${invoice.status === 'Overdue' ? 'text-rose-600' : 'text-slate-800'}`}
                  >
                    {invoice.dueDate}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-sm">
                  <span className="text-slate-600 font-medium">Total Amount:</span>
                  <span className="font-bold text-slate-900 text-base">
                    ${invoice.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Line Items
            </h4>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                  <tr>
                    <th className="py-2.5 px-4">Item & Description</th>
                    <th className="py-2.5 px-3 text-right">Qty</th>
                    <th className="py-2.5 px-3 text-right">Unit Price</th>
                    <th className="py-2.5 px-4 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoice.lineItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-4">
                        <div className="font-medium text-slate-900">{item.name}</div>
                        {item.description && (
                          <div className="text-[11px] text-slate-500 mt-0.5">{item.description}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-600">{item.quantity}</td>
                      <td className="py-2.5 px-3 text-right text-slate-600">
                        ${item.unitPrice.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-semibold text-slate-900">
                        ${item.total.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200 font-bold">
                  <tr>
                    <td colSpan={3} className="py-3 px-4 text-right text-slate-700">
                      Total:
                    </td>
                    <td className="py-3 px-4 text-right text-slate-900 text-sm">
                      ${invoice.amount.toFixed(2)} USD
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* PayPal Sandbox Information */}
          <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-900 uppercase tracking-wider flex items-center">
                <span className="w-2 h-2 rounded-full bg-blue-600 mr-2"></span>
                PayPal Invoicing (Sandbox)
              </span>
              {invoice.paypalInvoiceId && (
                <span className="text-[11px] font-mono text-blue-800 bg-blue-100/70 px-2 py-0.5 rounded">
                  {invoice.paypalInvoiceId}
                </span>
              )}
            </div>

            {/* Client Payment Link (recipient_view_url) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-blue-100/80">
              <div>
                <span className="text-xs font-semibold text-slate-800 block">
                  Client Payment Link (recipient_view_url):
                </span>
                <span className="text-[11px] text-slate-500">
                  Direct checkout URL for the payer to review and pay
                </span>
              </div>
              {invoice.paypalPaymentLink ? (
                <a
                  href={invoice.paypalPaymentLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3.5 py-1.5 rounded-lg shadow-2xs transition-colors shrink-0"
                >
                  Pay now (client view)
                  <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                </a>
              ) : (
                <span className="text-xs text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-md shrink-0">
                  Payment link unavailable
                </span>
              )}
            </div>

            {/* Seller Link (invoicer_view_url) */}
            {invoice.paypalSellerLink && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-blue-100/80">
                <div>
                  <span className="text-xs font-semibold text-slate-800 block">
                    Merchant Link (invoicer_view_url):
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Seller view in PayPal Sandbox dashboard
                  </span>
                </div>
                <a
                  href={invoice.paypalSellerLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 px-3 py-1.5 rounded-lg shadow-2xs transition-colors shrink-0"
                >
                  View in PayPal
                  <ExternalLink className="w-3.5 h-3.5 ml-1 text-slate-400" />
                </a>
              </div>
            )}

            {!invoice.paypalPaymentLink && invoice.status !== 'Draft' && (
              <p className="text-[11px] text-blue-700 bg-white/80 p-2.5 rounded-lg border border-blue-100 mt-1">
                To fetch live PayPal recipient checkout links, ensure <code>PAYPAL_CLIENT_ID</code> and{' '}
                <code>PAYPAL_CLIENT_SECRET</code> are configured in Settings &gt; Secrets, then click &quot;Refresh status&quot;.
              </p>
            )}
          </div>

          {/* Negotiated Terms or Installments (if any) */}
          {invoice.installments && invoice.installments.length > 0 && (
            <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/50 space-y-2">
              <span className="text-xs font-semibold text-purple-900 uppercase tracking-wider flex items-center">
                <Split className="w-3.5 h-3.5 mr-1.5 text-purple-600" />
                Approved Payment Split Schedule ({invoice.installments.length} Installments)
              </span>
              <div className="space-y-1.5 pt-1">
                {invoice.installments.map((inst, i) => (
                  <div
                    key={i}
                    className="p-2.5 bg-white rounded-lg border border-purple-100 flex items-center justify-between text-xs"
                  >
                    <span className="font-medium text-slate-800">{inst.label}</span>
                    <div className="space-x-3 text-right">
                      <span className="font-bold text-slate-900">${inst.amount.toFixed(2)} USD</span>
                      <span className="text-slate-500 font-mono text-[11px]">Due {inst.dueDate}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reminder History info */}
          {invoice.remindersCount ? (
            <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-800 flex items-center justify-between">
              <span className="flex items-center font-medium">
                <Mail className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
                {invoice.remindersCount} overdue reminder{invoice.remindersCount === 1 ? '' : 's'} sent
              </span>
              {invoice.lastReminderSentAt && (
                <span className="text-[11px] text-amber-700">
                  Last sent: {new Date(invoice.lastReminderSentAt).toLocaleDateString()}
                </span>
              )}
            </div>
          ) : null}

          {/* Raw Message (if available) */}
          {invoice.rawClientMessage && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Original Message Extracted by AI
              </h4>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 font-mono italic whitespace-pre-wrap">
                &ldquo;{invoice.rawClientMessage}&rdquo;
              </div>
            </div>
          )}

          {/* Activity Log for this invoice */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center">
              <History className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
              Invoice Audit History
            </h4>
            {invoiceLogs.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No activity recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {invoiceLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-start justify-between text-xs"
                  >
                    <div>
                      <span className="font-semibold text-slate-800 capitalize">
                        {log.action}
                      </span>
                      <p className="text-slate-600 mt-0.5">{log.description}</p>
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0 ml-3">
                      {new Date(log.timestamp).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {invoice.status === 'Draft' && (
              <button
                onClick={() => {
                  onClose();
                  onApproveAndSend(invoice);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition-colors flex items-center"
              >
                Approve &amp; Send via PayPal
              </button>
            )}

            {(invoice.status === 'Sent' || invoice.status === 'Overdue') && onDraftReminder && (
              <button
                onClick={() => {
                  onClose();
                  onDraftReminder(invoice);
                }}
                className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-semibold shadow-2xs transition-colors flex items-center"
              >
                <Mail className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
                Draft Reminder
              </button>
            )}

            {onClientReply && (
              <button
                onClick={() => {
                  onClose();
                  onClientReply(invoice);
                }}
                className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-xl text-xs font-semibold shadow-2xs transition-colors flex items-center"
              >
                <MessageSquare className="w-3.5 h-3.5 mr-1.5 text-purple-600" />
                Paste Client Reply
              </button>
            )}

            {(invoice.status === 'Sent' || invoice.status === 'Overdue') && (
              <button
                onClick={() => {
                  onMarkPaid(invoice.id);
                  onClose();
                }}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                Mark as Paid
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs sm:text-sm font-medium hover:bg-slate-100 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

