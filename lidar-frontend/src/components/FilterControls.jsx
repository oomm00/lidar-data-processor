import { useState } from 'react';

export default function FilterControls({ cells, onFilterChange }) {
  const [riskLevel, setRiskLevel] = useState('All');
  const [dominantType, setDominantType] = useState('All');
  const [minCanopy, setMinCanopy] = useState(0);
  const [maxCanopy, setMaxCanopy] = useState(9000);

  function applyFilters() {
    let filtered = cells;

    if (riskLevel !== 'All') {
      filtered = filtered.filter(c => c.riskLevel === riskLevel);
    }

    if (dominantType !== 'All') {
      filtered = filtered.filter(c => c.dominantType === dominantType);
    }

    filtered = filtered.filter(
      c => Number(c.canopyHeight) >= minCanopy && Number(c.canopyHeight) <= maxCanopy
    );

    onFilterChange(filtered);
  }

  function resetFilters() {
    setRiskLevel('All');
    setDominantType('All');
    setMinCanopy(0);
    setMaxCanopy(9000);
    onFilterChange(null);
  }

  return (
    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
      <div className="flex flex-wrap items-end gap-4">
        {/* Risk Level */}
        <div className="flex flex-col">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Risk Level
          </label>
          <select
            value={riskLevel}
            onChange={e => setRiskLevel(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="All">All</option>
            <option value="NORMAL">NORMAL</option>
            <option value="FIRE_RISK">FIRE_RISK</option>
            <option value="LANDSLIDE_RISK">LANDSLIDE_RISK</option>
            <option value="URBAN_ZONE">URBAN_ZONE</option>
          </select>
        </div>

        {/* Dominant Type */}
        <div className="flex flex-col">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Dominant Type
          </label>
          <select
            value={dominantType}
            onChange={e => setDominantType(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="All">All</option>
            <option value="Ground">Ground</option>
            <option value="Vegetation">Vegetation</option>
            <option value="Building">Building</option>
            <option value="Rock">Rock</option>
          </select>
        </div>

        {/* Canopy Height Range */}
        <div className="flex flex-col">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Canopy Height (m)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={minCanopy}
              onChange={e => setMinCanopy(Number(e.target.value))}
              className="w-24 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-500">to</span>
            <input
              type="number"
              value={maxCanopy}
              onChange={e => setMaxCanopy(Number(e.target.value))}
              className="w-24 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={applyFilters}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors"
          >
            Apply Filters
          </button>
          <button
            onClick={resetFilters}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-200 rounded-md shadow-sm hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
