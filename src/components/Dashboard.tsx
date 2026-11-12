import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Plus,
  Search,
  ExternalLink,
  ChevronRight,
  FileText,
  Eye,
  Send,
  SlidersHorizontal,
  Mail,
  MessageSquare,
  Sparkles,
  Bot,
  MoreHorizontal,
  Link2,
  Check,
  Copy,
} from 'lucide-react';
import { Invoice, InvoiceSummary, InvoiceStatus } from '../../types/invoice';

interface DashboardProps {
  invoices: Invoice[];
  summary: InvoiceSummary;
  isLoading: boolean;
  isRefreshing: boolean;
  pendingDraftsCount?: number;
  isRunningAgent?: boolean;
  onRefreshStatus: () => void;
  onSelectInvoice: (invoice: Invoice) => void;
  onNewInvoice: () => void;
  onApproveAndSend: (invoice: Invoice) => void;
  onMarkPaid: (id: string) => void;
  onDraftReminder: (invoice: Invoice) => void;
  onClientReply: (invoice: Invoice) => void;
  onGoToQueue?: () => void;
  onRunAgent?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  invoices,
  summary,
  isLoading,
  isRefreshing,
  pendingDraftsCount = 0,
  isRunningAgent = false,
  onRefreshStatus,
  onSelectInvoice,
  onNewInvoice,
  onApproveAndSend,
  onMarkPaid,
  onDraftReminder,
  onClientReply,
  onGoToQueue,
  onRunAgent,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | InvoiceStatus>('All');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [copiedInvoiceId, setCopiedInvoiceId] = useState<string | null>(null);

  const handleCopyCustomerLink = (inv: Invoice) => {
    const token = inv.payToken || inv.id;
    const url = `${window.location.origin}/pay/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedInvoiceId(inv.id);
    setTimeout(() => {
      setCopiedInvoiceId((curr) => (curr === inv.id ? null : curr));
    }, 2500);
  };

  // Close ⋯ menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.invoice-action-menu')) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Filter invoices based on status and search query
  const filteredInvoices = invoices.filter((inv) => {
    const matchesStatus = statusFilter === 'All' || inv.status === statusFilter;
    const query = searchTerm.toLowerCase();
    const matchesSearch =
      inv.clientName.toLowerCase().includes(query) ||
      inv.description.toLowerCase().includes(query) ||
      inv.invoiceNumber.toLowerCase().includes(query) ||
      inv.clientEmail.toLowerCase().includes(query);
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: InvoiceStatus) => {
    switch (status) {
      case 'Paid':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
            Paid
          </span>
        );
      case 'Overdue':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5"></span>
            Overdue
          </span>
        );
      case 'Sent':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5"></span>
            Sent
          </span>
        );
      case 'Partially paid':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span>
            Partially paid
          </span>
        );
      case 'Payment pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mr-1.5"></span>
            Payment pending
          </span>
        );
      case 'Cancelled':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5"></span>
            Cancelled
          </span>
        );
      case 'Draft':
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5"></span>
            Draft
          </span>
        );
    }
  };

  const formatDueDate = (dateStr: string, status: InvoiceStatus) => {
    const today = new Date().toISOString().split('T')[0];
    const isPast = dateStr < today;
    const isToday = dateStr === today;

    if (status === 'Paid') {
      return <span className="text-slate-500">{dateStr}</span>;
    }

    if (isPast) {
      return (
        <span className="text-rose-600 font-medium inline-flex items-center">
          <AlertTriangle className="w-3.5 h-3.5 mr-1" />
          {dateStr}
        </span>
      );
    }

    if (isToday) {
      return <span className="text-amber-600 font-medium">Today</span>;
    }

    return <span className="text-slate-700">{dateStr}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Top Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Outstanding */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium uppercase tracking-wider">
            <span>Total Outstanding</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              ${summary.totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {summary.sentCount} sent, {summary.overdueCount} overdue
            </p>
          </div>
        </div>

        {/* Total Paid */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium uppercase tracking-wider">
            <span>Total Paid</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              ${summary.totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-emerald-600 font-medium mt-1">
              {summary.paidCount} completed invoices
            </p>
          </div>
        </div>

        {/* Number Overdue */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium uppercase tracking-wider">
            <span>Number Overdue</span>
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                summary.overdueCount > 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-400'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div
              className={`text-2xl font-bold tracking-tight ${
                summary.overdueCount > 0 ? 'text-rose-600' : 'text-slate-900'
              }`}
            >
              {summary.overdueCount}
            </div>
            <p className="text-xs text-slate-500 mt-1">Requires follow-up attention</p>
          </div>
        </div>

        {/* Total Invoices & Drafts */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium uppercase tracking-wider">
            <span>Total Invoices</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {summary.totalCount}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {summary.draftCount} pending approval draft{summary.draftCount === 1 ? '' : 's'}
            </p>
          </div>
        </div>
      </div>

      {/* Pending Approval Queue Alert Banner */}
      {pendingDraftsCount > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 flex items-center">
                <span>Collections Agent has {pendingDraftsCount} reminder draft{pendingDraftsCount === 1 ? '' : 's'} waiting for approval</span>
                <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900">
                  Action Required
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Overdue accounts were analyzed with Gemini. Review, edit, or approve each draft with one click. Nothing is sent without your approval.
              </p>
            </div>
          </div>
          {onGoToQueue && (
            <button
              type="button"
              onClick={onGoToQueue}
              className="inline-flex items-center px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors shrink-0 cursor-pointer"
            >
              <span>Review in Approval Queue</span>
              <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          )}
        </div>
      )}

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Table Controls */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by client, description, or invoice ID..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:bg-white transition-all"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            {onRunAgent && (
              <button
                type="button"
                onClick={onRunAgent}
                disabled={isRunningAgent}
                className="inline-flex items-center px-3.5 py-2 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs sm:text-sm font-semibold transition-colors shadow-2xs disabled:opacity-60 cursor-pointer"
                title="Scan all invoices and generate overdue reminders"
              >
                <Sparkles className={`w-4 h-4 mr-1.5 text-blue-600 ${isRunningAgent ? 'animate-spin' : ''}`} />
                <span>{isRunningAgent ? 'Scanning...' : 'Run agent'}</span>
              </button>
            )}

            <div
              className="hidden md:inline-flex items-center px-2.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-xs font-medium"
              title="Invoice statuses update automatically every 30 seconds"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse mr-1.5 shrink-0" />
              <span>Auto-syncs 30s</span>
            </div>

            <button
              onClick={onRefreshStatus}
              disabled={isRefreshing}
              className="inline-flex items-center px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-medium transition-colors shadow-2xs disabled:opacity-60 cursor-pointer"
              title="Query PayPal Sandbox API for status changes"
            >
              <RotateCw className={`w-4 h-4 mr-1.5 ${isRefreshing ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
              <span>{isRefreshing ? 'Checking PayPal...' : 'Refresh status'}</span>
            </button>

            <button
              onClick={onNewInvoice}
              className="inline-flex items-center px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold transition-colors shadow-2xs"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              <span>New invoice</span>
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="px-4 sm:px-5 py-2.5 bg-slate-50/60 border-b border-slate-100 flex items-center space-x-1.5 overflow-x-auto text-xs">
          <span className="text-slate-400 font-medium mr-1 flex items-center">
            <SlidersHorizontal className="w-3.5 h-3.5 mr-1" /> Filter:
          </span>
          {(['All', 'Draft', 'Sent', 'Overdue', 'Paid', 'Partially paid', 'Payment pending', 'Cancelled'] as const)
            .filter((st) => st === 'All' || st === 'Draft' || st === 'Sent' || st === 'Paid' || st === 'Overdue' || invoices.some((i) => i.status === st))
            .map((status) => {
              const count =
                status === 'All'
                  ? invoices.length
                  : invoices.filter((i) => i.status === status).length;
              const active = statusFilter === status;
              return (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1 rounded-lg font-medium transition-all ${
                    active
                      ? 'bg-white text-blue-700 shadow-2xs border border-slate-200 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  {status} <span className="text-[11px] opacity-70 ml-0.5">({count})</span>
                </button>
              );
            })}
        </div>

        {/* Sync Errors Banner if any invoices failed PayPal API call */}
        {invoices.some((i) => i.lastSyncError) && (
          <div className="mx-6 mt-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1.5">
            <div className="flex items-center space-x-2 font-semibold text-rose-900">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>PayPal Sandbox Status Sync Notice</span>
            </div>
            <p className="text-rose-700">
              The following invoice(s) could not be retrieved from the PayPal Sandbox API. Verify their PayPal invoice IDs:
            </p>
            <ul className="list-disc list-inside space-y-0.5 text-rose-800 pl-1">
              {invoices
                .filter((i) => i.lastSyncError)
                .map((i) => (
                  <li key={i.id}>
                    <span className="font-semibold">{i.invoiceNumber}</span> ({i.paypalInvoiceId || 'No PayPal ID'}): {i.lastSyncError}
                  </li>
                ))}
            </ul>
          </div>
        )}

        {/* Desktop Table View (Hidden on mobile) */}
        <div className="hidden md:block overflow-visible">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-2.5 px-4 w-5/12">Client &amp; Invoice</th>
                <th className="py-2.5 px-3 w-2/12">Amount &amp; Due</th>
                <th className="py-2.5 px-3 w-2/12">Status</th>
                <th className="py-2.5 px-4 w-3/12 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-slate-400">
                    <FileText className="w-7 h-7 mx-auto mb-2 opacity-40" />
                    <p className="font-medium text-slate-600">No invoices match your filter</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Try searching for a different client or clear filters.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv, index) => {
                  return (
                    <tr
                      key={inv.id}
                      className="hover:bg-slate-50/60 transition-colors group cursor-pointer"
                      onClick={() => onSelectInvoice(inv)}
                    >
                      {/* Client name, invoice number, and email merged into one cell with wrapping */}
                      <td className="py-2.5 px-4 max-w-[280px]">
                        <div className="font-semibold text-slate-900 text-xs sm:text-sm leading-tight flex items-center flex-wrap gap-1">
                          <span className="break-words">{inv.clientName}</span>
                          {inv.isDemo && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                              Demo
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5 break-words">
                          <span>{inv.invoiceNumber}</span>
                          {inv.clientEmail && (
                            <>
                              <span className="text-slate-300 mx-1">•</span>
                              <span className="text-slate-500">{inv.clientEmail}</span>
                            </>
                          )}
                        </div>
                        {inv.description && (
                          <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5 break-words">
                            {inv.description}
                          </p>
                        )}
                        {((inv.clientMessages && inv.clientMessages.length > 0) || inv.rawClientMessage) && (
                          <div className="mt-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onClientReply(inv);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-100 text-purple-800 hover:bg-purple-200 border border-purple-200 transition-colors"
                              title="Customer message received via payment portal"
                            >
                              <MessageSquare className="w-2.5 h-2.5 text-purple-600" />
                              <span>Client message • Review reply</span>
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Merged Amount & Due date compact column */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-bold text-slate-900 text-xs sm:text-sm">
                          ${inv.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Due: {formatDueDate(inv.dueDate, inv.status)}
                        </div>
                      </td>

                      {/* Status column with small PayPal status text underneath */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="space-y-0.5">
                          {getStatusBadge(inv.status)}
                          {inv.rawPayPalStatus && (
                            <span className="text-[10px] text-slate-400 block font-mono">
                              PayPal: {inv.rawPayPalStatus}
                            </span>
                          )}
                          {inv.lastSyncError && (
                            <span
                              className="text-[10px] text-rose-600 block font-medium max-w-[130px] truncate"
                              title={inv.lastSyncError}
                            >
                              {inv.lastSyncError}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions: Approve & Send / Copy customer link + ⋯ dropdown menu */}
                      <td
                        className="py-2.5 px-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end space-x-1.5 invoice-action-menu relative">
                          {inv.status === 'Draft' && (
                            <button
                              onClick={() => onApproveAndSend(inv)}
                              className="inline-flex items-center px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors shrink-0"
                              title="Approve & Send via PayPal Sandbox"
                            >
                              <Send className="w-3 h-3 mr-1" />
                              <span>Approve &amp; Send</span>
                            </button>
                          )}

                          {/* Copy Customer Link Button (shown for any sent/processed invoice) */}
                          {inv.status !== 'Draft' && (
                            <button
                              type="button"
                              onClick={() => handleCopyCustomerLink(inv)}
                              className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs transition-colors shrink-0"
                              title="Copy customer payment link"
                            >
                              {copiedInvoiceId === inv.id ? (
                                <>
                                  <Check className="w-3 h-3 mr-1 text-emerald-600" />
                                  <span className="text-emerald-700 font-semibold">Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Link2 className="w-3 h-3 mr-1 text-indigo-600" />
                                  <span>Copy link</span>
                                </>
                              )}
                            </button>
                          )}

                          {/* ⋯ Menu Button */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setOpenMenuId(openMenuId === inv.id ? null : inv.id)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                              title="More actions"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>

                            {/* Dropdown Menu */}
                            {openMenuId === inv.id && (
                              <div
                                className={`absolute right-0 ${
                                  index >= filteredInvoices.length - 2 ? 'bottom-full mb-1' : 'top-full mt-1'
                                } w-44 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-30 animate-in fade-in zoom-in-95 text-left font-normal`}
                              >
                                <button
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    onSelectInvoice(inv);
                                  }}
                                  className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2 transition-colors cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Details</span>
                                </button>

                                {inv.status !== 'Draft' && (
                                  <button
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      handleCopyCustomerLink(inv);
                                    }}
                                    className="w-full px-3 py-1.5 text-xs text-indigo-700 hover:bg-indigo-50 flex items-center space-x-2 transition-colors cursor-pointer"
                                  >
                                    <Link2 className="w-3.5 h-3.5 text-indigo-600" />
                                    <span>Copy customer link</span>
                                  </button>
                                )}

                                {inv.paypalSellerLink && (
                                  <a
                                    href={inv.paypalSellerLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => setOpenMenuId(null)}
                                    className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2 transition-colors"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                                    <span>View in PayPal</span>
                                  </a>
                                )}

                                <button
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    onDraftReminder(inv);
                                  }}
                                  className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2 transition-colors cursor-pointer"
                                >
                                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Draft reminder</span>
                                </button>

                                {inv.status !== 'Paid' && (
                                  <button
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      onMarkPaid(inv.id);
                                    }}
                                    className="w-full px-3 py-1.5 text-xs text-emerald-700 hover:bg-emerald-50 flex items-center space-x-2 transition-colors cursor-pointer"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Mark as paid</span>
                                  </button>
                                )}

                                <button
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    onClientReply(inv);
                                  }}
                                  className="w-full px-3 py-1.5 text-xs text-purple-700 hover:bg-purple-50 flex items-center space-x-2 transition-colors cursor-pointer"
                                >
                                  <MessageSquare className="w-3.5 h-3.5 text-purple-500" />
                                  <span>Paste client reply</span>
                                </button>

                                {inv.status === 'Draft' && (
                                  <button
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      onApproveAndSend(inv);
                                    }}
                                    className="w-full px-3 py-1.5 text-xs text-blue-700 hover:bg-blue-50 flex items-center space-x-2 transition-colors cursor-pointer"
                                  >
                                    <Send className="w-3.5 h-3.5 text-blue-600" />
                                    <span>Approve &amp; Send</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards View (Visible on screens under 768px) */}
        <div className="md:hidden p-3.5 space-y-3 bg-slate-50/50">
          {filteredInvoices.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200 p-6">
              No matching invoices found.
            </div>
          ) : (
            filteredInvoices.map((inv) => {
              return (
                <div
                  key={inv.id}
                  className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2.5 hover:border-slate-300 transition-all cursor-pointer relative"
                  onClick={() => onSelectInvoice(inv)}
                >
                  {/* Card Top: Client & Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-900 text-sm leading-tight flex items-center flex-wrap gap-1">
                        <span className="break-words">{inv.clientName}</span>
                        {inv.isDemo && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                            Demo
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5 break-words">
                        <span>{inv.invoiceNumber}</span>
                        {inv.clientEmail && (
                          <>
                            <span className="text-slate-300 mx-1">•</span>
                            <span>{inv.clientEmail}</span>
                          </>
                        )}
                      </div>
                      {((inv.clientMessages && inv.clientMessages.length > 0) || inv.rawClientMessage) && (
                        <div className="mt-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onClientReply(inv);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-100 text-purple-800 hover:bg-purple-200 border border-purple-200 transition-colors"
                          >
                            <MessageSquare className="w-2.5 h-2.5 text-purple-600" />
                            <span>Client message • Review</span>
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      {getStatusBadge(inv.status)}
                      {inv.rawPayPalStatus && (
                        <span className="text-[10px] text-slate-400 block font-mono mt-0.5">
                          PayPal: {inv.rawPayPalStatus}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  {inv.description && (
                    <p className="text-xs text-slate-600 line-clamp-2 break-words">
                      {inv.description}
                    </p>
                  )}

                  {/* Card Bottom: Amount & Due, and Actions (Pay now + ⋯ menu) */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <div>
                      <div className="font-bold text-slate-900 text-sm">
                        ${inv.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Due: {formatDueDate(inv.dueDate, inv.status)}
                      </div>
                    </div>

                    <div
                      className="flex items-center space-x-1.5 invoice-action-menu relative"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {inv.status === 'Draft' && (
                        <button
                          onClick={() => onApproveAndSend(inv)}
                          className="inline-flex items-center px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors shrink-0"
                        >
                          <Send className="w-3 h-3 mr-1" />
                          <span>Approve &amp; Send</span>
                        </button>
                      )}

                      {/* Copy Customer Link Button */}
                      {inv.status !== 'Draft' && (
                        <button
                          type="button"
                          onClick={() => handleCopyCustomerLink(inv)}
                          className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs transition-colors shrink-0"
                          title="Copy customer payment link"
                        >
                          {copiedInvoiceId === inv.id ? (
                            <>
                              <Check className="w-3 h-3 mr-1 text-emerald-600" />
                              <span className="text-emerald-700 font-semibold">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Link2 className="w-3 h-3 mr-1 text-indigo-600" />
                              <span>Copy link</span>
                            </>
                          )}
                        </button>
                      )}

                      {/* ⋯ Menu */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setOpenMenuId(openMenuId === `mob-${inv.id}` ? null : `mob-${inv.id}`)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                          title="More actions"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>

                        {openMenuId === `mob-${inv.id}` && (
                          <div className="absolute right-0 bottom-full mb-1 w-44 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-30 animate-in fade-in zoom-in-95 text-left font-normal">
                            <button
                              onClick={() => {
                                setOpenMenuId(null);
                                onSelectInvoice(inv);
                              }}
                              className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2 transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5 text-slate-400" />
                              <span>Details</span>
                            </button>

                            {inv.status !== 'Draft' && (
                              <button
                                onClick={() => {
                                  setOpenMenuId(null);
                                  handleCopyCustomerLink(inv);
                                }}
                                className="w-full px-3 py-1.5 text-xs text-indigo-700 hover:bg-indigo-50 flex items-center space-x-2 transition-colors cursor-pointer"
                              >
                                <Link2 className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Copy customer link</span>
                              </button>
                            )}

                            {inv.paypalSellerLink && (
                              <a
                                href={inv.paypalSellerLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => setOpenMenuId(null)}
                                className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2 transition-colors"
                              >
                                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                                <span>View in PayPal</span>
                              </a>
                            )}

                            <button
                              onClick={() => {
                                setOpenMenuId(null);
                                onDraftReminder(inv);
                              }}
                              className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2 transition-colors"
                            >
                              <Mail className="w-3.5 h-3.5 text-slate-400" />
                              <span>Draft reminder</span>
                            </button>

                            {inv.status !== 'Paid' && (
                              <button
                                onClick={() => {
                                  setOpenMenuId(null);
                                  onMarkPaid(inv.id);
                                }}
                                className="w-full px-3 py-1.5 text-xs text-emerald-700 hover:bg-emerald-50 flex items-center space-x-2 transition-colors"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Mark as paid</span>
                              </button>
                            )}

                            <button
                              onClick={() => {
                                setOpenMenuId(null);
                                onClientReply(inv);
                              }}
                              className="w-full px-3 py-1.5 text-xs text-purple-700 hover:bg-purple-50 flex items-center space-x-2 transition-colors"
                            >
                              <MessageSquare className="w-3.5 h-3.5 text-purple-500" />
                              <span>Paste client reply</span>
                            </button>

                            {inv.status === 'Draft' && (
                              <button
                                onClick={() => {
                                  setOpenMenuId(null);
                                  onApproveAndSend(inv);
                                }}
                                className="w-full px-3 py-1.5 text-xs text-blue-700 hover:bg-blue-50 flex items-center space-x-2 transition-colors"
                              >
                                <Send className="w-3.5 h-3.5 text-blue-600" />
                                <span>Approve &amp; Send</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
};
