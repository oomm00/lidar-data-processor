export default function SummaryPanel({ result }) {
  if (!result) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-800 border border-slate-600 border-dashed rounded-lg">
        <svg className="w-12 h-12 text-slate-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-slate-400 font-medium">Process a file to see results</p>
      </div>
    );
  }

  const {
    totalCells,
    totalPoints,
    avgCanopyHeight,
    maxCanopyHeight,
    highRiskZoneCount,
    fireRiskZones,
    landslideZones,
    urbanZones
  } = result;

  const stats = [
    { label: 'Total Grid Cells', value: totalCells.toLocaleString() },
    { label: 'Total Points', value: totalPoints.toLocaleString() },
    { label: 'Avg Canopy Height', value: `${avgCanopyHeight.toFixed(2)} m` },
    { label: 'Max Canopy Height', value: `${maxCanopyHeight.toFixed(2)} m` }
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {stats.map((stat, idx) => (
        <div key={idx} className="bg-slate-800/50 p-3 rounded-lg border border-slate-700 flex flex-col items-start justify-center transition-all hover:border-slate-500">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{stat.label}</span>
          <span className="text-lg font-bold text-slate-100">{stat.value}</span>
        </div>
      ))}

      {/* High Risk Zones takes special styling */}
      <div className={`p-3 rounded-lg border flex flex-col items-start justify-center transition-all 
        ${highRiskZoneCount > 0 
          ? 'bg-red-900/30 border-red-500/50 hover:border-red-400' 
          : 'bg-slate-800/50 border-slate-700 hover:border-slate-500'}`}>
        <span className={`text-[10px] font-semibold uppercase tracking-wider mb-1
          ${highRiskZoneCount > 0 ? 'text-red-400' : 'text-slate-400'}`}>
          High Risk Zones
        </span>
        <div className="flex items-baseline space-x-2">
          <span className={`text-lg font-bold ${highRiskZoneCount > 0 ? 'text-red-300' : 'text-slate-100'}`}>
            {highRiskZoneCount.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Fire Risk Zones */}
      <div className={`p-3 rounded-lg border flex flex-col items-start justify-center transition-all
        ${fireRiskZones > 0
          ? 'bg-red-900/30 border-red-500/50 hover:border-red-400'
          : 'bg-slate-800/50 border-slate-700 hover:border-slate-500'}`}>
        <span className={`text-[10px] font-semibold uppercase tracking-wider mb-1
          ${fireRiskZones > 0 ? 'text-red-400' : 'text-slate-400'}`}>
          Fire Risk Zones
        </span>
        <span className={`text-lg font-bold ${fireRiskZones > 0 ? 'text-red-300' : 'text-slate-100'}`}>
          {fireRiskZones.toLocaleString()}
        </span>
      </div>

      {/* Landslide Zones */}
      <div className={`p-3 rounded-lg border flex flex-col items-start justify-center transition-all
        ${landslideZones > 0
          ? 'bg-orange-900/30 border-orange-500/50 hover:border-orange-400'
          : 'bg-slate-800/50 border-slate-700 hover:border-slate-500'}`}>
        <span className={`text-[10px] font-semibold uppercase tracking-wider mb-1
          ${landslideZones > 0 ? 'text-orange-400' : 'text-slate-400'}`}>
          Landslide Zones
        </span>
        <span className={`text-lg font-bold ${landslideZones > 0 ? 'text-orange-300' : 'text-slate-100'}`}>
          {landslideZones.toLocaleString()}
        </span>
      </div>

      {/* Urban Zones */}
      <div className="p-3 rounded-lg border flex flex-col items-start justify-center transition-all bg-blue-900/30 border-blue-500/50 hover:border-blue-400">
        <span className="text-[10px] font-semibold uppercase tracking-wider mb-1 text-blue-400">
          Urban Zones
        </span>
        <span className="text-lg font-bold text-blue-300">
          {urbanZones.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
