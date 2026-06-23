import React, { useState, useEffect } from 'react';
import { getTicketFiles, runTicketApp } from '../utils/api';
import { X, FileJson, Clock, Loader2, Folder, Copy, CheckCircle, Play, ExternalLink, Activity } from 'lucide-react';
import MermaidViewer from './MermaidViewer';

export default function FilesModal({ ticketKey, onClose }) {
  const [data, setData] = useState({ files: [], folder: null });
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  
  const [isStarting, setIsStarting] = useState(false);
  const [appUrl, setAppUrl] = useState(null);
  const [runError, setRunError] = useState(null);
  
  const [viewFlowchart, setViewFlowchart] = useState(null);

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const result = await getTicketFiles(ticketKey);
        setData(result || { files: [], folder: null });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchFiles();
  }, [ticketKey]);

  const handleCopyPath = () => {
    if (data.folder) {
      navigator.clipboard.writeText(data.folder);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRunApp = async () => {
    setIsStarting(true);
    setRunError(null);
    try {
      const resp = await runTicketApp(ticketKey);
      setAppUrl(resp.url);
    } catch (err) {
      setRunError(err.response?.data?.detail || "Failed to start application");
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
              <FileJson className="w-5 h-5 text-syngenta" />
              Generated Output
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">{ticketKey}</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-syngenta" />
              <span className="text-sm font-medium">Loading generation manifest...</span>
            </div>
          ) : data.files.length === 0 ? (
            <div className="text-center py-12 text-slate-500 font-medium">
              No files recorded for this ticket.
            </div>
          ) : (
            <div className="space-y-4">
              
              {/* RUN APP CONTROLS */}
              <div className="bg-syngenta/5 rounded-xl p-5 border border-syngenta/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                 <div>
                   <h3 className="font-bold text-slate-800 text-sm">Preview Application</h3>
                   <p className="text-xs text-slate-500 mt-1">Start a local server to preview the generated frontend/backend.</p>
                   {runError && <p className="text-xs text-red-500 font-bold mt-2">{runError}</p>}
                 </div>
                 
                 {appUrl ? (
                   <a 
                     href={appUrl} 
                     target="_blank" 
                     rel="noreferrer"
                     className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-green-500 text-white font-bold text-sm rounded-xl hover:bg-green-600 transition-colors shadow-sm"
                   >
                     <ExternalLink className="w-4 h-4" /> Open Preview
                   </a>
                 ) : (
                   <button 
                     onClick={handleRunApp}
                     disabled={isStarting}
                     className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-syngenta text-white font-bold text-sm rounded-xl hover:bg-syngenta/90 transition-colors shadow-sm disabled:opacity-75 disabled:cursor-not-allowed"
                   >
                     {isStarting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                     {isStarting ? 'Starting...' : 'Run App'}
                   </button>
                 )}
              </div>

              {/* Folder Path Section */}
              {data.folder && (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 mb-6">
                  <div className="flex items-start gap-3">
                    <Folder className="w-5 h-5 text-slate-600 mt-1 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Output Folder</p>
                      <p className="text-sm font-mono text-slate-700 break-all bg-white p-2 rounded border border-slate-200 mb-2">
                        {data.folder}
                      </p>
                      <button 
                        onClick={handleCopyPath}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-syngenta bg-white hover:bg-syngenta/5 rounded-lg border border-slate-200 hover:border-syngenta/30 transition-all"
                      >
                        {copied ? (
                          <>
                            <CheckCircle className="w-3.5 h-3.5" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Copy Path
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Files List */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Files ({data.files.length})</p>
                <div className="space-y-3">
                  {data.files.map((f, i) => (
                    <div key={i} className="group bg-slate-50 hover:bg-syngenta/5 rounded-xl p-4 border border-slate-200 hover:border-syngenta/30 transition-all">
                      <div className="flex items-start gap-4">
                        <div className="mt-1 bg-white p-2 rounded-lg border border-slate-200 shadow-sm group-hover:border-syngenta/30">
                          <FileJson className="w-5 h-5 text-slate-600 group-hover:text-syngenta" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-slate-800 text-sm">{f.filename}</h4>
                          {f.summary && (
                            <p className="text-slate-600 text-sm mt-1 leading-relaxed">
                              {f.summary}
                            </p>
                          )}
                          
                          {/* Meta info footer */}
                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200/60">
                            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                              {f.last_modified && (
                                <>
                                  <Clock className="w-3.5 h-3.5" />
                                  {new Date(f.last_modified).toLocaleString('en-GB', { 
                                    year: 'numeric', month: 'short', day: 'numeric',
                                    hour: '2-digit', minute: '2-digit'
                                  })}
                                </>
                              )}
                            </div>
                            
                            {f.filename.startsWith("flowchart") && f.content && (
                              <button 
                                onClick={() => setViewFlowchart(viewFlowchart === f.content ? null : f.content)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-syngenta bg-syngenta/10 hover:bg-syngenta/20 rounded-lg transition-colors"
                              >
                                <Activity className="w-3.5 h-3.5" />
                                {viewFlowchart === f.content ? 'Hide Flowchart' : 'View Flowchart'}
                              </button>
                            )}
                          </div>
                          
                          {/* Flowchart Viewer */}
                          {viewFlowchart === f.content && (
                             <div className="mt-4 animate-in fade-in slide-in-from-top-2">
                                <MermaidViewer content={f.content} />
                             </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}