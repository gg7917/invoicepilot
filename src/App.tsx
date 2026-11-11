/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Zap,
  LayoutDashboard,
  MessageSquarePlus,
  History,
  ShieldCheck,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  X,
  CreditCard,
  Send,
  Bot,
} from 'lucide-react';
import { Dashboard } from './components/Dashboard';
import { NewInvoice } from './components/NewInvoice';
import { InvoiceModal } from './components/InvoiceModal';
import { ActivityLogView } from './components/ActivityLogView';
import { PayPalGuideModal } from './components/PayPalGuideModal';
import { ReminderModal } from './components/ReminderModal';
import { ClientReplyModal } from './components/ClientReplyModal';
import { AskMoneyChat } from './components/AskMoneyChat';
import { ApprovalQueueView } from './components/ApprovalQueueView';
import {
  Invoice,
  InvoiceSummary,
  ActivityLogEntry,
  PayPalConfigStatus,
  ApprovalDraft,
  LastAgentRunSummary,
} from '../types/invoice';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'queue' | 'new-invoice' | 'activity' | 'ask-money'>('dashboard');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summary, setSummary] = useState<InvoiceSummary>({
    totalOutstanding: 0,
    totalPaid: 0,
    overdueCount: 0,
    totalCount: 0,
    draftCount: 0,
    sentCount: 0,
    paidCount: 0,
  });
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [configStatus, setConfigStatus] = useState<PayPalConfigStatus>({
    hasPayPalClientId: false,
    hasPayPalSecret: false,
    hasGeminiKey: false,
    isSandboxReady: false,
  });

  // Approval Queue State
  const [approvalDrafts, setApprovalDrafts] = useState<ApprovalDraft[]>([]);
  const [lastAgentRun, setLastAgentRun] = useState<LastAgentRunSummary | null>(null);
  const [isRunningAgent, setIsRunningAgent] = useState(false);
  const hasAutoRunRef = React.useRef(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Stage 2: Reminder & Client Reply Modals
  const [reminderInvoice, setReminderInvoice] = useState<Invoice | null>(null);
  const [replyInvoice, setReplyInvoice] = useState<Invoice | null>(null);

  // Quick Approval Modal State
  const [approvingInvoice, setApprovingInvoice] = useState<Invoice | null>(null);
  const [isApproving, setIsApproving] = useState(false);

  // Toast Notification
  const [toast, setToast] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  // Data fetching
  const loadData = useCallback(async () => {
    try {
      const [invRes, actRes, cfgRes, queueRes] = await Promise.all([
        fetch('/api/invoices'),
        fetch('/api/activity'),
        fetch('/api/config-status'),
        fetch('/api/agent/queue'),
      ]);

      if (invRes.ok) {
        const invData = await invRes.json();
        setInvoices(invData.invoices || []);
        if (invData.summary) {
          setSummary(invData.summary);
        }
      }

      if (actRes.ok) {
        const actData = await actRes.json();
        setActivityLogs(actData || []);
      }

      if (cfgRes.ok) {
        const cfgData = await cfgRes.json();
        setConfigStatus(cfgData);
      }

      if (queueRes.ok) {
        const queueData = await queueRes.json();
        setApprovalDrafts(queueData.pendingDrafts || []);
        if (queueData.lastAgentRun) {
          setLastAgentRun(queueData.lastAgentRun);
        }
      }
    } catch (err) {
      console.error('Failed to load initial data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadApprovalQueue = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/queue');
      if (res.ok) {
        const data = await res.json();
        setApprovalDrafts(data.pendingDrafts || []);
        if (data.lastAgentRun) {
          setLastAgentRun(data.lastAgentRun);
        }
      }
    } catch (err) {
      console.error('Failed to load approval queue:', err);
    }
  }, []);

  // Run collections agent (called manually or automatically once on load)
  const handleRunAgent = useCallback(async (isAuto = false) => {
    setIsRunningAgent(true);
    try {
      const res = await fetch('/api/agent/run', { method: 'POST' });
      if (!res.ok) {
        throw new Error('Failed to run collections agent');
      }
      const data = await res.json();
      setApprovalDrafts(data.pendingDrafts || []);
      if (data.lastAgentRun) {
        setLastAgentRun(data.lastAgentRun);
      }
      await loadData();

      if (!isAuto) {
        showToast('success', data.message || 'Collections agent scan completed.');
      }
    } catch (err: any) {
      console.error('Error running collections agent:', err);
      if (!isAuto) {
        showToast('error', err.message || 'Failed to run collections agent.');
      }
    } finally {
      setIsRunningAgent(false);
    }
  }, [loadData]);

  // 1-Click Approve Draft from queue
  const handleApproveDraft = async (
    draftId: string,
    customDetails?: { subject?: string; body?: string; recipientEmail?: string }
  ) => {
    try {
      const res = await fetch(`/api/agent/queue/${draftId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customDetails || {}),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to approve draft');
      }

      const data = await res.json();
      showToast('success', data.message || 'Reminder approved and dispatched.');
      await Promise.all([loadData(), loadApprovalQueue()]);
    } catch (err: any) {
      console.error('Approve draft error:', err);
      showToast('error', err.message || 'Failed to approve reminder.');
    }
  };

  // 1-Click Reject Draft from queue
  const handleRejectDraft = async (draftId: string, reason?: string) => {
    try {
      const res = await fetch(`/api/agent/queue/${draftId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || 'Dismissed by user' }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to reject draft');
      }

      const data = await res.json();
      showToast('info', data.message || 'Reminder draft dismissed.');
      await Promise.all([loadData(), loadApprovalQueue()]);
    } catch (err: any) {
      console.error('Reject draft error:', err);
      showToast('error', err.message || 'Failed to reject reminder.');
    }
  };

  // Update Draft details (inline editing)
  const handleUpdateDraft = async (draftId: string, updates: Partial<ApprovalDraft>) => {
    try {
      const res = await fetch(`/api/agent/queue/${draftId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update draft');
      }

      showToast('success', 'Draft reminder updated.');
      await loadApprovalQueue();
    } catch (err: any) {
      console.error('Update draft error:', err);
      showToast('error', err.message || 'Failed to update draft.');
    }
  };

  // 1-Click Batch Approve All pending drafts
  const handleApproveAllDrafts = async () => {
    try {
      const res = await fetch('/api/agent/queue/approve-all', { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to batch approve drafts');
      }
      const data = await res.json();
      showToast('success', data.message || 'All pending reminders approved and dispatched.');
      await Promise.all([loadData(), loadApprovalQueue()]);
    } catch (err: any) {
      console.error('Batch approve error:', err);
      showToast('error', err.message || 'Failed to approve all drafts.');
    }
  };

  useEffect(() => {
    loadData();
    // Run collections agent automatically once when the app loads
    if (!hasAutoRunRef.current) {
      hasAutoRunRef.current = true;
      handleRunAgent(true);
    }
  }, [loadData, handleRunAgent]);

  // Refresh PayPal Statuses (Manual click or 30s background auto-sync)
  const refreshInvoiceStatuses = useCallback(async (isBackground = false) => {
    if (!isBackground) {
      setIsRefreshing(true);
    }

    try {
      const res = await fetch('/api/invoices/refresh-status', {
        method: 'POST',
      });

      if (!res.ok) {
        throw new Error('Failed to refresh status from PayPal');
      }

      const data = await res.json();
      if (data.invoices) {
        setInvoices(data.invoices);
      }
      if (data.summary) {
        setSummary(data.summary);
      }

      // When an invoice becomes Paid, show a small "Payment received" notification and update activity log
      if (data.newlyPaidInvoices && data.newlyPaidInvoices.length > 0) {
        for (const paidInv of data.newlyPaidInvoices) {
          showToast(
            'success',
            `Payment received: Invoice ${paidInv.invoiceNumber} ($${paidInv.amount.toFixed(2)} USD) from ${paidInv.clientName} is now Paid!`
          );
        }
        const actRes = await fetch('/api/activity');
        if (actRes.ok) {
          setActivityLogs(await actRes.json());
        }
      } else if (!isBackground) {
        // Re-fetch activity logs on manual refresh
        const actRes = await fetch('/api/activity');
        if (actRes.ok) {
          setActivityLogs(await actRes.json());
        }
      }

      if (!isBackground) {
        if (data.syncErrors && data.syncErrors.length > 0) {
          showToast(
            'error',
            `PayPal Status Sync: ${data.updatedCount} updated. ${data.syncErrors.length} invoice(s) reported issues.`
          );
        } else {
          showToast(
            'success',
            `PayPal Status Check: ${data.updatedCount} invoice(s) updated based on sandbox data.`
          );
        }
      }
    } catch (err: any) {
      if (!isBackground) {
        console.error('Refresh status error:', err);
        showToast('error', err.message || 'Error checking PayPal status');
      } else {
        // Do not show an error pop-up if background auto-check fails; silently retry next interval
        console.warn('Background PayPal status auto-sync failed (will retry in 30s):', err);
      }
    } finally {
      if (!isBackground) {
        setIsRefreshing(false);
      }
    }
  }, []);

  // Automatic status updates: every 30 seconds while the app is open
  useEffect(() => {
    const interval = setInterval(() => {
      refreshInvoiceStatuses(true);
    }, 30000);

    return () => clearInterval(interval);
  }, [refreshInvoiceStatuses]);

  // Manual refresh trigger
  const handleRefreshStatus = () => {
    refreshInvoiceStatuses(false);
  };

  // Mark invoice as paid
  const handleMarkPaid = async (id: string) => {
    try {
      const res = await fetch(`/api/invoices/${id}/mark-paid`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to update invoice');

      const updated = await res.json();
      setInvoices((prev) => prev.map((inv) => (inv.id === id ? updated : inv)));

      // Reload summary & logs
      loadData();
      showToast('success', `Invoice ${updated.invoiceNumber} recorded as Paid.`);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to mark as paid');
    }
  };

  // Direct approve & send action for Draft invoices
  const executeApproveAndSend = async (invoice: Invoice) => {
    setIsApproving(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/approve-and-send`, {
        method: 'POST',
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to dispatch PayPal invoice');
      }

      const data = await res.json();
      setInvoices((prev) => prev.map((inv) => (inv.id === invoice.id ? data.invoice : inv)));
      setApprovingInvoice(null);
      loadData();

      showToast(
        'success',
        `Invoice ${data.invoice.invoiceNumber} approved & dispatched via PayPal Sandbox!`
      );
    } catch (err: any) {
      console.error('Approval failed:', err);
      showToast('error', err.message || 'Error approving invoice');
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Toast Banner */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center p-3.5 bg-slate-900 text-white rounded-xl shadow-xl border border-slate-700 text-xs sm:text-sm animate-in slide-in-from-top-2">
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2.5 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-amber-400 mr-2.5 shrink-0" />
          )}
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-3 text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Navigation Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Brand Logo */}
            <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
                <Zap className="w-5 h-5 fill-current" />
              </div>
              <div>
                <span className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center">
                  InvoicePilot
                  <span className="ml-2 px-1.5 py-0.5 text-[10px] uppercase font-bold tracking-wider bg-blue-50 text-blue-700 border border-blue-200 rounded">
                    Collections AI
                  </span>
                </span>
                <p className="text-[11px] text-slate-400 hidden sm:block">
                  AI Collections Agent for Freelancers
                </p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="flex items-center space-x-1 sm:space-x-2">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`inline-flex items-center px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors ${
                  activeTab === 'dashboard'
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 mr-1.5 text-slate-500" />
                <span>Dashboard</span>
              </button>

              <button
                onClick={() => setActiveTab('queue')}
                className={`inline-flex items-center px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors ${
                  activeTab === 'queue'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Bot className="w-4 h-4 mr-1.5" />
                <span>Approval queue</span>
                {approvalDrafts.filter((d) => d.status === 'pending').length > 0 && (
                  <span
                    className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      activeTab === 'queue' ? 'bg-white text-blue-700' : 'bg-amber-500 text-white'
                    }`}
                  >
                    {approvalDrafts.filter((d) => d.status === 'pending').length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('new-invoice')}
                className={`inline-flex items-center px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors ${
                  activeTab === 'new-invoice'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-blue-600 hover:bg-blue-50'
                }`}
              >
                <MessageSquarePlus className="w-4 h-4 mr-1.5" />
                <span>New from message</span>
              </button>

              <button
                onClick={() => setActiveTab('ask-money')}
                className={`inline-flex items-center px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors ${
                  activeTab === 'ask-money'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Sparkles className="w-4 h-4 mr-1.5 text-amber-500" />
                <span>Ask your money</span>
              </button>

              <button
                onClick={() => setActiveTab('activity')}
                className={`inline-flex items-center px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors ${
                  activeTab === 'activity'
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <History className="w-4 h-4 mr-1.5 text-slate-500" />
                <span>Activity log</span>
              </button>
            </nav>

            {/* Status Pills & Setup Trigger */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsGuideOpen(true)}
                className={`hidden md:inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                  configStatus.isSandboxReady
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/70'
                    : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100/70'
                }`}
                title="Click to view PayPal Sandbox credentials guide"
              >
                <CreditCard className="w-3.5 h-3.5 mr-1" />
                <span>
                  {configStatus.isSandboxReady ? 'PayPal Sandbox Live' : 'PayPal Sandbox Setup'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeTab === 'dashboard' && (
          <Dashboard
            invoices={invoices}
            summary={summary}
            isLoading={isLoading}
            isRefreshing={isRefreshing}
            pendingDraftsCount={approvalDrafts.filter((d) => d.status === 'pending').length}
            isRunningAgent={isRunningAgent}
            onGoToQueue={() => setActiveTab('queue')}
            onRunAgent={() => handleRunAgent(false)}
            onRefreshStatus={handleRefreshStatus}
            onSelectInvoice={(inv) => setSelectedInvoice(inv)}
            onNewInvoice={() => setActiveTab('new-invoice')}
            onApproveAndSend={(inv) => setApprovingInvoice(inv)}
            onMarkPaid={handleMarkPaid}
            onDraftReminder={(inv) => setReminderInvoice(inv)}
            onClientReply={(inv) => setReplyInvoice(inv)}
          />
        )}

        {activeTab === 'queue' && (
          <ApprovalQueueView
            drafts={approvalDrafts}
            invoices={invoices}
            isLoading={isLoading}
            isRunningAgent={isRunningAgent}
            lastAgentRun={lastAgentRun}
            onRunAgent={() => handleRunAgent(false)}
            onApprove={handleApproveDraft}
            onReject={handleRejectDraft}
            onUpdateDraft={handleUpdateDraft}
            onApproveAll={handleApproveAllDrafts}
            onSelectInvoice={(inv) => setSelectedInvoice(inv)}
          />
        )}

        {activeTab === 'new-invoice' && (
          <NewInvoice
            onInvoiceCreated={(newInv) => {
              loadData();
              setActiveTab('dashboard');
              showToast('success', `Invoice ${newInv.invoiceNumber} processed successfully.`);
            }}
            onCancel={() => setActiveTab('dashboard')}
          />
        )}

        {activeTab === 'ask-money' && (
          <AskMoneyChat
            invoices={invoices}
            summary={summary}
            onSelectInvoice={(inv) => setSelectedInvoice(inv)}
          />
        )}

        {activeTab === 'activity' && (
          <ActivityLogView logs={activityLogs} />
        )}
      </main>

      {/* Invoice Details Modal */}
      <InvoiceModal
        invoice={selectedInvoice}
        activityLogs={activityLogs}
        isOpen={Boolean(selectedInvoice)}
        onClose={() => setSelectedInvoice(null)}
        onMarkPaid={handleMarkPaid}
        onApproveAndSend={(inv) => setApprovingInvoice(inv)}
        onDraftReminder={(inv) => setReminderInvoice(inv)}
        onClientReply={(inv) => setReplyInvoice(inv)}
      />

      {/* Stage 2: Overdue Reminder Drafting Modal */}
      <ReminderModal
        invoice={reminderInvoice}
        isOpen={Boolean(reminderInvoice)}
        onClose={() => setReminderInvoice(null)}
        onReminderSent={(updatedInv, msg) => {
          setInvoices((prev) => prev.map((i) => (i.id === updatedInv.id ? updatedInv : i)));
          loadData();
          showToast('success', msg);
        }}
      />

      {/* Stage 2: Client Reply Assistant Modal */}
      <ClientReplyModal
        invoice={replyInvoice}
        isOpen={Boolean(replyInvoice)}
        onClose={() => setReplyInvoice(null)}
        onTermsApplied={(updatedInv, msg) => {
          setInvoices((prev) => prev.map((i) => (i.id === updatedInv.id ? updatedInv : i)));
          loadData();
          showToast('success', msg);
        }}
      />


      {/* Approval Confirmation Dialog (Explicit Human Review) */}
      {approvingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Send className="w-5 h-5" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Confirm Approval &amp; PayPal Dispatch
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                You are about to dispatch this invoice to the client through the PayPal Invoicing API
                (Sandbox).
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Invoice:</span>
                <span className="font-semibold text-slate-800">
                  {approvingInvoice.invoiceNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Recipient:</span>
                <span className="font-semibold text-slate-800">
                  {approvingInvoice.clientName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Due Date:</span>
                <span className="font-semibold text-slate-800">
                  {approvingInvoice.dueDate}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200 text-sm font-bold">
                <span className="text-slate-700">Total Amount:</span>
                <span className="text-blue-600">
                  ${approvingInvoice.amount.toFixed(2)} USD
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 italic">
              Nothing is ever sent without this approval click.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setApprovingInvoice(null)}
                disabled={isApproving}
                className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => executeApproveAndSend(approvingInvoice)}
                disabled={isApproving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center"
              >
                {isApproving ? 'Connecting to PayPal...' : 'Confirm & Dispatch via PayPal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PayPal Sandbox Guide Modal */}
      <PayPalGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        isSandboxReady={configStatus.isSandboxReady}
      />

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-700">InvoicePilot</span>
            <span>•</span>
            <span>Stage 1: AI Parsing &amp; PayPal Sandbox Invoicing</span>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsGuideOpen(true)}
              className="text-slate-500 hover:text-slate-800 font-medium"
            >
              PayPal Setup Guide
            </button>
            <span>•</span>
            <span>Target: Freelancers &amp; Small Businesses</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
