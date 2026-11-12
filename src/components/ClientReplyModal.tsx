import { authFetch } from "../lib/api";
import React, { useState, useEffect } from 'react';
import {
  X,
  MessageSquare,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Split,
  Copy,
  Check,
  Send,
  HelpCircle,
} from 'lucide-react';
import { Invoice, ClientReplyAnalysis } from '../../types/invoice';

interface ClientReplyModalProps {
  invoice: Invoice | null;
  isOpen: boolean;
  onClose: () => void;
  onTermsApplied: (updatedInvoice: Invoice, message: string) => void;
}

export const ClientReplyModal: React.FC<ClientReplyModalProps> = ({
  invoice,
  isOpen,
  onClose,
  onTermsApplied,
}) => {
  const [replyText, setReplyText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<ClientReplyAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Editable fields from AI suggestion
  const [editedResponse, setEditedResponse] = useState('');
  const [applyDueDate, setApplyDueDate] = useState(false);
  const [newDueDate, setNewDueDate] = useState('');
  const [applySplit, setApplySplit] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (invoice && isOpen) {
      const latestMsg =
        invoice.clientMessages && invoice.clientMessages.length > 0
          ? [...invoice.clientMessages].reverse().find((m) => m.sender === 'client')?.message
          : invoice.rawClientMessage;
      if (latestMsg) {
        setReplyText(latestMsg);
      } else {
        setReplyText('');
      }
      setAnalysis(null);
      setError(null);
    }
  }, [invoice, isOpen]);

  if (!isOpen || !invoice) return null;

  const handleAnalyze = async () => {
    if (!replyText.trim()) return;
    setIsAnalyzing(true);
    setError(null);

    try {
      const res = await authFetch(`/api/invoices/${invoice.id}/analyze-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ replyText }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to analyze client reply');
      }

      const data: ClientReplyAnalysis = await res.json();
      setAnalysis(data);
      setEditedResponse(data.suggestedResponse);

      if (data.suggestedDueDate) {
        setNewDueDate(data.suggestedDueDate);
        setApplyDueDate(true);
      } else {
        setApplyDueDate(false);
      }

      if (data.suggestedSplit) {
        setApplySplit(true);
      } else {
        setApplySplit(false);
      }
    } catch (err: any) {
      console.error('Analysis error:', err);
      setError(err.message || 'Error analyzing client reply');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApproveAndApply = async () => {
    setIsApplying(true);
    setError(null);

    try {
      const payload: any = {};
      if (applyDueDate && newDueDate) {
        payload.newDueDate = newDueDate;
      }
      if (applySplit && analysis?.suggestedSplit) {
        payload.installments = analysis.suggestedSplit.installments.map((inst) => ({
          ...inst,
          status: 'pending',
        }));
      }
      payload.notesAppendix = `Client replied: "${replyText.substring(0, 100)}..."`;

      const res = await authFetch(`/api/invoices/${invoice.id}/apply-reply-terms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to apply new terms');
      }

      const result = await res.json();
      onTermsApplied(result.invoice, result.message || 'Updated invoice terms successfully!');
      onClose();
    } catch (err: any) {
      console.error('Apply error:', err);
      setError(err.message || 'Failed to apply terms');
    } finally {
      setIsApplying(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(editedResponse);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const setExample = (text: string) => {
    setReplyText(text);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold shadow-xs">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  Client Reply Assistant
                </h3>
                <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-purple-100 text-purple-800 rounded font-mono">
                  {invoice.invoiceNumber}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Paste client message to analyze intent, negotiate terms, or draft responses
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
        <div className="p-6 space-y-5 overflow-y-auto text-sm text-slate-700">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center">
              <AlertTriangle className="w-4 h-4 text-rose-600 mr-2 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Paste Input Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Paste Client Reply
              </label>
              <div className="flex items-center space-x-1.5 text-xs text-slate-400">
                <span>Quick tests:</span>
                <button
                  type="button"
                  onClick={() =>
                    setExample(
                      "Hi! We are waiting on our client payment this week. Can I pay next week on Friday (Nov 20)?"
                    )
                  }
                  className="px-2 py-0.5 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                >
                  &ldquo;Pay next week&rdquo;
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setExample(
                      `Hey, budget is tight this month. Could we split this $${invoice.amount.toFixed(2)} invoice into two payments?`
                    )
                  }
                  className="px-2 py-0.5 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                >
                  &ldquo;Split in 2&rdquo;
                </button>
              </div>
            </div>

            <textarea
              rows={4}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="e.g., 'Hi, can I pay next week on Friday?' or 'Can we split this into two equal payments?'"
              className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600 focus:bg-white transition-all font-sans"
            />

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={isAnalyzing || !replyText.trim()}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-xs flex items-center transition-colors disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4 mr-1.5" />
                <span>{isAnalyzing ? 'Analyzing with Gemini...' : 'Analyze client reply'}</span>
              </button>
            </div>
          </div>

          {/* Analysis & Suggested Terms Panel */}
          {analysis && (
            <div className="space-y-4 pt-4 border-t border-slate-200 animate-in fade-in duration-200">
              <div className="p-3.5 rounded-xl bg-purple-50/70 border border-purple-200/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-900 flex items-center">
                    <Sparkles className="w-3.5 h-3.5 mr-1.5 text-purple-600" />
                    Gemini AI Assessment
                  </span>
                  <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full bg-purple-200/70 text-purple-900">
                    Sentiment: {analysis.sentiment}
                  </span>
                </div>
                <p className="text-xs text-purple-800">
                  <strong>Client Intent:</strong> {analysis.intent}
                </p>
              </div>

              {/* Suggested Terms Adjustments */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Negotiated Terms Options (Approval Required)
                </h4>

                {/* Option 1: Due Date Extension */}
                {analysis.suggestedDueDate && (
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                    <label className="flex items-center space-x-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={applyDueDate}
                        onChange={(e) => setApplyDueDate(e.target.checked)}
                        className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300"
                      />
                      <span className="text-xs font-bold text-slate-800 flex items-center">
                        <Calendar className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                        Update Invoice Due Date to:
                      </span>
                    </label>
                    {applyDueDate && (
                      <div className="pl-6 flex items-center space-x-2">
                        <input
                          type="date"
                          value={newDueDate}
                          onChange={(e) => setNewDueDate(e.target.value)}
                          className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-medium"
                        />
                        <span className="text-xs text-slate-500">
                          (Current due date: {invoice.dueDate})
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Option 2: Payment Split */}
                {analysis.suggestedSplit && (
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                    <label className="flex items-center space-x-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={applySplit}
                        onChange={(e) => setApplySplit(e.target.checked)}
                        className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300"
                      />
                      <span className="text-xs font-bold text-slate-800 flex items-center">
                        <Split className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                        Split into 2 Payment Installments:
                      </span>
                    </label>
                    {applySplit && (
                      <div className="pl-6 space-y-1.5 pt-1">
                        {analysis.suggestedSplit.installments.map((inst, idx) => (
                          <div
                            key={idx}
                            className="p-2 bg-white rounded-lg border border-slate-200 text-xs flex items-center justify-between"
                          >
                            <span className="font-medium text-slate-700">{inst.label}</span>
                            <div className="space-x-3 text-right">
                              <span className="font-bold text-slate-900">
                                ${inst.amount.toFixed(2)} USD
                              </span>
                              <span className="text-slate-500 text-[11px]">Due {inst.dueDate}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Suggested Reply Draft */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Suggested Response to Client
                  </label>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex items-center text-xs text-purple-600 hover:text-purple-700 font-medium"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3 mr-1 text-emerald-600" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 mr-1" /> Copy response
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  rows={5}
                  value={editedResponse}
                  onChange={(e) => setEditedResponse(e.target.value)}
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600 focus:bg-white transition-all font-sans leading-relaxed"
                />
              </div>

              <div className="p-3 rounded-lg bg-amber-50/80 border border-amber-200 text-[11px] text-amber-800">
                <strong>Safety Guarantee:</strong> No dates or invoice terms are altered in your
                database until you click &ldquo;Approve and Apply Terms&rdquo; below.
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-semibold hover:bg-slate-100 transition-colors"
          >
            Close
          </button>

          {analysis && (applyDueDate || applySplit) ? (
            <button
              type="button"
              onClick={handleApproveAndApply}
              disabled={isApplying}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-xs flex items-center transition-colors disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              <span>{isApplying ? 'Applying terms...' : 'Approve and Apply Terms'}</span>
            </button>
          ) : analysis ? (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-xs"
            >
              Done
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
