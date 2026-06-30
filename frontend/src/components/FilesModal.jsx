import React, { useState, useEffect } from 'react';
import { getTicketFiles, runTicketApp, stopTicketApp, sendTicketChat } from '../utils/api';
import {
  X, FileText, Clock, Loader2, Copy, CheckCircle,
  ExternalLink, Activity, ShieldCheck, Send, MessageSquare,
  Code2, Monitor, GitBranch, ChevronRight, RefreshCw, Zap
} from 'lucide-react';
import MermaidViewer from './MermaidViewer';

const FILE_ICONS = {
  js: 'JS', jsx: 'JSX', ts: 'TS', tsx: 'TSX', py: 'PY',
  html: 'HTML', css: 'CSS', json: 'JSON', md: 'MD', sh: 'SH', bat: 'BAT', txt: 'TXT',
};
const getFileIcon = name => FILE_ICONS[name.split('.').pop()?.toLowerCase()] || 'FILE';

const TAB_CONFIG = [
  { id: 'overview',  label: 'Overview',  icon: <Activity      className="w-3.5 h-3.5" /> },
  { id: 'files',     label: 'Files',     icon: <FileText      className="w-3.5 h-3.5" /> },
  { id: 'flowchart', label: 'Flowchart', icon: <GitBranch     className="w-3.5 h-3.5" /> },
  { id: 'preview',   label: 'Preview',   icon: <Monitor       className="w-3.5 h-3.5" /> },
  { id: 'chat',      label: 'Ask Agent', icon: <MessageSquare className="w-3.5 h-3.5" /> },
];

export default function FilesModal({ ticketKey, onClose }) {
  const [data, setData]         = useState({ files: [], folder: null, review: null, timings: null });
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState('overview');
  const [copied, setCopied]     = useState(false);
  const [isStarting, setIsStarting]   = useState(false);
  const [appUrl, setAppUrl]           = useState(null);
  const [runError, setRunError]       = useState(null);
  const [chatMessage, setChatMessage] = useState('');
  const [chatting, setChatting]       = useState(false);
  const [chatResult, setChatResult]   = useState(null);
  const [activeFlowchart, setActiveFlowchart] = useState(0);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const result = await getTicketFiles(ticketKey);
      setData(result || { files: [], folder: null, review: null, timings: null });
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchFiles(); }, [ticketKey]);

  const handleCopyPath = () => {
    if (data.folder) {
      navigator.clipboard.writeText(data.folder);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRunApp = async () => {
    setIsStarting(true); setRunError(null);
    try {
      const resp = await runTicketApp(ticketKey);
      setAppUrl(resp.url);
      setTab('preview');
    } catch (err) {
      setRunError(err.response?.data?.detail || 'Failed to start application');
    } finally { setIsStarting(false); }
  };

  const handleChat = async () => {
    if (!chatMessage.trim()) return;
    setChatting(true); setChatResult(null);
    try {
      const resp = await sendTicketChat(ticketKey, chatMessage);
      setChatResult({ type: 'success', text: `Patched ${resp.updated.length} file(s): ${resp.updated.join(', ')}` });
      setChatMessage('');
      fetchFiles();
    } catch { setChatResult({ type: 'error', text: 'Agent error. Please try again.' }); }
    finally { setChatting(false); }
  };

  const timings = data.timings;
  const agentSteps = timings ? [
    { label: 'Analyst',  time: timings.analyst,  color: 'bg-slate-100 text-slate-600' },
    { label: 'Coder',    time: timings.coder,     color: 'bg-blue-50 text-blue-600 border border-blue-100' },
    { label: 'Tester',   time: timings.tester,    color: 'bg-green-50 text-green-600 border border-green-100' },
    { label: 'Reviewer', time: timings.reviewer,  color: 'bg-indigo-50 text-indigo-600 border border-indigo-100' },
  ] : [];

  const codeFiles  = data.files.filter(f =>
    !f.filename.startsWith('flowchart') &&
    !['AI_Review.md','README.md','metrics.json','timings.json','run.bat','run.sh'].includes(f.filename)
  );
  const flowcharts = data.files.filter(f =>
    f.filename.startsWith('flowchart') && f.filename.endsWith('.md') && f.content
  );

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col border border-slate-200">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-syngenta/10 rounded-xl flex items-center justify-center">
              <Code2 className="w-4 h-4 text-syngenta" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-sm">{ticketKey} &mdash; Generated Output</h2>
              {data.folder && (
                <p className="text-xs text-slate-400 font-mono truncate max-w-sm">{data.folder}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {data.folder && (
              <button onClick={handleCopyPath} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors" title="Copy path">
                {copied ? <CheckCircle className="w-4 h-4 text-syngenta" /> : <Copy className="w-4 h-4" />}
              </button>
            )}
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-slate-100 flex-shrink-0">
          {TAB_CONFIG.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-all mb-[-1px] ${
                tab === t.id
                  ? 'text-syngenta border-syngenta bg-green-50/50'
                  : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {t.icon}{t.label}
              {t.id === 'files' && codeFiles.length > 0 && (
                <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{codeFiles.length}</span>
              )}
              {t.id === 'flowchart' && flowcharts.length > 0 && (
                <span className="bg-green-100 text-syngenta text-[10px] font-bold px-1.5 py-0.5 rounded-full">{flowcharts.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-slate-400">
              <div className="w-7 h-7 border-2 border-syngenta border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium">Loading...</span>
            </div>
          ) : data.files.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
              <FileText className="w-10 h-10 text-slate-200" />
              <span className="text-sm font-medium">No generated files found for this ticket.</span>
            </div>
          ) : tab === 'overview' ? (
            /* OVERVIEW TAB */
            <div className="space-y-5">
              {agentSteps.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Pipeline Execution Timeline</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {agentSteps.map((s, i) => (
                      <React.Fragment key={s.label}>
                        <span className={`text-xs font-bold px-3 py-1.5 rounded-lg ${s.color}`}>
                          {s.label}{s.time != null ? ` · ${s.time.toFixed(1)}s` : ''}
                        </span>
                        {i < agentSteps.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}
              {data.review && (
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50/50 rounded-xl p-5 border border-indigo-100">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldCheck className="w-4 h-4 text-indigo-500" />
                    <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider">AI Code Review</p>
                  </div>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{data.review}</p>
                </div>
              )}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Total Files', value: data.files.length },
                  { label: 'Code Files',  value: codeFiles.length },
                  { label: 'Flowcharts',  value: flowcharts.length },
                ].map((s, i) => (
                  <div key={i} className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-center">
                    <p className="text-xl font-black text-slate-800">{s.value}</p>
                    <p className="text-[11px] text-slate-400 font-semibold mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
              {flowcharts.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2 text-xs text-green-700 font-medium">
                  <GitBranch className="w-4 h-4 flex-shrink-0" />
                  {flowcharts.length} flowchart{flowcharts.length > 1 ? 's' : ''} available &mdash; view them in the <button onClick={() => setTab('flowchart')} className="underline font-bold">Flowchart tab</button>
                </div>
              )}
            </div>

          ) : tab === 'files' ? (
            /* FILES TAB */
            <div className="space-y-2">
              {data.files.map((f, i) => (
                <div key={i} className="flex items-center gap-3 p-3.5 bg-slate-50 hover:bg-white rounded-xl border border-transparent hover:border-slate-200 transition-all">
                  <span className="text-[10px] font-black bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded flex-shrink-0">
                    {getFileIcon(f.filename)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 text-sm truncate">{f.filename}</p>
                    {f.summary && <p className="text-xs text-slate-500 truncate mt-0.5">{f.summary}</p>}
                  </div>
                  {f.last_modified && (
                    <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium flex-shrink-0">
                      <Clock className="w-3 h-3" />
                      {new Date(f.last_modified).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </div>
                  )}
                  {f.filename.startsWith('flowchart') && f.content && (
                    <button
                      onClick={() => { setActiveFlowchart(flowcharts.indexOf(f)); setTab('flowchart'); }}
                      className="text-[11px] font-bold text-syngenta bg-green-50 px-2 py-1 rounded-lg hover:bg-syngenta hover:text-white transition-all flex-shrink-0"
                    >
                      View
                    </button>
                  )}
                </div>
              ))}
            </div>

          ) : tab === 'flowchart' ? (
            /* FLOWCHART TAB */
            <div className="space-y-4">
              {flowcharts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-3">
                  <GitBranch className="w-10 h-10 text-slate-200" />
                  <p className="text-sm font-medium">No flowcharts generated for this ticket.</p>
                </div>
              ) : (
                <>
                  {flowcharts.length > 1 && (
                    <div className="flex gap-2">
                      {flowcharts.map((f, i) => (
                        <button
                          key={i}
                          onClick={() => setActiveFlowchart(i)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                            activeFlowchart === i
                              ? 'bg-syngenta text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          <GitBranch className="w-3 h-3" />
                          {f.filename.replace('flowchart_', '').replace('.md', '')}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border-b border-slate-200">
                      <GitBranch className="w-3.5 h-3.5 text-syngenta" />
                      <span className="text-xs font-bold text-slate-600">
                        {flowcharts[activeFlowchart]?.filename}
                      </span>
                    </div>
                    <div className="p-4">
                      <MermaidViewer content={flowcharts[activeFlowchart]?.content} />
                    </div>
                  </div>
                </>
              )}
            </div>

          ) : tab === 'preview' ? (
            /* PREVIEW TAB */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-700">Live Preview</p>
                  <p className="text-xs text-slate-400 mt-0.5">Starts a local server and renders the output inside this panel.</p>
                </div>
                {appUrl ? (
                  <div className="flex items-center gap-2">
                    <a href={appUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-600 rounded-lg transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" /> Open Tab
                    </a>
                    <button onClick={async () => { await stopTicketApp(ticketKey); setAppUrl(null); setRunError(null); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-600 rounded-lg transition-colors">
                      <RefreshCw className="w-3.5 h-3.5" /> Restart
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleRunApp}
                    disabled={isStarting}
                    className="flex items-center gap-2 px-4 py-2 bg-syngenta text-white text-xs font-bold rounded-xl hover:bg-syngenta/90 disabled:opacity-60 transition-all shadow-sm"
                  >
                    {isStarting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                    {isStarting ? 'Starting...' : 'Run App'}
                  </button>
                )}
              </div>
              {runError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-red-700 mb-2">Startup Error</p>
                  <pre className="text-xs text-red-600 whitespace-pre-wrap font-mono leading-relaxed overflow-auto max-h-48">{runError}</pre>
                </div>
              )}
              {appUrl && (
                <div className="rounded-xl overflow-hidden border border-slate-200 shadow-inner" style={{ height: '480px' }}>
                  <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border-b border-slate-200">
                    <div className="flex gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                      <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
                    </div>
                    <p className="text-xs text-slate-400 font-mono flex-1 text-center">{appUrl}</p>
                  </div>
                  <iframe src={appUrl} className="w-full border-0" style={{ height: 'calc(100% - 37px)' }} title="App Preview" />
                </div>
              )}
              {!appUrl && !runError && (
                <div className="h-48 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center">
                  <div className="text-center">
                    <Monitor className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-400 font-medium">Click Run App to launch preview</p>
                  </div>
                </div>
              )}
            </div>

          ) : tab === 'chat' ? (
            /* CHAT TAB */
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50/50 rounded-xl p-4 border border-blue-100">
                <p className="text-sm font-bold text-slate-800 mb-1">Ask the Agent</p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Type a follow-up instruction to re-run the Coder agent on the existing output files.
                  The agent will patch only the files that need changing.
                </p>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatMessage}
                  onChange={e => setChatMessage(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !chatting && handleChat()}
                  placeholder="e.g. Add input validation to the login form..."
                  disabled={chatting}
                  className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-syngenta focus:ring-2 focus:ring-syngenta/20 bg-white transition-all"
                />
                <button
                  onClick={handleChat}
                  disabled={chatting || !chatMessage.trim()}
                  className="px-4 py-2.5 bg-syngenta text-white rounded-xl font-bold disabled:opacity-50 hover:bg-syngenta/90 transition-all flex items-center"
                >
                  {chatting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
              {chatResult && (
                <div className={`p-3.5 rounded-xl text-sm font-medium ${chatResult.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                  {chatResult.text}
                </div>
              )}
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Example prompts</p>
                {[
                  'Add input validation to all form fields',
                  'Add CORS headers to the Express server',
                  'Add error handling to the API routes',
                  'Improve the UI styling with better CSS',
                ].map((p, i) => (
                  <button key={i} onClick={() => setChatMessage(p)} className="w-full text-left text-xs text-slate-500 bg-slate-50 hover:bg-slate-100 px-4 py-2.5 rounded-lg border border-slate-200 hover:border-slate-300 transition-all font-medium">
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}