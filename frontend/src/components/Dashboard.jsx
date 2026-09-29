import React, { useState, useEffect } from 'react';
import {
  Code2, ExternalLink, Search, RefreshCw, FileCode2,
  CheckCircle2, AlertCircle, LayoutDashboard,
  ShieldCheck, Zap, TrendingUp, Bug, Activity, Ticket
} from 'lucide-react';
import {
  PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { getTickets } from '../utils/api';
import FilesModal from './FilesModal';

export default function Dashboard({ email, onLogout }) {
  const [tickets, setTickets] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getTickets();
      setTickets(data || []);
    } catch (err) {
      if (err.response?.status === 401) onLogout();
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filteredTickets = tickets.filter(t =>
    t.ticket.toLowerCase().includes(search.toLowerCase()) ||
    t.summary.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusStyle = (status) => {
    const s = (status || '').toLowerCase();
    if (s.includes('progress') || s.includes('development')) return 'bg-blue-50 text-blue-700 ring-blue-600/20';
    if (s.includes('done') || s.includes('closed') || s.includes('resolved')) return 'bg-green-50 text-green-700 ring-green-600/20';
    if (s.includes('review') || s.includes('testing')) return 'bg-amber-50 text-amber-700 ring-amber-600/20';
    if (s.includes('block')) return 'bg-red-50 text-red-700 ring-red-600/10';
    return 'bg-slate-50 text-slate-600 ring-slate-600/20';
  };

  const getTypeBadge = (type) => {
    const t = (type || '').toLowerCase();
    if (t.includes('bug'))   return 'bg-red-50 text-red-600';
    if (t.includes('story')) return 'bg-purple-50 text-purple-600';
    if (t.includes('task'))  return 'bg-blue-50 text-blue-600';
    if (t.includes('epic'))  return 'bg-orange-50 text-orange-600';
    return 'bg-slate-50 text-slate-500';
  };

  const generatedCount  = tickets.filter(t => t.code_generated).length;
  const pendingCount    = tickets.length - generatedCount;
  const totalBugsFixed  = tickets.reduce((a, t) => a + (t.bugs_fixed || 0), 0);
  const totalBugsFound  = tickets.reduce((a, t) => a + (t.bugs_found || 0), 0);
  const totalFiles      = tickets.reduce((a, t) => a + (t.generated_files?.length || 0), 0);

  const pieData = [
    { name: 'Generated', value: generatedCount, color: '#00A651' },
    { name: 'Pending',   value: pendingCount,   color: '#e2e8f0' },
  ];

  const filesByDate = tickets
    .filter(t => t.code_generated && t.last_generated)
    .reduce((acc, t) => {
      const date = new Date(t.last_generated).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      acc[date] = (acc[date] || 0) + (t.generated_files?.length || 0);
      return acc;
    }, {});
  const barData = Object.entries(filesByDate)
    .map(([date, files]) => ({ date, files }))
    .slice(-7);

  const bugData = tickets
    .filter(t => t.code_generated && (t.bugs_found || t.bugs_fixed))
    .map(t => ({ ticket: t.ticket, found: t.bugs_found || 0, fixed: t.bugs_fixed || 0 }))
    .slice(-8);

  const coverage = tickets.length > 0 ? Math.round(generatedCount / tickets.length * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50 font-sans">

      {/* Nav */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-screen-xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-syngenta shadow-sm">
              <Code2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="font-extrabold text-slate-900 text-sm leading-none">Auto Coder</h1>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest mt-0.5">Syngenta Digital</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-600 font-semibold bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
              <div className="w-5 h-5 bg-syngenta rounded-full flex items-center justify-center text-white text-[10px] font-bold">
                {email.charAt(0).toUpperCase()}
              </div>
              {email}
            </div>
            <button onClick={onLogout} className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors px-2 py-1">
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-screen-xl mx-auto px-6 py-7 space-y-6">

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Tickets',   value: tickets.length,   icon: <Ticket        className="w-5 h-5" />, color: 'text-blue-600',    bg: 'bg-blue-50',    ring: 'ring-blue-100'    },
            { label: 'Code Generated',  value: generatedCount,   icon: <CheckCircle2  className="w-5 h-5" />, color: 'text-syngenta',    bg: 'bg-green-50',   ring: 'ring-green-100'   },
            { label: 'Files Created',   value: totalFiles,       icon: <FileCode2     className="w-5 h-5" />, color: 'text-purple-600',  bg: 'bg-purple-50',  ring: 'ring-purple-100'  },
            { label: 'Bugs Fixed',      value: totalBugsFixed,   icon: <Bug           className="w-5 h-5" />, color: 'text-rose-600',    bg: 'bg-rose-50',    ring: 'ring-rose-100'    },
          ].map((c, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow flex items-center gap-4">
              <div className={`w-11 h-11 rounded-xl ${c.bg} ring-1 ${c.ring} flex items-center justify-center ${c.color} flex-shrink-0`}>
                {c.icon}
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{c.label}</p>
                <p className={`text-3xl font-black ${c.color} leading-none`}>{c.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Generation Ratio */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <LayoutDashboard className="w-3.5 h-3.5" /> Generation Ratio
            </p>
            <div className="relative h-[160px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} innerRadius={50} outerRadius={68} paddingAngle={3} dataKey="value" startAngle={90} endAngle={-270}>
                    {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.1)', fontSize: 12, fontWeight: 600 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-black text-syngenta">{coverage}%</span>
                <span className="text-[10px] text-slate-400 font-semibold">Coverage</span>
              </div>
            </div>
            <div className="flex items-center justify-center gap-5 mt-3">
              {pieData.map((d, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                  {d.name} ({d.value})
                </div>
              ))}
            </div>
          </div>

          {/* File Output Trend */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" /> File Output Trend
            </p>
            <div className="h-[192px]">
              {barData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} barSize={20}>
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} dy={8} />
                    <YAxis hide />
                    <Tooltip
                      cursor={{ fill: '#f1f5f9', radius: 6 }}
                      contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.1)', fontSize: 12, fontWeight: 600 }}
                    />
                    <Bar dataKey="files" name="Files" fill="#00A651" radius={[6, 6, 2, 2]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm font-medium">No data yet</div>
              )}
            </div>
          </div>

          {/* Bugs Found vs Fixed */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" /> Bugs Found vs Fixed
              </p>
              {totalBugsFound > 0 && (
                <span className="text-[10px] font-bold bg-green-50 text-syngenta px-2 py-0.5 rounded-full ring-1 ring-green-200">
                  {totalBugsFixed}/{totalBugsFound} fixed
                </span>
              )}
            </div>
            <div className="h-[192px]">
              {bugData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bugData} barSize={9} barGap={2}>
                    <XAxis dataKey="ticket" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }} dy={8} />
                    <YAxis hide />
                    <Tooltip
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.1)', fontSize: 12, fontWeight: 600 }}
                    />
                    <Legend verticalAlign="top" height={28} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 600 }} />
                    <Bar dataKey="found" name="Found" fill="#f87171" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="fixed" name="Fixed" fill="#818cf8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm font-medium">No metrics yet</div>
              )}
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search tickets..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-syngenta focus:ring-2 focus:ring-syngenta/20 shadow-sm transition-all"
            />
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Ticket', 'Summary', 'Status', 'Type', 'Generation', 'Files', 'Updated', ''].map((h, i) => (
                    <th key={i} className="px-5 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && tickets.length === 0 ? (
                  <tr><td colSpan="8" className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <div className="w-8 h-8 border-2 border-syngenta border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm font-medium">Syncing with Jira...</span>
                    </div>
                  </td></tr>
                ) : filteredTickets.length === 0 ? (
                  <tr><td colSpan="8" className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle className="w-8 h-8 text-slate-200" />
                      <span className="text-sm text-slate-400 font-medium">No tickets match your search</span>
                    </div>
                  </td></tr>
                ) : filteredTickets.map(t => (
                  <tr key={t.ticket} className="hover:bg-slate-50/70 transition-colors group">
                    <td className="px-5 py-4 whitespace-nowrap">
                      <a
                        href={`https://digitial-product-engineering.atlassian.net/browse/${t.ticket}`}
                        target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 font-extrabold text-slate-800 hover:text-syngenta transition-colors text-xs"
                      >
                        {t.ticket}
                        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                      </a>
                    </td>
                    <td className="px-5 py-4 max-w-xs">
                      <span className="line-clamp-2 text-xs text-slate-600 font-medium leading-snug" title={t.summary}>{t.summary}</span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold ring-1 ring-inset ${getStatusStyle(t.status)}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold ${getTypeBadge(t.issue_type)}`}>
                        {t.issue_type || 'N/A'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center whitespace-nowrap">
                      {t.code_generated ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-syngenta bg-green-50 px-2.5 py-1 rounded-full ring-1 ring-inset ring-green-200">
                          <Zap className="w-3 h-3" /> Done
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[11px] font-bold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full ring-1 ring-inset ring-slate-200">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`text-xs font-bold tabular-nums ${t.generated_files?.length ? 'text-slate-700' : 'text-slate-300'}`}>
                        {t.generated_files?.length || '--'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-400 font-medium whitespace-nowrap">
                      {t.last_generated
                        ? new Date(t.last_generated).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
                        : '--'}
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      {t.code_generated && (
                        <button
                          onClick={() => setSelectedTicket(t.ticket)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-syngenta bg-green-50 hover:bg-syngenta hover:text-white rounded-lg transition-all border border-green-200 hover:border-syngenta shadow-sm"
                        >
                          <Activity className="w-3 h-3" /> Review
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>{filteredTickets.length} ticket{filteredTickets.length !== 1 ? 's' : ''} shown</span>
            {search && (
              <button onClick={() => setSearch('')} className="text-syngenta font-bold hover:underline">
                Clear search
              </button>
            )}
          </div>
        </div>
      </main>

      {selectedTicket && (
        <FilesModal ticketKey={selectedTicket} onClose={() => setSelectedTicket(null)} />
      )}
    </div>
  );
}