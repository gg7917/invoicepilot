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
} from 'lucide-react';
import { Dashboard } from './components/Dashboard';
import { NewInvoice } from './components/NewInvoice';
import { InvoiceModal } from './components/InvoiceModal';
import { ActivityLogView } from './components/ActivityLogView';
import { PayPalGuideModal } from './components/PayPalGuideModal';
import {
  Invoice,
  InvoiceSummary,
  ActivityLogEntry,
  PayPalConfigStatus,
} from '../types/invoice';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'new-invoice' | 'activity'>('dashboard');
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

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

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
      const [invRes, actRes, cfgRes] = await Promise.all([
        fetch('/api/invoices'),
        fetch('/api/activity'),
        fetch('/api/config-status'),
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
    } catch (err) {
      console.error('Failed to load initial data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refresh PayPal Statuses
  const handleRefreshStatus = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/invoices/refresh-status', {
        method: 'POST',
      });

      if (!res.ok) {
        throw new Error('Failed to refresh status from PayPal');
      }

      const data = await res.json();
      setInvoices(data.invoices || []);
      setSummary(data.summary);

      // Re-fetch activity logs
      const actRes = await fetch('/api/activity');
      if (actRes.ok) {
        setActivityLogs(await actRes.json());
      }

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
    } catch (err: any) {
      console.error('Refresh status error:', err);
      showToast('error', err.message || 'Error checking PayPal status');
    } finally {
      setIsRefreshing(false);
    }
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
                onClick={() => setActiveTab('activity')}
                className={`inline-flex items-center px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors ${
                  activeTab === 'activity'
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <History className="w-4 h-4 mr-1.5 text-slate-500" />
                <span className="hidden sm:inline">Activity Log</span>
                <span className="sm:hidden">Logs</span>
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
            onRefreshStatus={handleRefreshStatus}
            onSelectInvoice={(inv) => setSelectedInvoice(inv)}
            onNewInvoice={() => setActiveTab('new-invoice')}
            onApproveAndSend={(inv) => setApprovingInvoice(inv)}
            onMarkPaid={handleMarkPaid}
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
