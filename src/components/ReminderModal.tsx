import React, { useState, useEffect } from 'react';
import {
  X,
  Mail,
  Send,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  Edit3,
} from 'lucide-react';
import { Invoice, ReminderDraft } from '../../types/invoice';

interface ReminderModalProps {
  invoice: Invoice | null;
  isOpen: boolean;
  onClose: () => void;
  onReminderSent: (invoice: Invoice, message: string) => void;
}

export const ReminderModal: React.FC<ReminderModalProps> = ({
  invoice,
  isOpen,
  onClose,
  onReminderSent,
}) => {
  const [draft, setDraft] = useState<ReminderDraft | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Automatically fetch draft when modal opens
  useEffect(() => {
    if (isOpen && invoice) {
      setIsLoading(true);
      setError(null);
      setDraft(null);

      fetch(`/api/invoices/${invoice.id}/draft-reminder`, {
        method: 'POST',
      })
        .then((res) => {
          if (!res.ok) throw new Error('Failed to draft reminder with Gemini AI');
          return res.json();
        })
        .then((data: ReminderDraft) => {
          setDraft(data);
          setSubject(data.subject);
          setBody(data.body);
          setRecipientEmail(data.clientEmail || invoice.clientEmail || '');
        })
        .catch((err) => {
          console.error('Error drafting reminder:', err);
          setError(err.message || 'Failed to generate reminder draft');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, invoice]);

  if (!isOpen || !invoice) return null;

  const handleApproveAndSend = async () => {
    setIsSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/send-reminder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          body,
          recipientEmail,
          tone: draft?.tone,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to dispatch reminder');
      }

      const data = await res.json();
      onReminderSent(data.invoice, `Reminder dispatched to ${recipientEmail}!`);
      onClose();
    } catch (err: any) {
      console.error('Failed to send reminder:', err);
      setError(err.message || 'Failed to send reminder');
    } finally {
      setIsSending(false);
    }
  };

  const getToneBadge = () => {
    if (!draft) return null;
    switch (draft.tone) {
      case 'friendly':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5"></span>
            Friendly Reminder ({draft.daysOverdue} days overdue)
          </span>
        );
      case 'firm':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span>
            Firm Follow-up ({draft.daysOverdue} days overdue)
          </span>
        );
      case 'final':
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5"></span>
            Final Notice ({draft.daysOverdue} days overdue)
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  Draft Overdue Reminder
                </h3>
                <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-800 rounded font-mono">
                  {invoice.invoiceNumber}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                AI-crafted collections email based on days overdue
              </p>
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
        <div className="p-6 space-y-4 overflow-y-auto text-sm text-slate-700">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center">
              <AlertTriangle className="w-4 h-4 text-rose-600 mr-2 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isLoading ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <div className="space-y-1">
                <p className="font-semibold text-slate-800 text-sm">
                  Generating tailored reminder with Gemini AI...
                </p>
                <p className="text-xs text-slate-400">
                  Calibrating tone according to due date ({invoice.dueDate}) and client history.
                </p>
              </div>
            </div>
          ) : draft ? (
            <div className="space-y-4">
              {/* Context Summary Banner */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  {getToneBadge()}
                  <span className="text-xs text-slate-500">
                    Amount:{' '}
                    <strong className="text-slate-900 font-bold">
                      ${invoice.amount.toFixed(2)} USD
                    </strong>
                  </span>
                </div>
                <div className="text-xs text-slate-500">
                  Due: <span className="font-medium text-slate-800">{invoice.dueDate}</span>
                </div>
              </div>

              {/* Recipient Field */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Recipient Email
                </label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="client@company.com"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:bg-white transition-all font-mono"
                />
              </div>

              {/* Subject Field */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center justify-between">
                  <span>Subject Line</span>
                  <span className="text-[11px] font-normal text-slate-400">Editable</span>
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:bg-white transition-all"
                />
              </div>

              {/* Body Textarea */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center justify-between">
                  <span>Message Body</span>
                  <span className="text-[11px] font-normal text-blue-600 flex items-center">
                    <Sparkles className="w-3 h-3 mr-1" /> Includes Pay now link &amp; terms
                  </span>
                </label>
                <textarea
                  rows={8}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 font-sans focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:bg-white transition-all leading-relaxed"
                />
              </div>

              {/* Pay now link verification preview */}
              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200/80 text-xs text-blue-900 flex items-center justify-between">
                <div className="truncate mr-2">
                  <span className="font-semibold block">Verified Client Payment URL:</span>
                  <span className="font-mono text-[11px] text-blue-700 truncate block">
                    {draft.paymentLink}
                  </span>
                </div>
                {draft.paymentLink && (
                  <a
                    href={draft.paymentLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-blue-700 hover:text-blue-900 hover:bg-blue-100 rounded-md shrink-0 transition-colors"
                    title="Test Pay now link"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>

              <div className="p-3 rounded-lg bg-amber-50/80 border border-amber-200 text-[11px] text-amber-800">
                <strong>Explicit Approval Required:</strong> Nothing is sent to the client until you
                click &ldquo;Approve and send&rdquo; below. You can freely edit any text above.
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={isSending}
            className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-semibold hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleApproveAndSend}
            disabled={isLoading || isSending || !draft}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-xs flex items-center transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4 mr-1.5" />
            <span>{isSending ? 'Sending reminder...' : 'Approve and send'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
