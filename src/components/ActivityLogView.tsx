import React, { useState } from 'react';
import {
  History,
  CheckCircle2,
  Send,
  FilePlus,
  RefreshCw,
  Edit3,
  Trash2,
  DollarSign,
  Clock,
  Mail,
  MessageSquare,
  Sparkles,
  Calendar,
  Split,
  Search,
  Filter,
  Bot,
} from 'lucide-react';
import { ActivityLogEntry } from '../../types/invoice';

interface ActivityLogViewProps {
  logs: ActivityLogEntry[];
  onSelectInvoice?: (invoiceNumber: string) => void;
}

export const ActivityLogView: React.FC<ActivityLogViewProps> = ({ logs, onSelectInvoice }) => {
  const [filter, setFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const getActionBadge = (action: ActivityLogEntry['action']) => {
    switch (action) {
      case 'created':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
            <FilePlus className="w-3 h-3 mr-1 text-slate-500" /> Created
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
            <CheckCircle2 className="w-3 h-3 mr-1 text-blue-600" /> Approved
          </span>
        );
      case 'sent':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
            <Send className="w-3 h-3 mr-1 text-indigo-600" /> Sent via PayPal
          </span>
        );
      case 'reminder_drafted':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            <Sparkles className="w-3 h-3 mr-1 text-amber-600" /> Reminder Drafted
          </span>
        );
      case 'agent_scan':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
            <Bot className="w-3 h-3 mr-1 text-blue-600" /> Agent Scan
          </span>
        );
      case 'reminder_rejected':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <Trash2 className="w-3 h-3 mr-1 text-rose-500" /> Reminder Dismissed
          </span>
        );
      case 'reminder_sent':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
            <Mail className="w-3 h-3 mr-1 text-purple-600" /> Reminder Sent
          </span>
        );
      case 'reply_analyzed':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <MessageSquare className="w-3 h-3 mr-1 text-purple-600" /> Reply Analyzed
          </span>
        );
      case 'terms_updated':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-800">
            <Calendar className="w-3 h-3 mr-1 text-teal-600" /> Terms Updated
          </span>
        );
      case 'paid':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            <DollarSign className="w-3 h-3 mr-1 text-emerald-600" /> Paid
          </span>
        );
      case 'status_checked':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <RefreshCw className="w-3 h-3 mr-1 text-amber-600" /> Status Checked
          </span>
        );
      case 'edited':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
            <Edit3 className="w-3 h-3 mr-1 text-slate-500" /> Edited
          </span>
        );
      case 'deleted':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">
            <Trash2 className="w-3 h-3 mr-1 text-rose-500" /> Deleted
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
            {action}
          </span>
        );
    }
  };

  const filteredLogs = logs.filter((log) => {
    // Filter type
    if (filter === 'reminders' && log.action !== 'reminder_drafted' && log.action !== 'reminder_sent') {
      return false;
    }
    if (filter === 'paid' && log.action !== 'paid') {
      return false;
    }
    if (filter === 'sent' && log.action !== 'sent' && log.action !== 'approved') {
      return false;
    }
    if (filter === 'terms' && log.action !== 'terms_updated' && log.action !== 'reply_analyzed') {
      return false;
    }
    if (filter === 'status' && log.action !== 'status_checked') {
      return false;
    }

    // Search query
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchDesc = log.description.toLowerCase().includes(q);
      const matchInv = log.invoiceNumber?.toLowerCase().includes(q);
      const matchAction = log.action.toLowerCase().includes(q);
      return matchDesc || matchInv || matchAction;
    }

    return true;
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden max-w-4xl mx-auto space-y-4">
      <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center">
            <History className="w-5 h-5 text-blue-600 mr-2" />
            Audit &amp; Activity Log
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Complete chronological record of all actions: creation, approval, dispatch, reminders, terms negotiation, and payments.
          </p>
        </div>
        <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-lg self-start sm:self-center">
          {filteredLogs.length} of {logs.length} events
        </span>
      </div>

      {/* Controls: Search & Category Filter */}
      <div className="px-5 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search activity by keyword or invoice number..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:bg-white transition-all"
          />
        </div>

        <div className="flex items-center space-x-1.5 overflow-x-auto text-xs pb-1">
          <span className="text-slate-400 font-medium mr-1 flex items-center">
            <Filter className="w-3 h-3 mr-1" /> View:
          </span>
          {[
            { id: 'all', label: 'All Events' },
            { id: 'reminders', label: 'Reminders' },
            { id: 'terms', label: 'Terms & Replies' },
            { id: 'paid', label: 'Payments' },
            { id: 'sent', label: 'Sent / Dispatched' },
            { id: 'status', label: 'Status Syncs' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilter(cat.id)}
              className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
                filter === cat.id
                  ? 'bg-blue-600 text-white shadow-2xs font-semibold'
                  : 'text-slate-600 bg-slate-100 hover:bg-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Events List */}
      <div className="p-5 divide-y divide-slate-100">
        {filteredLogs.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            No events match your filter criteria.
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div key={log.id} className="py-3.5 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  {getActionBadge(log.action)}
                  {log.invoiceNumber && (
                    <span className="text-xs font-mono font-semibold text-slate-800">
                      {log.invoiceNumber}
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-slate-700 leading-snug">{log.description}</p>
                {log.metadata?.paypalInvoiceId && (
                  <div className="text-[11px] font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded inline-block">
                    PayPal ID: {log.metadata.paypalInvoiceId}
                  </div>
                )}
              </div>

              <div className="text-right text-[11px] text-slate-400 whitespace-nowrap shrink-0 flex items-center">
                <Clock className="w-3 h-3 mr-1 text-slate-300" />
                {new Date(log.timestamp).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

