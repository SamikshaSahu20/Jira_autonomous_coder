import React, { useState } from 'react';
import { login } from '../utils/api';
import { Code2, ArrowRight } from 'lucide-react';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(email, password);
      onLogin(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white font-sans">
      {/* Left Side - Brand/Decorative */}
      <div className="hidden lg:flex w-1/2 bg-slate-900 relative overflow-hidden items-center justify-center">
        {/* Abstract Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-syngenta-dark/20 to-slate-900 z-10" />
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-syngenta rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-green-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
        
        <div className="relative z-20 max-w-lg p-12 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-8 bg-syngenta/20 backdrop-blur-md border border-white/10 ring-1 ring-white/20 shadow-2xl">
            <Code2 className="w-10 h-10 text-syngenta" />
          </div>
          <h2 className="text-4xl font-black text-white mb-6 tracking-tight leading-tight">
            Accelerate your development cycle with AI
          </h2>
          <p className="text-lg text-slate-400 font-medium">
            Syngenta Digital Auto Coder bridges the gap between Jira descriptions and production-ready code instantly.
          </p>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 lg:p-24 relative">
        <div className="w-full max-w-[420px]">
          <div className="mb-10">
            <div className="w-12 h-12 bg-syngenta rounded-xl flex items-center justify-center lg:hidden mb-6 shadow-lg shadow-syngenta/30">
              <Code2 className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">Welcome Back</h1>
            <p className="text-slate-500 font-medium text-sm">Please sign in to access your Auto Coder dashboard.</p>
          </div>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-700 text-sm rounded-r-xl p-4 mb-8 font-medium flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700">Enterprise Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="firstname.lastname@syngenta.com"
                required
                className="w-full border-2 border-slate-200 rounded-xl px-4 py-3.5 text-sm font-medium focus:outline-none focus:border-syngenta focus:ring-4 focus:ring-syngenta/10 transition-all bg-slate-50 focus:bg-white"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="w-full border-2 border-slate-200 rounded-xl px-4 py-3.5 text-sm font-medium focus:outline-none focus:border-syngenta focus:ring-4 focus:ring-syngenta/10 transition-all bg-slate-50 focus:bg-white tracking-widest"
              />
            </div>
            
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-syngenta hover:bg-syngenta-dark text-white font-bold text-sm py-4 rounded-xl transition-all shadow-[0_4px_14px_0_rgba(0,166,81,0.39)] hover:shadow-[0_6px_20px_rgba(0,166,81,0.23)] hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:translate-y-0 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
              >
                {loading ? 'Authenticating...' : 'Sign In'}
                {!loading && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
              </button>
            </div>
          </form>
          
          <div className="mt-12 text-center">
            <p className="text-sm font-medium text-slate-400">
              Internal Syngenta Application • <a href="#" className="hover:text-slate-600 transition-colors">Privacy Policy</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}