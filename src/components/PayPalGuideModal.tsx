import React from 'react';
import { X, ExternalLink, Key, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface PayPalGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  isSandboxReady: boolean;
}

export const PayPalGuideModal: React.FC<PayPalGuideModalProps> = ({
  isOpen,
  onClose,
  isSandboxReady,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              P
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                PayPal Sandbox Configuration
              </h3>
              <p className="text-xs text-slate-500">
                Live sandbox credentials setup for NudgePay
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

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto text-slate-700 text-sm">
          {/* Status Alert */}
          {isSandboxReady ? (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start space-x-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-emerald-900">
                  PayPal Sandbox Credentials Connected!
                </p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Your server is configured with <code>PAYPAL_CLIENT_ID</code> and{' '}
                  <code>PAYPAL_CLIENT_SECRET</code>. Approved invoices will dispatch directly
                  through the official PayPal Sandbox Invoicing API.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start space-x-3">
              <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-900">
                  Currently running in Sandbox Simulation Mode
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  You can create, approve, and test invoices right now. To dispatch real emails and
                  generate live PayPal Sandbox checkout links, follow the 3 quick steps below.
                </p>
              </div>
            </div>
          )}

          {/* Steps */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              How to get your credentials
            </h4>

            <div className="space-y-3">
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    1
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium text-slate-900">
                      Open PayPal Developer Dashboard
                    </p>
                    <p className="text-xs text-slate-500">
                      Sign in to your free PayPal developer account and ensure the switch is set to{' '}
                      <strong>Sandbox</strong>.
                    </p>
                    <a
                      href="https://developer.paypal.com/dashboard/applications/sandbox"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-xs text-blue-600 hover:text-blue-700 font-medium pt-1"
                    >
                      developer.paypal.com/dashboard
                      <ExternalLink className="w-3 h-3 ml-1" />
                    </a>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    2
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium text-slate-900">
                      Create or select a Sandbox REST App
                    </p>
                    <p className="text-xs text-slate-500">
                      Click <strong>Create App</strong>, name it <em>NudgePay</em>, and copy the{' '}
                      <strong>Client ID</strong> and <strong>Secret</strong>.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    3
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium text-slate-900">
                      Add to AI Studio Secrets Panel
                    </p>
                    <p className="text-xs text-slate-500">
                      Open <strong>Settings &gt; Secrets</strong> in the AI Studio sidebar and add
                      these two environment variables:
                    </p>
                    <div className="bg-slate-900 text-slate-100 p-2.5 rounded-lg font-mono text-xs mt-2 space-y-1 select-all">
                      <div>PAYPAL_CLIENT_ID=&quot;your_sandbox_client_id&quot;</div>
                      <div>PAYPAL_CLIENT_SECRET=&quot;your_sandbox_secret&quot;</div>
                      <div className="text-slate-400"># Optional: defaults to sb-oogc653795134@business.example.com</div>
                      <div>MERCHANT_EMAIL=&quot;sb-oogc653795134@business.example.com&quot;</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 flex items-center space-x-2">
            <Key className="w-4 h-4 text-slate-400 shrink-0" />
            <span>
              NudgePay strictly executes PayPal calls on the backend. Your keys are never exposed
              to the browser.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
