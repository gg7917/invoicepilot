import React from 'react';
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
} from 'lucide-react';
import { ActivityLogEntry } from '../../types/invoice';

interface ActivityLogViewProps {
  logs: ActivityLogEntry[];
  onSelectInvoice?: (invoiceNumber: string) => void;
}

export const ActivityLogView: React.FC<ActivityLogViewProps> = ({ logs, onSelectInvoice }) => {
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
      case 'paid':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            <DollarSign className="w-3 h-3 mr-1 text-emerald-600" /> Paid
          </span>
        );
      case 'status_checked':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
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

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden max-w-4xl mx-auto space-y-4">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center">
            <History className="w-5 h-5 text-blue-600 mr-2" />
            Audit &amp; Activity Log
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Complete chronological record of all invoice actions: creation, approval, PayPal dispatch,
            and payments.
          </p>
        </div>
        <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg">
          {logs.length} events
        </span>
      </div>

      <div className="p-5 divide-y divide-slate-100">
        {logs.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-sm">No activity recorded yet.</div>
        ) : (
          logs.map((log) => (
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
                <p className="text-xs sm:text-sm text-slate-700">{log.description}</p>
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
