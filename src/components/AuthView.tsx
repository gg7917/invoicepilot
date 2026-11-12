import React, { useState } from 'react';
import { Zap, ShieldCheck, ArrowRight, Lock, Mail, Building, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { BusinessUser } from '../../types/invoice';

interface AuthViewProps {
  onLoginSuccess: (user: BusinessUser, token?: string) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('demo@example.com');
  const [password, setPassword] = useState('Demo1234!');
  const [businessName, setBusinessName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/signup';
      const payload =
        mode === 'login'
          ? { email: email.trim(), password }
          : { email: email.trim(), password, businessName: businessName.trim() };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      onLoginSuccess(data.business, data.token);
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'demo@example.com',
          password: 'Demo1234!',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Demo login failed');
      }

      onLoginSuccess(data.business, data.token);
    } catch (err: any) {
      setError(err.message || 'Demo login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-100">
      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white shadow-xl shadow-blue-500/20 mb-4 ring-4 ring-blue-500/20">
          <Zap className="w-8 h-8 fill-current" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center justify-center">
          NudgePay
          <span className="ml-2.5 px-2 py-0.5 text-xs uppercase font-bold tracking-wider bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded-md">
            Collections AI
          </span>
        </h1>
        <p className="mt-2 text-sm text-slate-300 max-w-sm mx-auto">
          The AI collections agent that chases late payments for you
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        {/* Judge / Evaluator 1-Click Demo Login Banner */}
        <div className="mb-6 bg-gradient-to-r from-blue-900/60 via-indigo-900/50 to-slate-800/80 border border-blue-500/40 rounded-2xl p-4.5 shadow-lg relative overflow-hidden backdrop-blur-md">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-blue-500/20 rounded-xl text-blue-300 mt-0.5">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white tracking-wide">Demo login for judges</h2>
                <span className="text-[11px] font-medium px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full">
                  1-Click Ready
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Explore pre-seeded invoices, overdue collections queue, PayPal sync, and AI reminders.
              </p>
              <div className="mt-2 text-[11px] text-slate-400 font-mono bg-slate-950/50 p-2 rounded-lg border border-slate-700/50">
                <div>Email: <span className="text-blue-300 font-semibold">demo@example.com</span></div>
                <div>Password: <span className="text-blue-300 font-semibold">Demo1234!</span></div>
              </div>
              <button
                type="button"
                onClick={handleDemoLogin}
                disabled={isLoading}
                className="mt-3 w-full inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 transition shadow-md shadow-blue-600/30 focus:outline-hidden focus:ring-2 focus:ring-blue-400 cursor-pointer disabled:opacity-50"
              >
                <span>Log in as Demo Business (Apex Creative)</span>
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Main Auth Card */}
        <div className="bg-slate-900/90 backdrop-blur-md py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-slate-700/60">
          {/* Mode Tabs */}
          <div className="flex rounded-xl bg-slate-800 p-1 mb-6 border border-slate-700/80">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                mode === 'login'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                mode === 'signup'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign up
            </button>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-red-950/80 border border-red-500/40 text-red-200 text-xs flex items-start space-x-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Business name
                </label>
                <div className="relative rounded-xl shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Building className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Studio Vertex or John Doe Consulting"
                    className="block w-full pl-9 pr-3 py-2 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Business email
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="billing@yourbusiness.com"
                  className="block w-full pl-9 pr-3 py-2 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Password
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-9 pr-3 py-2 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              {mode === 'signup' && (
                <p className="text-[11px] text-slate-400 mt-1">
                  Minimum 6 characters. Passwords are securely hashed with scrypt.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors mt-6 cursor-pointer"
            >
              {isLoading ? (
                <span className="flex items-center">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  {mode === 'login' ? 'Signing in...' : 'Creating business account...'}
                </span>
              ) : mode === 'login' ? (
                'Sign in to NudgePay'
              ) : (
                'Create Business Account'
              )}
            </button>
          </form>

          {/* Privacy & Sandbox Notice */}
          <div className="mt-6 pt-5 border-t border-slate-800 text-center">
            <p className="text-[11px] text-slate-400 flex items-center justify-center">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400 mr-1.5" />
              Data isolated per business account. Shared PayPal sandbox credentials.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
