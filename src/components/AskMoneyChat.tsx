import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  Bot,
  User,
  DollarSign,
  AlertTriangle,
  FileText,
  Clock,
  ArrowRight,
  TrendingUp,
  ShieldAlert,
} from 'lucide-react';
import { Invoice, InvoiceSummary, ChatMessage } from '../../types/invoice';

interface AskMoneyChatProps {
  invoices: Invoice[];
  summary: InvoiceSummary;
  onSelectInvoice: (invoice: Invoice) => void;
}

export const AskMoneyChat: React.FC<AskMoneyChatProps> = ({
  invoices,
  summary,
  onSelectInvoice,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      sender: 'assistant',
      text: `Hello! I am **Ask Your Money**, your real-time financial agent.\n\nI answer your cash flow questions strictly using your **${invoices.length} stored invoices** (Total outstanding: **$${summary.totalOutstanding.toFixed(2)} USD**, Paid: **$${summary.totalPaid.toFixed(2)} USD**).\n\nAsk me anything, like:`,
      timestamp: new Date().toISOString(),
      suggestedQuestions: [
        'Who owes me money?',
        'Which client pays late?',
        'What is my total overdue balance?',
        'Show my largest unpaid invoice',
      ],
    },
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (questionToSend?: string) => {
    const question = (questionToSend || input).trim();
    if (!question || isLoading) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: question,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!questionToSend) setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat/ask-money', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to query financial assistant');
      }

      const data = await res.json();

      const assistantMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'assistant',
        text: data.answer,
        timestamp: new Date().toISOString(),
        citedInvoices: data.citedInvoices,
        suggestedQuestions: data.suggestedQuestions,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('Chat error:', err);
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        text: `Sorry, I encountered an issue analyzing your invoices: ${err.message || 'Network error'}. You can try asking another question.`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  // Simple markdown renderer for bold, lists, and linebreaks
  const renderFormattedText = (text: string) => {
    const lines = text.split('\n');
    return (
      <div className="space-y-1.5 leading-relaxed text-xs sm:text-sm">
        {lines.map((line, idx) => {
          if (!line.trim()) return <div key={idx} className="h-2" />;

          // Bullet item
          const isBullet = line.trim().startsWith('•') || line.trim().startsWith('-');
          const cleanLine = isBullet ? line.replace(/^[\s•-]+/, '').trim() : line;

          // Parse **bold** parts
          const parts = cleanLine.split(/(\*\*.*?\*\*)/g);

          const content = parts.map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return (
                <strong key={pIdx} className="font-semibold text-slate-900">
                  {part.slice(2, -2)}
                </strong>
              );
            }
            return part;
          });

          if (isBullet) {
            return (
              <div key={idx} className="flex items-start pl-2 space-x-2">
                <span className="text-blue-500 font-bold shrink-0">•</span>
                <span>{content}</span>
              </div>
            );
          }

          return <p key={idx}>{content}</p>;
        })}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col h-[76vh] bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
      {/* Top Bar */}
      <div className="p-4 sm:p-5 border-b border-slate-200 bg-white flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center">
              Ask Your Money
              <span className="ml-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
                Grounded in Real Data
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              AI financial assistant strictly querying your active invoices &amp; cash flow
            </p>
          </div>
        </div>

        {/* Quick Stats Pill */}
        <div className="hidden sm:flex items-center space-x-3 text-xs">
          <div className="text-right">
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">
              Outstanding
            </span>
            <span className="font-bold text-slate-900">
              ${summary.totalOutstanding.toFixed(2)}
            </span>
          </div>
          <div className="h-6 w-px bg-slate-200" />
          <div className="text-right">
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Overdue</span>
            <span
              className={`font-bold ${summary.overdueCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}
            >
              {summary.overdueCount} invoice{summary.overdueCount === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/50">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start space-x-3 ${
              msg.sender === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {msg.sender === 'assistant' && (
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div
              className={`max-w-xl rounded-2xl p-4 shadow-2xs ${
                msg.sender === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-xs'
                  : 'bg-white text-slate-800 border border-slate-200 rounded-tl-xs'
              }`}
            >
              {msg.sender === 'user' ? (
                <p className="text-xs sm:text-sm font-medium">{msg.text}</p>
              ) : (
                <div className="space-y-3">
                  {renderFormattedText(msg.text)}

                  {/* Cited Invoices Cards (if any) */}
                  {msg.citedInvoices && msg.citedInvoices.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 space-y-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                        Referenced Invoices:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {msg.citedInvoices.map((inv) => {
                          const fullInv = invoices.find((i) => i.id === inv.id || i.invoiceNumber === inv.invoiceNumber);
                          return (
                            <button
                              key={inv.id}
                              type="button"
                              onClick={() => {
                                if (fullInv) onSelectInvoice(fullInv);
                              }}
                              className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-blue-50/60 hover:border-blue-200 text-left transition-all group flex items-center justify-between"
                            >
                              <div className="truncate mr-2">
                                <div className="text-xs font-semibold text-slate-900 group-hover:text-blue-700 truncate">
                                  {inv.clientName}
                                </div>
                                <div className="text-[11px] text-slate-400 font-mono">
                                  {inv.invoiceNumber} • Due {inv.dueDate}
                                </div>
                              </div>
                              <span className="text-xs font-bold text-slate-900 shrink-0">
                                ${inv.amount.toFixed(2)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Suggested Follow-up Questions */}
                  {msg.suggestedQuestions && msg.suggestedQuestions.length > 0 && (
                    <div className="pt-2 flex flex-wrap gap-1.5">
                      {msg.suggestedQuestions.map((q, qIdx) => (
                        <button
                          key={qIdx}
                          type="button"
                          onClick={() => handleSend(q)}
                          disabled={isLoading}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-xs font-medium border border-slate-200 transition-colors"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {msg.sender === 'user' && (
              <div className="w-8 h-8 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-xs p-4 shadow-2xs flex items-center space-x-2 text-xs text-slate-500">
              <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce"></div>
              <div
                className="w-2 h-2 rounded-full bg-blue-600 animate-bounce"
                style={{ animationDelay: '0.2s' }}
              ></div>
              <div
                className="w-2 h-2 rounded-full bg-blue-600 animate-bounce"
                style={{ animationDelay: '0.4s' }}
              ></div>
              <span className="ml-2 font-medium">Analyzing stored invoice database...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Input Area */}
      <div className="p-4 border-t border-slate-200 bg-white">
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about clients, unpaid invoices, payment history..."
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:bg-white transition-all"
          />

          <button
            type="button"
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim()}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-xs flex items-center transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4 mr-1.5" />
            <span>Ask</span>
          </button>
        </div>
      </div>
    </div>
  );
};
