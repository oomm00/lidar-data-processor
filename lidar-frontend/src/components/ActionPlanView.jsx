import { useState, useMemo, useEffect } from 'react';
import ActionPlanMap from './ActionPlanMap';
import { gridCellToLatLon } from '../api/lidarApi';

export default function ActionPlanView({ 
  cells, 
  originLat, 
  originLon, 
  resolution, 
  recommendations, 
  highlightedRecoText 
}) {
  const [selectedReco, setSelectedReco] = useState(null);
  const [highlightCoordinate, setHighlightCoordinate] = useState(null);

  // 1. Calculate the overlays dynamically in Javascript
  const overlays = useMemo(() => {
    if (!cells || cells.length === 0) {
      return { 
        greenClusterCells: {}, 
        cascadeRiskCells: new Set(), 
        drainageCells: new Set(), 
        fireBufferCells: new Set() 
      };
    }

    const gridMap = {};
    cells.forEach(c => {
      gridMap[`${c.gridX},${c.gridY}`] = c;
    });

    const visited = new Set();
    const clusters = { CONSTRUCTION: [], AGRICULTURE: [], SOLAR: [] };

    // Group adjacent cells with the same bestUse to extract the largest cluster
    cells.forEach(cell => {
      const key = `${cell.gridX},${cell.gridY}`;
      if (visited.has(key)) return;

      const targetUse = cell.bestUse;
      if (targetUse === 'UNSUITABLE' || !clusters[targetUse]) return;

      const currentCluster = [];
      const queue = [cell];
      visited.add(key);

      while (queue.length > 0) {
        const curr = queue.shift();
        currentCluster.push(curr);

        const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        for (let dir of directions) {
          const nx = curr.gridX + dir[0];
          const ny = curr.gridY + dir[1];
          const nkey = `${nx},${ny}`;
          if (!visited.has(nkey) && gridMap[nkey]) {
            const ncell = gridMap[nkey];
            if (ncell.bestUse === targetUse) {
              visited.add(nkey);
              queue.push(ncell);
            }
          }
        }
      }

      if (currentCluster.length > clusters[targetUse].length) {
        clusters[targetUse] = currentCluster;
      }
    });

    // Map green cells by coordinate key to their suitability use
    const greenMap = {};
    Object.entries(clusters).forEach(([useType, clusterCells]) => {
      clusterCells.forEach(c => {
        greenMap[`${c.gridX},${c.gridY}`] = useType;
      });
    });

    // Cascade risk cells (Red outlines)
    const cascadeSet = new Set();
    cells.forEach(c => {
      if (c.cascadeRisk) {
        cascadeSet.add(`${c.gridX},${c.gridY}`);
      }
    });

    // Drainage paths (Top 10% flow accumulation)
    const sortedAccum = cells.map(c => c.flowAccumulation).sort((a, b) => b - a);
    const thresholdIndex = Math.max(0, Math.floor(sortedAccum.length * 0.1));
    const threshold = sortedAccum.length > 0 ? sortedAccum[thresholdIndex] : 5;
    const drainageSet = new Set();
    cells.forEach(c => {
      if (c.flowAccumulation >= threshold && c.flowAccumulation >= 5) {
        drainageSet.add(`${c.gridX},${c.gridY}`);
      }
    });

    // Fire buffers (15m buffer around FIRE_RISK cells)
    const fireCells = cells.filter(c => c.riskLevel === 'FIRE_RISK');
    const fireBufferSet = new Set();
    const bufferGridDist = Math.ceil(15 / resolution);

    cells.forEach(c => {
      if (c.riskLevel === 'FIRE_RISK') return;
      const isNear = fireCells.some(f => {
        const dx = f.gridX - c.gridX;
        const dy = f.gridY - c.gridY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        return dist <= bufferGridDist;
      });
      if (isNear) {
        fireBufferSet.add(`${c.gridX},${c.gridY}`);
      }
    });

    return {
      greenClusterCells: greenMap,
      cascadeRiskCells: cascadeSet,
      drainageCells: drainageSet,
      fireBufferCells: fireBufferSet
    };
  }, [cells, resolution]);

  // Parse location coordinate reference from recommendation string
  const parseCentroid = (recoText) => {
    const match = recoText.match(/\b(?:at|Cell)\b\s*\(([\d.]+),\s*([\d.]+)\)/);
    if (match) {
      return {
        gridX: parseFloat(match[1]),
        gridY: parseFloat(match[2])
      };
    }
    return null;
  };

  const handleCardClick = (reco) => {
    setSelectedReco(reco);
    const coord = parseCentroid(reco);
    if (coord) {
      const [lat, lon] = gridCellToLatLon(coord.gridX + 0.5, coord.gridY + 0.5, resolution, originLat, originLon);
      setHighlightCoordinate([lat, lon]);
    } else {
      setHighlightCoordinate(null); // Clear highlight if no location parsed (e.g. overall summary)
    }
  };

  useEffect(() => {
    if (highlightedRecoText) {
      handleCardClick(highlightedRecoText);
    }
  }, [highlightedRecoText, resolution, originLat, originLon]);

  const getRecoCategory = (text) => {
    const txt = text.toLowerCase();
    if (txt.includes('firebreak')) return 'Fire Safety';
    if (txt.includes('slope stabilization')) return 'Slope & Debris hazard';
    if (txt.includes('unsurveyable')) return 'Unstable Slope Warning';
    if (txt.includes('suitable for')) return 'Priority Land Use';
    if (txt.includes('drainage channel')) return 'Hydrology Plan';
    return 'Overall Site Suitability';
  };

  const getRecoIcon = (text) => {
    const txt = text.toLowerCase();
    if (txt.includes('firebreak')) {
      return (
        <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    }
    if (txt.includes('slope stabilization') || txt.includes('unsurveyable')) {
      return (
        <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    }
    if (txt.includes('suitable for')) {
      return (
        <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    }
    if (txt.includes('drainage channel')) {
      return (
        <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 9.172V5L8 4z" />
        </svg>
      );
    }
    return (
      <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  };

  return (
    <div className="flex w-full h-full overflow-hidden bg-[#0a0f1e]">
      
      {/* Clickable Recommendations Sidebar */}
      <aside className="w-[360px] border-r border-slate-800 bg-[#0f172a] p-5 flex flex-col gap-5 shrink-0 overflow-y-auto custom-scrollbar h-full z-10">
        <div>
          <h2 className="text-base font-bold text-white tracking-wide">Executive Action Plan</h2>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Click on any action recommendation card to locate the flagged zone and display details on the map.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {recommendations && recommendations.length > 0 ? (
            recommendations.map((reco, idx) => {
              const category = getRecoCategory(reco);
              const icon = getRecoIcon(reco);
              const isSelected = selectedReco === reco;
              const hasLoc = parseCentroid(reco) !== null;

              return (
                <div
                  key={idx}
                  onClick={() => handleCardClick(reco)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-2 relative ${
                    isSelected
                      ? 'bg-indigo-950/45 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.25)] ring-1 ring-indigo-500/20'
                      : 'bg-slate-800/35 border-slate-700/60 hover:border-slate-500 hover:bg-slate-800/65'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {icon}
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                        {category}
                      </span>
                    </div>
                    {hasLoc && (
                      <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 ${
                        isSelected 
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/30' 
                          : 'bg-slate-700/40 text-slate-400 border border-slate-600/30'
                      }`}>
                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        </svg>
                        Locate
                      </span>
                    )}
                  </div>
                  <p className={`text-xs leading-relaxed font-medium ${isSelected ? 'text-indigo-100' : 'text-slate-300'}`}>
                    {reco}
                  </p>
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-slate-500 text-xs">
              No recommendations available.
            </div>
          )}
        </div>
      </aside>

      {/* Main Map Visualization Area */}
      <main className="flex-1 h-full relative">
        <ActionPlanMap
          cells={cells}
          originLat={originLat}
          originLon={originLon}
          resolution={resolution}
          greenClusterCells={overlays.greenClusterCells}
          cascadeRiskCells={overlays.cascadeRiskCells}
          drainageCells={overlays.drainageCells}
          fireBufferCells={overlays.fireBufferCells}
          highlightCoordinate={highlightCoordinate}
          selectedRecoText={selectedReco}
        />
      </main>
    </div>
  );
}
