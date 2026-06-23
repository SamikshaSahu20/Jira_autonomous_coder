import React, { useState, useEffect } from 'react';
import { 
  Code2, ExternalLink, Search, RefreshCw, FileCode2,
  CheckCircle2, Clock, AlertCircle, LayoutDashboard, Ticket
} from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
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

  useEffect(() => {
    loadData();
  }, []);

  const filteredTickets = tickets.filter(t => 
    t.ticket.toLowerCase().includes(search.toLowerCase()) || 
    t.summary.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusStyle = (status) => {
    const s = (status || '').toLowerCase();
    if (s.includes('progress') || s.includes('development')) return 'bg-blue-50 text-blue-700 ring-blue-600/20';
    if (s.includes('done') || s.includes('closed') || s.includes('resolved')) return 'bg-green-50 text-green-700 ring-green-600/20';
    if (s.includes('review') || s.includes('testing')) return 'bg-yellow-50 text-yellow-800 ring-yellow-600/20';
    if (s.includes('block')) return 'bg-red-50 text-red-700 ring-red-600/10';
    return 'bg-slate-50 text-slate-700 ring-slate-600/20';
  };

  const generatedCount = tickets.filter(t => t.code_generated).length;
  const pendingCount = tickets.length - generatedCount;

  // Chart Data
  const pieData = [
    { name: 'Completed Gen', value: generatedCount, color: '#00A651' },
    { name: 'Awaiting Gen', value: pendingCount, color: '#f97316' }
  ];

  const filesByDate = tickets
    .filter(t => t.code_generated && t.last_generated)
    .reduce((acc, t) => {
      const date = new Date(t.last_generated).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      acc[date] = (acc[date] || 0) + (t.generated_files?.length || 0);
      return acc;
    }, {});
    
  const barData = Object.entries(filesByDate)
    .map(([date, count]) => ({ date, files: count }))
    .slice(-7); // Last 7 days

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm shadow-slate-100/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-syngenta shadow-md shadow-syngenta/20">
              <Code2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-extrabold text-slate-900 leading-tight">Auto Coder Dashboard</h1>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-0.5">Syngenta Digital</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5 text-sm text-slate-700 font-semibold bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
              <div className="w-6 h-6 bg-syngenta rounded-full flex items-center justify-center text-white text-xs font-bold">
                {email.charAt(0).toUpperCase()}
              </div>
              {email}
            </div>
            <button 
              onClick={onLogout}
              className="text-sm font-bold text-slate-500 hover:text-syngenta transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats & Charts Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="md:col-span-1 flex flex-col gap-6">
            <div className="bg-white rounded-3xl border border-slate-200/60 p-6 shadow-sm flex-1 flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                  <Ticket className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-700">Total Pipeline</h3>
              </div>
              <p className="text-5xl font-black text-slate-900 tracking-tight">{tickets.length}</p>
            </div>
            
            <div className="bg-white rounded-3xl border border-slate-200/60 p-6 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Generated</p>
                <div className="flex items-end gap-2">
                  <p className="text-3xl font-black text-syngenta">{generatedCount}</p>
                </div>
              </div>
              <div className="w-px h-10 bg-slate-200"></div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Pending</p>
                <div className="flex items-end gap-2">
                  <p className="text-3xl font-black text-orange-500">{pendingCount}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="md:col-span-3 grid grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl border border-slate-200/60 p-6 shadow-sm flex flex-col">
              <h3 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4 text-slate-400" />
                Generation Ratio
              </h3>
              <div className="flex-1 min-h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} innerRadius={60} outerRadius={80} paddingAngle={4} dataKey="value">
                      {pieData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200/60 p-6 shadow-sm flex flex-col">
              <h3 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4 text-slate-400" />
                File Output Trend
              </h3>
              <div className="flex-1 min-h-[180px]">
                {barData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData}>
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 600 }} dy={10} />
                      <Tooltip 
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontWeight: 600 }} 
                      />
                      <Bar dataKey="files" fill="#00A651" radius={[6, 6, 6, 6]} barSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400 text-sm font-medium">
                    No recent generations
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by ticket key or summary..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white border-2 border-slate-200/80 rounded-2xl text-sm font-medium focus:outline-none focus:border-syngenta focus:ring-0 transition-all shadow-sm"
            />
          </div>
          <button 
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-3 border-2 border-slate-200/80 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-6 py-5">Ticket</th>
                  <th className="px-6 py-5">Summary</th>
                  <th className="px-6 py-5">Jira Status</th>
                  <th className="px-6 py-5 text-center">Generation</th>
                  <th className="px-6 py-5 text-center">Files Modified</th>
                  <th className="px-6 py-5">Last Activity</th>
                  <th className="px-6 py-5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && tickets.length === 0 ? (
                  <tr><td colSpan="7" className="px-6 py-16 text-center text-slate-400 font-medium">Fetching sync data from Jira...</td></tr>
                ) : filteredTickets.length === 0 ? (
                  <tr><td colSpan="7" className="px-6 py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-3">
                       <AlertCircle className="w-10 h-10 text-slate-300" />
                       <p className="font-medium text-base text-slate-500">No tickets found matching your search</p>
                    </div>
                  </td></tr>
                ) : (
                  filteredTickets.map(t => (
                    <tr key={t.ticket} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-5">
                        <a 
                          href={`https://digitial-product-engineering.atlassian.net/browse/${t.ticket}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 font-bold text-slate-800 hover:text-syngenta transition-colors"
                        >
                          {t.ticket}
                          <ExternalLink className="w-3.5 h-3.5 text-syngenta opacity-0 group-hover:opacity-100 transition-opacity" />
                        </a>
                      </td>
                      <td className="px-6 py-5 text-slate-600 font-medium max-w-md truncate" title={t.summary}>
                        {t.summary}
                      </td>
                      <td className="px-6 py-5">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ring-1 ring-inset ${getStatusStyle(t.status)}`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-center">
                        {t.code_generated ? (
                           <span className="inline-flex items-center gap-1 text-syngenta bg-green-50 px-3 py-1 rounded-full text-xs font-extrabold ring-1 ring-inset ring-green-600/20">
                             <CheckCircle2 className="w-3.5 h-3.5" /> GENERATED
                           </span>
                        ) : (
                           <span className="inline-flex items-center text-slate-400 bg-slate-100 px-3 py-1 rounded-full text-xs font-bold ring-1 ring-inset ring-slate-200">
                             PENDING
                           </span>
                        )}
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className={`font-bold ${t.generated_files?.length ? 'text-slate-800' : 'text-slate-400'}`}>
                          {t.generated_files?.length || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-slate-500 font-medium">
                        {t.last_generated ? new Date(t.last_generated).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric'}) : '-'}
                      </td>
                      <td className="px-6 py-5 text-right">
                        {t.code_generated && (
                          <button 
                            onClick={() => setSelectedTicket(t.ticket)}
                            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-bold text-syngenta hover:text-white bg-green-50 hover:bg-syngenta rounded-xl transition-all"
                          >
                            <FileCode2 className="w-4 h-4" />
                            Review
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {selectedTicket && (
        <FilesModal ticketKey={selectedTicket} onClose={() => setSelectedTicket(null)} />
      )}
    </div>
  );
}