import React, { useState } from 'react';
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
} from 'lucide-react';
import { Invoice, InvoiceSummary, InvoiceStatus } from '../../types/invoice';

interface DashboardProps {
  invoices: Invoice[];
  summary: InvoiceSummary;
  isLoading: boolean;
  isRefreshing: boolean;
  onRefreshStatus: () => void;
  onSelectInvoice: (invoice: Invoice) => void;
  onNewInvoice: () => void;
  onApproveAndSend: (invoice: Invoice) => void;
  onMarkPaid: (id: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  invoices,
  summary,
  isLoading,
  isRefreshing,
  onRefreshStatus,
  onSelectInvoice,
  onNewInvoice,
  onApproveAndSend,
  onMarkPaid,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | InvoiceStatus>('All');

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
            <button
              onClick={onRefreshStatus}
              disabled={isRefreshing}
              className="inline-flex items-center px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-medium transition-colors shadow-2xs disabled:opacity-60"
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
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-6">Client Name</th>
                <th className="py-3.5 px-4">Description</th>
                <th className="py-3.5 px-4 text-right">Amount (USD)</th>
                <th className="py-3.5 px-4">Due Date</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-medium text-slate-600">No invoices match your filter</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Try searching for a different client or clear filters.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="hover:bg-slate-50/60 transition-colors group cursor-pointer"
                    onClick={() => onSelectInvoice(inv)}
                  >
                    <td className="py-4 px-6">
                      <div className="font-semibold text-slate-900">{inv.clientName}</div>
                      <div className="text-xs text-slate-400 font-mono flex items-center space-x-1.5 mt-0.5">
                        <span>{inv.invoiceNumber}</span>
                        {inv.clientEmail && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[180px]">{inv.clientEmail}</span>
                          </>
                        )}
                      </div>
                    </td>

                    <td className="py-4 px-4 max-w-xs">
                      <div className="text-slate-700 truncate font-medium">{inv.description}</div>
                      <div className="text-xs text-slate-400">
                        {inv.lineItems.length} line item{inv.lineItems.length === 1 ? '' : 's'}
                      </div>
                    </td>

                    <td className="py-4 px-4 text-right font-bold text-slate-900">
                      ${inv.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>

                    <td className="py-4 px-4 whitespace-nowrap">
                      {formatDueDate(inv.dueDate, inv.status)}
                    </td>

                    <td className="py-4 px-4 whitespace-nowrap">
                      <div className="space-y-1">
                        {getStatusBadge(inv.status)}
                        {inv.rawPayPalStatus && (
                          <span className="text-[11px] text-slate-400 block font-mono">
                            PayPal: {inv.rawPayPalStatus}
                          </span>
                        )}
                        {inv.lastSyncError && (
                          <span
                            className="text-[11px] text-rose-600 block font-medium max-w-[160px] truncate"
                            title={inv.lastSyncError}
                          >
                            {inv.lastSyncError}
                          </span>
                        )}
                      </div>
                    </td>

                    <td
                      className="py-4 px-6 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end space-x-2">
                        {inv.status === 'Draft' ? (
                          <button
                            onClick={() => onApproveAndSend(inv)}
                            className="inline-flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors"
                          >
                            <Send className="w-3 h-3 mr-1" />
                            Approve &amp; Send
                          </button>
                        ) : null}

                        {/* Pay now (client view) */}
                        {inv.paypalPaymentLink ? (
                          <a
                            href={inv.paypalPaymentLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold transition-colors shadow-2xs"
                            title="Direct recipient checkout link (Sandbox)"
                          >
                            <span>Pay now (client view)</span>
                            <ExternalLink className="w-3.5 h-3.5 ml-1" />
                          </a>
                        ) : inv.status !== 'Draft' ? (
                          <span
                            className="inline-flex items-center px-2 py-1 text-[11px] text-slate-400 bg-slate-100/80 rounded-md border border-slate-200"
                            title="Payment link is not available. Connect PayPal Sandbox credentials in Settings > Secrets to generate live sandbox links."
                          >
                            Link unavailable
                          </span>
                        ) : null}

                        {/* View in PayPal (Seller link) */}
                        {inv.paypalSellerLink ? (
                          <a
                            href={inv.paypalSellerLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium transition-colors"
                            title="Open seller invoice in PayPal Sandbox"
                          >
                            <span>View in PayPal</span>
                            <ExternalLink className="w-3 h-3 ml-1 text-slate-400" />
                          </a>
                        ) : null}

                        {(inv.status === 'Sent' || inv.status === 'Overdue') && (
                          <button
                            onClick={() => onMarkPaid(inv.id)}
                            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-transparent hover:border-emerald-200"
                            title="Mark as Paid"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}

                        <button
                          onClick={() => onSelectInvoice(inv)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                          title="View Invoice Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards View (Visible on small screens) */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredInvoices.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No matching invoices found.
            </div>
          ) : (
            filteredInvoices.map((inv) => (
              <div
                key={inv.id}
                className="p-4 space-y-3 hover:bg-slate-50/50"
                onClick={() => onSelectInvoice(inv)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-slate-900 text-sm">{inv.clientName}</div>
                    <div className="text-xs text-slate-400 font-mono">{inv.invoiceNumber}</div>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="font-bold text-slate-900 text-sm">
                      ${inv.amount.toFixed(2)}
                    </div>
                    {getStatusBadge(inv.status)}
                    {inv.rawPayPalStatus && (
                      <span className="text-[11px] text-slate-400 block font-mono">
                        PayPal: {inv.rawPayPalStatus}
                      </span>
                    )}
                    {inv.lastSyncError && (
                      <span className="text-[11px] text-rose-600 block font-medium max-w-[160px] truncate" title={inv.lastSyncError}>
                        {inv.lastSyncError}
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-600 line-clamp-1">{inv.description}</p>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                  <div className="text-slate-500">
                    Due: {formatDueDate(inv.dueDate, inv.status)}
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {inv.status === 'Draft' && (
                      <button
                        onClick={() => onApproveAndSend(inv)}
                        className="px-2.5 py-1 bg-blue-600 text-white rounded-md text-xs font-semibold"
                      >
                        Approve &amp; Send
                      </button>
                    )}
                    {inv.paypalPaymentLink ? (
                      <a
                        href={inv.paypalPaymentLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-xs font-semibold inline-flex items-center"
                      >
                        Pay now (client view)
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    ) : inv.status !== 'Draft' ? (
                      <span className="text-[11px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                        Link unavailable
                      </span>
                    ) : null}
                    {inv.paypalSellerLink && (
                      <a
                        href={inv.paypalSellerLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 bg-slate-50 text-slate-600 border border-slate-200 rounded-md text-xs font-medium inline-flex items-center"
                      >
                        View in PayPal
                        <ExternalLink className="w-3 h-3 ml-1 text-slate-400" />
                      </a>
                    )}
                    <button
                      onClick={() => onSelectInvoice(inv)}
                      className="text-slate-400 hover:text-slate-700 p-1"
                      title="View Details"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
