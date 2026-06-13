import { useMemo } from 'react';

// Color map for risk levels
const LEVEL_COLORS = {
  LOW: '#22c55e',      // green
  MODERATE: '#eab308', // yellow
  HIGH: '#f97316',     // orange
  SEVERE: '#ef4444',   // red
};

const LEVEL_BGS = {
  LOW: 'bg-green-500/10 border-green-500/30',
  MODERATE: 'bg-yellow-500/10 border-yellow-500/30',
  HIGH: 'bg-orange-500/10 border-orange-500/30',
  SEVERE: 'bg-red-500/10 border-red-500/30',
};

export default function InsightsPanel({ insights, recommendations }) {
  // Parse risk score and level from insights array
  const riskInfo = useMemo(() => {
    if (!insights || insights.length === 0) return null;
    
    const riskInsight = insights.find(ins => ins.includes("Overall terrain risk index"));
    if (!riskInsight) return null;

    // Pattern matching e.g., "Overall terrain risk index: 30.0/100 — MODERATE — risk awareness..."
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

  // Filter out the risk index string from general list to avoid redundancy
  const generalInsights = useMemo(() => {
    if (!insights) return [];
    return insights.filter(ins => !ins.includes("Overall terrain risk index"));
  }, [insights]);

  if (!insights || insights.length === 0) {
    return null;
  }

  // Helper to choose SVG Icon based on insight content
  const getInsightIcon = (text) => {
    const txt = text.toLowerCase();
    
    // Warning icon for risk/hazards
    if (txt.includes('risk') || txt.includes('hazard') || txt.includes('landslide') || txt.includes('fire') || txt.includes('exceeds')) {
      return (
        <svg className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    }
    
    // Lightbulb icon for suitability/recommendations
    if (txt.includes('suitable') || txt.includes('recommend') || txt.includes('ideal') || txt.includes('monitoring') || txt.includes('mitigation')) {
      return (
        <svg className="w-5 h-5 text-cyan-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      );
    }

    // Default info icon
    return (
      <svg className="w-5 h-5 text-indigo-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  };

  // Render SVG Arc Gauge
  const renderGauge = () => {
    if (!riskInfo) return null;
    const { score, level } = riskInfo;
    const color = LEVEL_COLORS[level] || '#94a3b8';
    
    const radius = 50;
    const strokeWidth = 10;
    const circumference = Math.PI * radius; // 157.08
    const strokeDashoffset = circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference;

    return (
      <div className={`p-4 rounded-xl border flex flex-col items-center justify-center ${LEVEL_BGS[level] || 'bg-slate-800/30 border-slate-700'} mb-6 shadow-inner`}>
        <div className="w-48 h-28 relative flex items-center justify-center">
          <svg className="absolute bottom-0" width="160" height="90" viewBox="0 0 120 70">
            {/* Background Track */}
            <path
              d="M 10 60 A 50 50 0 0 1 110 60"
              fill="none"
              stroke="#1e293b"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
            {/* Colored Level Arc */}
            <path
              d="M 10 60 A 50 50 0 0 1 110 60"
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000 ease-out"
            />
            {/* Value Label */}
            <text x="60" y="52" textAnchor="middle" fill="#f8fafc" className="text-[20px] font-extrabold font-sans">
              {score.toFixed(1)}
            </text>
            {/* Category Label */}
            <text x="60" y="66" textAnchor="middle" fill={color} className="text-[8px] font-extrabold uppercase tracking-wider">
              {level} RISK
            </text>
          </svg>
        </div>
        <div className="text-center mt-2">
          <h4 className="text-sm font-semibold text-slate-200">Overall Risk Index</h4>
          <p className="text-xs text-slate-400 max-w-xs mt-1 leading-relaxed">
            {riskInfo.fullText.split(' — ').slice(2).join(' — ') || 'Terran risk evaluation score'}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Risk Gauge */}
      {renderGauge()}

      {/* Insight list */}
      <div className="flex flex-col gap-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center mb-1">
          <svg className="w-4 h-4 mr-1.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          Terrain Analysis Insights
        </h3>
        {generalInsights.map((insight, idx) => (
          <div
            key={idx}
            className="flex items-start gap-3 bg-slate-800/40 border border-slate-700/60 p-3 rounded-lg hover:border-slate-600 transition-colors"
          >
            {getInsightIcon(insight)}
            <p className="text-xs text-slate-300 leading-relaxed font-medium">
              {insight}
            </p>
          </div>
        ))}
      </div>

      {/* Action Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-slate-800 pt-5">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center mb-1">
            <svg className="w-4 h-4 mr-1.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            Action Recommendations
          </h3>
          {recommendations.map((reco, idx) => (
            <div
              key={idx}
              className="flex items-start gap-3 bg-emerald-950/20 border border-emerald-800/30 p-3 rounded-lg hover:border-emerald-700/40 transition-colors"
            >
              <svg className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-slate-200 leading-relaxed font-medium">
                {reco}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
