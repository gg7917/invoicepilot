import React, { useState } from 'react';
import {
  ShieldAlert,
  Bot,
  CheckCircle2,
  XCircle,
  Edit3,
  Send,
  Sparkles,
  AlertTriangle,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Check,
  Mail,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { ApprovalDraft, Invoice, LastAgentRunSummary } from '../../types/invoice';

interface ApprovalQueueViewProps {
  drafts: ApprovalDraft[];
  invoices: Invoice[];
  isLoading: boolean;
  isRunningAgent: boolean;
  lastAgentRun?: LastAgentRunSummary | null;
  onRunAgent: () => void;
  onApprove: (draftId: string, customDetails?: { subject?: string; body?: string; recipientEmail?: string }) => Promise<void>;
  onReject: (draftId: string, reason?: string) => Promise<void>;
  onUpdateDraft: (draftId: string, updates: Partial<ApprovalDraft>) => Promise<void>;
  onApproveAll: () => Promise<void>;
  onSelectInvoice?: (invoice: Invoice) => void;
}

export const ApprovalQueueView: React.FC<ApprovalQueueViewProps> = ({
  drafts,
  invoices,
  isLoading,
  isRunningAgent,
  lastAgentRun,
  onRunAgent,
  onApprove,
  onReject,
  onUpdateDraft,
  onApproveAll,
  onSelectInvoice,
}) => {
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editRecipient, setEditRecipient] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [isApprovingAll, setIsApprovingAll] = useState(false);

  const pendingDrafts = drafts.filter((d) => d.status === 'pending');

  const startEditing = (draft: ApprovalDraft) => {
    setEditingDraftId(draft.id);
    setEditSubject(draft.subject);
    setEditBody(draft.body);
    setEditRecipient(draft.clientEmail);
  };

  const cancelEditing = () => {
    setEditingDraftId(null);
  };

  const handleSaveEdit = async (draftId: string) => {
    setActionLoadingId(draftId);
    try {
      await onUpdateDraft(draftId, {
        subject: editSubject,
        body: editBody,
        clientEmail: editRecipient,
      });
      setEditingDraftId(null);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleApproveClick = async (draft: ApprovalDraft) => {
    setActionLoadingId(draft.id);
    try {
      if (editingDraftId === draft.id) {
        await onApprove(draft.id, {
          subject: editSubject,
          body: editBody,
          recipientEmail: editRecipient,
        });
        setEditingDraftId(null);
      } else {
        await onApprove(draft.id);
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectClick = async (draft: ApprovalDraft) => {
    setActionLoadingId(draft.id);
    try {
      await onReject(draft.id, 'Dismissed by user');
      if (editingDraftId === draft.id) {
        setEditingDraftId(null);
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleBatchApprove = async () => {
    setIsApprovingAll(true);
    try {
      await onApproveAll();
    } finally {
      setIsApprovingAll(false);
    }
  };

  const getToneBadge = (tone: ApprovalDraft['tone'], daysOverdue: number) => {
    if (tone === 'final' || daysOverdue >= 22) {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5"></span>
          Final Notice ({daysOverdue}d overdue)
        </span>
      );
    }
    if (tone === 'firm' || daysOverdue >= 8) {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span>
          Firm Follow-up ({daysOverdue}d overdue)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5"></span>
        Friendly Reminder ({daysOverdue}d overdue)
      </span>
    );
  };

  const formatRunTime = (isoString?: string) => {
    if (!isoString) return 'Recently';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      const now = new Date();
      const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
      if (diffSec < 60) return 'Just now';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return isoString;
    }
  };

  const activeLastRun = lastAgentRun || (pendingDrafts.length > 0 ? {
    timestamp: pendingDrafts[0].createdAt || new Date().toISOString(),
    overdueCount: pendingDrafts.length,
    draftsCreatedCount: pendingDrafts.length,
    draftsReasoning: pendingDrafts.map((d) => {
      const parenMatch = d.clientName.match(/\((.*?)\)/);
      const rawName = parenMatch ? parenMatch[1] : d.clientName;
      const cleanName = rawName.replace(/^Dr\.\s*/i, '');
      const shortName = cleanName.split(' ')[0] || d.clientName;
      return {
        clientName: d.clientName,
        invoiceNumber: d.invoiceNumber,
        daysOverdue: d.daysOverdue,
        tone: d.tone,
        line: `${shortName}: ${d.daysOverdue} days overdue, ${d.tone} tone`,
      };
    }),
  } : null);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Banner & Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center">
                  Approval Queue
                  {pendingDrafts.length > 0 && (
                    <span className="ml-2.5 px-2 py-0.5 text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 rounded-full">
                      {pendingDrafts.length} Pending
                    </span>
                  )}
                </h1>
                <p className="text-xs text-slate-500">
                  Autonomous collections agent scans overdue accounts. Review and approve before any email is dispatched.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onRunAgent}
              disabled={isRunningAgent}
              className="inline-flex items-center px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors disabled:opacity-60 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 mr-1.5 ${isRunningAgent ? 'animate-spin' : ''}`} />
              <span>{isRunningAgent ? 'Scanning Invoices...' : 'Run collections agent'}</span>
            </button>

            {pendingDrafts.length > 1 && (
              <button
                type="button"
                onClick={handleBatchApprove}
                disabled={isApprovingAll || isRunningAgent}
                className="inline-flex items-center px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors disabled:opacity-60 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                <span>{isApprovingAll ? 'Approving...' : `Approve all (${pendingDrafts.length})`}</span>
              </button>
            )}
          </div>
        </div>

        {/* Short "Last agent run" summary under the button */}
        {activeLastRun && (
          <div className="mt-5 pt-4 border-t border-slate-100">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse shrink-0" />
                  <span className="text-xs font-bold text-slate-900">Last agent run</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-xs text-slate-500 font-medium flex items-center">
                    <Clock className="w-3.5 h-3.5 mr-1 text-slate-400" />
                    {formatRunTime(activeLastRun.timestamp)}
                  </span>
                </div>
                <div className="flex items-center space-x-2 text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                    {activeLastRun.overdueCount} overdue invoice{activeLastRun.overdueCount === 1 ? '' : 's'} found
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                    {activeLastRun.draftsCreatedCount} draft{activeLastRun.draftsCreatedCount === 1 ? '' : 's'} created
                  </span>
                </div>
              </div>

              {/* One line of reasoning per draft */}
              {activeLastRun.draftsReasoning && activeLastRun.draftsReasoning.length > 0 ? (
                <div className="pt-2 border-t border-slate-200/60">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Agent Reasoning by Overdue Account:
                  </p>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {activeLastRun.draftsReasoning.map((item, idx) => (
                      <li
                        key={idx}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200/80 shadow-2xs"
                      >
                        <div className="flex items-center space-x-2 min-w-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />
                          <span className="font-semibold text-slate-800 truncate">
                            {item.line}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 shrink-0 ml-2 font-mono">
                          {item.invoiceNumber}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">
                  No overdue invoices found during the last scan. All active accounts are current.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Informational Policy Banner */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>
              <strong>Zero-Unintended-Send Guarantee:</strong> Nothing is dispatched without explicit user approval.
            </span>
          </div>
          <span className="hidden sm:inline text-slate-400">
            Duplicate prevention active
          </span>
        </div>
      </div>

      {/* Queue Content */}
      {pendingDrafts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center shadow-2xs">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-50 text-slate-400 border border-slate-200 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-7 h-7 text-emerald-500" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Approval queue is empty</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1.5">
            All overdue accounts have been reviewed, or all active invoices are currently within payment terms. Click &ldquo;Run collections agent&rdquo; to scan your invoices anytime.
          </p>
          <div className="mt-6">
            <button
              type="button"
              onClick={onRunAgent}
              disabled={isRunningAgent}
              className="inline-flex items-center px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRunningAgent ? 'animate-spin' : ''}`} />
              <span>{isRunningAgent ? 'Scanning Invoices...' : 'Run collections agent now'}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {pendingDrafts.map((draft) => {
            const isEditing = editingDraftId === draft.id;
            const isProcessing = actionLoadingId === draft.id;
            const correspondingInvoice = invoices.find((inv) => inv.id === draft.invoiceId);

            return (
              <div
                key={draft.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden transition-all hover:border-slate-300"
              >
                {/* Draft Header */}
                <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (correspondingInvoice && onSelectInvoice) {
                          onSelectInvoice(correspondingInvoice);
                        }
                      }}
                      className="text-left group"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold text-blue-600 group-hover:underline">
                          {draft.invoiceNumber}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="text-sm font-bold text-slate-900 group-hover:text-blue-700">
                          {draft.clientName}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Due: {draft.dueDate} • Recipient: {draft.clientEmail}
                      </div>
                    </button>
                  </div>

                  <div className="flex items-center space-x-3">
                    {getToneBadge(draft.tone, draft.daysOverdue)}
                    <span className="text-base font-extrabold text-slate-900">
                      ${draft.amount.toFixed(2)} USD
                    </span>
                  </div>
                </div>

                {/* Agent Decision & Reasoning Box */}
                <div className="px-5 py-3 bg-amber-50/40 border-b border-amber-100/60 flex items-start space-x-2.5">
                  <Bot className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <span className="font-bold text-amber-900">Agent Decision: </span>
                    <span className="text-amber-800 italic">&ldquo;{draft.reasoning}&rdquo;</span>
                    <span className="text-amber-700/80 block mt-0.5 text-[11px]">
                      Verified invoice terms and embedded direct PayPal sandbox client payment link.
                    </span>
                  </div>
                </div>

                {/* Draft Body & Controls */}
                <div className="p-5 space-y-4">
                  {isEditing ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Recipient Email
                        </label>
                        <input
                          type="email"
                          value={editRecipient}
                          onChange={(e) => setEditRecipient(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Subject Line
                        </label>
                        <input
                          type="text"
                          value={editSubject}
                          onChange={(e) => setEditSubject(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Email Body Text
                        </label>
                        <textarea
                          rows={6}
                          value={editBody}
                          onChange={(e) => setEditBody(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 leading-relaxed"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center text-xs text-slate-600">
                        <Mail className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                        <span className="font-semibold text-slate-800 mr-2">Subject:</span>
                        <span className="text-slate-900 font-medium">{draft.subject}</span>
                      </div>

                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs sm:text-sm text-slate-800 whitespace-pre-line leading-relaxed font-sans">
                        {draft.body}
                      </div>

                      {draft.paymentLink && (
                        <div className="flex items-center space-x-2 text-xs text-slate-500 pt-1">
                          <span className="font-semibold text-slate-700">Client Payment Link:</span>
                          <a
                            href={draft.paymentLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline font-mono truncate max-w-md inline-flex items-center"
                          >
                            <span>{draft.paymentLink}</span>
                            <ExternalLink className="w-3 h-3 ml-1 shrink-0" />
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Buttons Row */}
                  <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center space-x-2">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(draft.id)}
                            disabled={isProcessing}
                            className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-2xs transition-colors"
                          >
                            Save Changes
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditing}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium transition-colors"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEditing(draft)}
                          className="inline-flex items-center px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5 mr-1 text-slate-500" />
                          <span>Edit draft</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleRejectClick(draft)}
                        disabled={isProcessing}
                        className="inline-flex items-center px-3 py-1.5 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-700 text-xs font-medium transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1" />
                        <span>Reject</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleApproveClick(draft)}
                      disabled={isProcessing}
                      className="inline-flex items-center px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors disabled:opacity-60 cursor-pointer"
                    >
                      <Check className="w-4 h-4 mr-1.5" />
                      <span>{isProcessing ? 'Sending...' : 'Approve & Send'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
