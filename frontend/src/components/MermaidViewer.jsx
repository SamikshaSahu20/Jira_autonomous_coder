import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

export default function MermaidViewer({ content }) {
  const containerRef = useRef(null);
  
  useEffect(() => {
    mermaid.initialize({ 
      startOnLoad: false, 
      theme: 'default', 
      securityLevel: 'loose' 
    });
    
    // Extract mermaid code
    const match = content.match(/```mermaid([\s\S]*?)```/);
    const diagramCode = match ? match[1].trim() : content;
    
    const renderChart = async () => {
      try {
        if (diagramCode) {
            const id = 'mermaid-chart-' + Math.random().toString(36).substr(2, 9);
            const { svg } = await mermaid.render(id, diagramCode);
            if (containerRef.current) {
                containerRef.current.innerHTML = svg;
            }
        }
      } catch (err) {
        console.error("Mermaid Render Error:", err);
        if (containerRef.current) {
            containerRef.current.innerHTML = `<div class="text-red-500 font-bold">Failed to render flowchart. The AI generated invalid Mermaid syntax.</div><pre class="text-xs bg-red-50 p-2 mt-2">${err.message}</pre>`;
        }
      }
    };
    
    renderChart();
  }, [content]);

  return <div ref={containerRef} className="w-full min-h-[300px] overflow-auto flex justify-center bg-white p-4 border border-slate-200 rounded-xl" />;
}
