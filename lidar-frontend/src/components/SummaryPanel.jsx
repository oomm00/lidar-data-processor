export default function SummaryPanel({ result }) {
  if (!result) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-50 border border-slate-200 border-dashed rounded-lg">
        <svg className="w-12 h-12 text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-slate-500 font-medium">Process a file to see results</p>
      </div>
    );
  }

  const {
    totalCells,
    totalPoints,
    avgCanopyHeight,
    maxCanopyHeight,
    highRiskZoneCount
  } = result;

  const stats = [
    { label: 'Total Grid Cells', value: totalCells.toLocaleString() },
    { label: 'Total Points', value: totalPoints.toLocaleString() },
    { label: 'Avg Canopy Height', value: `${avgCanopyHeight.toFixed(2)} m` },
    { label: 'Max Canopy Height', value: `${maxCanopyHeight.toFixed(2)} m` }
  ];

  return (
    <div className="space-y-4">
      {stats.map((stat, idx) => (
        <div key={idx} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col items-start justify-center transition-all hover:border-slate-300">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{stat.label}</span>
          <span className="text-2xl font-bold text-slate-800">{stat.value}</span>
        </div>
      ))}

      {/* High Risk Zones takes special styling */}
      <div className={`p-4 rounded-lg border shadow-sm flex flex-col items-start justify-center transition-all 
        ${highRiskZoneCount > 0 
          ? 'bg-red-50 border-red-200 hover:border-red-300' 
          : 'bg-white border-slate-200 hover:border-slate-300'}`}>
        <span className={`text-xs font-semibold uppercase tracking-wider mb-1
          ${highRiskZoneCount > 0 ? 'text-red-600' : 'text-slate-500'}`}>
          High Risk Zones
        </span>
        <div className="flex items-baseline space-x-2">
          <span className={`text-2xl font-bold ${highRiskZoneCount > 0 ? 'text-red-700' : 'text-slate-800'}`}>
            {highRiskZoneCount.toLocaleString()}
          </span>
          {highRiskZoneCount > 0 && (
            <span className="text-xs font-medium text-red-600 px-2 py-0.5 bg-red-100 rounded-full">
              Attention needed
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
