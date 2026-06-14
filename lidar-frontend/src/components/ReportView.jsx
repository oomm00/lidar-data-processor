import { useState, useMemo } from 'react';

// Color map for risk levels
const LEVEL_COLORS = {
  LOW: '#22c55e',      // green
  MODERATE: '#eab308', // yellow
  HIGH: '#f97316',     // orange
  SEVERE: '#ef4444',   // red
};

const LEVEL_BGS = {
  LOW: 'bg-green-500/10 border-green-500/30 text-green-400',
  MODERATE: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
  HIGH: 'bg-orange-500/10 border-orange-500/30 text-orange-400',
  SEVERE: 'bg-red-500/10 border-red-500/30 text-red-400',
};

export default function ReportView({ insights, recommendations, onViewOnMap }) {
  const [exporting, setExporting] = useState(false);

  // Parse risk score and level from insights array
  const riskInfo = useMemo(() => {
    if (!insights || insights.length === 0) return null;
    
    const riskInsight = insights.find(ins => ins.includes("Overall terrain risk index"));
    if (!riskInsight) return null;

    const match = riskInsight.match(/Overall terrain risk index:\s*([\d.]+)\/100\s*—\s*([A-Z]+)/);
    if (match) {
      return {
        score: parseFloat(match[1]),
        level: match[2],
        fullText: riskInsight,
      };
    }
    return null;
  }, [insights]);

  // Extract site verdict (the last recommendation)
  const siteVerdict = useMemo(() => {
    if (!recommendations || recommendations.length === 0) return "No verdict available.";
    return recommendations[recommendations.length - 1];
  }, [recommendations]);

  // Filter out the verdict and the risk score to avoid redundancy
  const generalInsights = useMemo(() => {
    if (!insights) return [];
    return insights.filter(ins => !ins.includes("Overall terrain risk index"));
  }, [insights]);

  const actionableRecommendations = useMemo(() => {
    if (!recommendations) return [];
    // The last element is the overall closing recommendation verdict, return everything else
    return recommendations.slice(0, -1);
  }, [recommendations]);

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const loadScript = (src) => {
        return new Promise((resolve, reject) => {
          if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
          }
          const script = document.createElement('script');
          script.src = src;
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      };

      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');

      const element = document.getElementById('assessment-report');
      if (!element) return;

      const canvas = await window.html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#0a0f1e',
      });

      const imgData = canvas.toDataURL('image/png');
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      pdf.save('LiDAR_Terrain_Assessment_Report.pdf');
    } catch (err) {
      console.error("PDF export failed:", err);
      alert("Failed to export PDF. Opening print dialog instead.");
      window.print();
    } finally {
      setExporting(false);
    }
  };

  const getActionIcon = (text) => {
    const txt = text.toLowerCase();
    if (txt.includes('firebreak')) {
      // Flame icon
      return (
        <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    }
    if (txt.includes('slope stabilization') || txt.includes('unsurveyable')) {
      // Triangle warning
      return (
        <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    }
    if (txt.includes('drainage channel')) {
      // Water drop
      return (
        <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 9.172V5L8 4z" />
        </svg>
      );
    }
    if (txt.includes('suitable for')) {
      if (txt.includes('agriculture')) {
        // Leaf icon
        return (
          <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
          </svg>
        );
      }
      if (txt.includes('solar')) {
        // Sun icon
        return (
          <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707-.707m0-12.728l.707.707m12.728 12.728l-.707-.707M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      }
      // Building / home icon
      return (
        <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      );
    }
    return (
      <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  };

  const getBorderColorClass = (text) => {
    const txt = text.toLowerCase();
    if (txt.includes('firebreak')) return 'border-l-4 border-l-amber-500';
    if (txt.includes('slope stabilization') || txt.includes('unsurveyable')) return 'border-l-4 border-l-red-500';
    if (txt.includes('drainage channel')) return 'border-l-4 border-l-blue-500';
    if (txt.includes('suitable for')) {
      if (txt.includes('agriculture')) return 'border-l-4 border-l-emerald-500';
      if (txt.includes('solar')) return 'border-l-4 border-l-yellow-500';
      return 'border-l-4 border-l-indigo-500';
    }
    return 'border-l-4 border-l-cyan-500';
  };

  const score = riskInfo ? riskInfo.score : 0;
  const level = riskInfo ? riskInfo.level : 'LOW';
  const color = LEVEL_COLORS[level] || '#94a3b8';

  const circumference = Math.PI * 50; // 157.08
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference;

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar h-full bg-[#0a0f1e] p-6 lg:p-10 flex flex-col gap-8">
      
      {/* Top action bar */}
      <div className="flex justify-between items-center border-b border-slate-800 pb-5 shrink-0">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">LiDAR Site Assessment Report</h2>
          <p className="text-xs text-slate-400 mt-1">Generated automatically from LiDAR point cloud terrain aggregation.</p>
        </div>
        <button
          onClick={handleExportPDF}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-md shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {exporting ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Exporting...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export Report
            </>
          )}
        </button>
      </div>

      {/* Main Report Document container */}
      <div id="assessment-report" className="flex flex-col gap-8 bg-[#0f172a] border border-slate-800 rounded-2xl p-6 lg:p-8 shadow-2xl">
        
        {/* Header Section: Gauge & Verdict */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center bg-slate-900/50 p-6 rounded-xl border border-slate-800/80">
          
          {/* Gauge Column */}
          <div className="md:col-span-4 flex flex-col items-center border-r border-slate-800/60 pr-0 md:pr-6">
            <div className="w-40 h-24 relative flex items-center justify-center">
              <svg className="absolute bottom-0" width="140" height="80" viewBox="0 0 120 70">
                <path
                  d="M 10 60 A 50 50 0 0 1 110 60"
                  fill="none"
                  stroke="#1e293b"
                  strokeWidth="10"
                  strokeLinecap="round"
                />
                <path
                  d="M 10 60 A 50 50 0 0 1 110 60"
                  fill="none"
                  stroke={color}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                />
                <text x="60" y="52" textAnchor="middle" fill="#f8fafc" className="text-[20px] font-extrabold">
                  {score.toFixed(1)}
                </text>
                <text x="60" y="66" textAnchor="middle" fill={color} className="text-[8px] font-extrabold uppercase tracking-wider">
                  {level} RISK
                </text>
              </svg>
            </div>
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-3">Terrain Risk Index</span>
          </div>

          {/* Verdict Column */}
          <div className="md:col-span-8 flex flex-col gap-2">
            <span className="text-[10px] font-extrabold text-indigo-400 uppercase tracking-widest">Site Assessment Verdict</span>
            <h3 className="text-lg font-bold text-white leading-snug">
              {siteVerdict}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Based on the aggregate analysis of slope vectors, vegetation density, flow accumulation paths, and landslide hazards, the overall engineering suitability is computed as <span className="font-semibold text-slate-200">{level.toLowerCase()} risk</span>.
            </p>
          </div>

        </div>

        {/* Findings Section */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
            <svg className="w-5 h-5 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Diagnostic Site Findings</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {generalInsights.map((insight, idx) => (
              <div 
                key={idx}
                className="bg-slate-900/35 border border-slate-800/80 p-3.5 rounded-xl hover:border-slate-700/60 transition-colors flex flex-col gap-2"
              >
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Diagnostic finding #{idx + 1}</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-medium">
                  {insight}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Recommendations Section */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
            <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Action Recommendations</h3>
          </div>

          <div className="flex flex-col gap-3.5">
            {actionableRecommendations.map((reco, idx) => {
              const borderClass = getBorderColorClass(reco);
              const icon = getActionIcon(reco);

              return (
                <div 
                  key={idx}
                  className={`bg-slate-900/40 border border-slate-800/85 p-4 rounded-xl flex items-start justify-between gap-4 hover:border-slate-700/60 transition-colors ${borderClass}`}
                >
                  <div className="flex gap-3">
                    <div className="mt-0.5 shrink-0 bg-slate-800/80 p-1.5 rounded-lg border border-slate-700/30">
                      {icon}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Action Reco #{idx + 1}</span>
                      </div>
                      <p className="text-xs text-slate-200 leading-relaxed font-medium">
                        {reco}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => onViewOnMap(reco)}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                    Locate
                  </button>
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
}
