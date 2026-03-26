import { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8080/api';

export default function HeatmapGrid({ result }) {
  const [gridCells, setGridCells] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Only fetch if we have a successful result summary
    if (!result) {
      setGridCells([]);
      return;
    }

    const fetchGridData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get(`${API_BASE_URL}/result`, {
          responseType: 'text',
        });
        
        // Parse CSV manually
        // Format: grid_x,grid_y,min_height,max_height,canopy_height,avg_height,point_density
        const lines = response.data.trim().split(/\r?\n/);
        
        if (lines.length <= 1) {
          setGridCells([]);
          return;
        }

        const parsedCells = lines.slice(1).map(line => {
          const parts = line.split(',');
          if (parts.length < 7) return null;
          
          return {
            gridX: parseInt(parts[0], 10),
            gridY: parseInt(parts[1], 10),
            minHeight: parseFloat(parts[2]),
            maxHeight: parseFloat(parts[3]),
            canopyHeight: parseFloat(parts[4]),
            avgHeight: parseFloat(parts[5]),
            pointDensity: parseInt(parts[6], 10)
          };
        }).filter(Boolean); // removes any nulls from malformed lines

        setGridCells(parsedCells);
      } catch (err) {
        console.error("Failed to fetch map data:", err);
        setError("Failed to load map data from server.");
      } finally {
        setLoading(false);
      }
    };

    fetchGridData();
  }, [result]);

  if (!result) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-8 text-center text-slate-500">
        <svg className="w-16 h-16 text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
        <p className="text-lg">Process a file to see the terrain map</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
           <svg className="animate-spin h-8 w-8 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
             <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
             <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
           </svg>
           <span className="text-slate-500 font-medium tracking-wide">Rendering Map...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full w-full flex items-center justify-center text-red-500">
        <div className="bg-red-50 p-4 rounded-md border text-center">
          <p className="font-semibold">{error}</p>
        </div>
      </div>
    );
  }

  if (gridCells.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center text-slate-500">
        <p>No map data available for this file.</p>
      </div>
    );
  }

  // 1. Find coordinate bounds to set up the CSS Grid
  const minX = Math.min(...gridCells.map(c => c.gridX));
  const maxX = Math.max(...gridCells.map(c => c.gridX));
  const minY = Math.min(...gridCells.map(c => c.gridY));
  const maxY = Math.max(...gridCells.map(c => c.gridY));

  const columns = maxX - minX + 1;
  const rows = maxY - minY + 1;

  // 2. Find min/max canopy height for the color scale across the actual cells
  const maxCanopy = Math.max(...gridCells.map(c => c.canopyHeight));
  const minCanopy = Math.min(...gridCells.map(c => c.canopyHeight));
  const canopyRange = maxCanopy - minCanopy || 1; // prevent div by zero

  // 3. Helper to determine color based on relative canopy height (0 to 1)
  const getCellColor = (canopyHeight) => {
    const ratio = (canopyHeight - minCanopy) / canopyRange;
    if (ratio >= 0.67) return 'bg-red-500 hover:bg-red-400';
    if (ratio >= 0.34) return 'bg-yellow-500 hover:bg-yellow-400';
    return 'bg-green-500 hover:bg-green-400';
  };

  // 4. Create a sparse lookup map for fast rendering
  const cellMap = new Map();
  gridCells.forEach(cell => {
    cellMap.set(`${cell.gridX},${cell.gridY}`, cell);
  });

  return (
    <div className="w-full h-full flex flex-col items-center p-6">
      
      <div className="mb-6 w-full flex justify-between items-center bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          Terrain Canopy Map
          <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
            {columns} × {rows} Grid
          </span>
        </h3>
        
        {/* Legend */}
        <div className="flex items-center space-x-6 text-sm font-medium text-slate-600 border-l pl-6">
          <div className="flex items-center">
            <div className="w-4 h-4 rounded bg-green-500 shadow-inner mr-2"></div>
            <span>Low</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 rounded bg-yellow-500 shadow-inner mr-2"></div>
            <span>Medium</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 rounded bg-red-500 shadow-inner mr-2"></div>
            <span>High Canopy</span>
          </div>
        </div>
      </div>

      {/* The Visual Grid */}
      <div className="overflow-auto max-w-full max-h-[600px] border-4 border-slate-200 rounded-xl bg-white p-2 shadow-inner">
        <div 
          className="grid gap-[2px] bg-slate-100 p-1 rounded-md"
          style={{ 
            gridTemplateColumns: `repeat(${columns}, minmax(40px, 1fr))`,
            gridTemplateRows: `repeat(${rows}, minmax(40px, 1fr))`
          }}
        >
          {Array.from({ length: rows }).map((_, rIdx) => {
            // Y coordinates usually increase upwards in math, but CSS grids go top-to-bottom
            // Depending on coordinate system, we might invert Y visually. 
            // Using standard CSS grid flow here (maxY at bottom)
            const y = minY + rIdx; 

            return Array.from({ length: columns }).map((_, cIdx) => {
              const x = minX + cIdx;
              const key = `${x},${y}`;
              const cell = cellMap.get(key);

              if (!cell) {
                // Empty grid space — no data here
                return (
                  <div 
                    key={key} 
                    className="w-10 h-10 min-w-[40px] min-h-[40px] bg-slate-50 rounded-[2px]"
                    title={`Empty (${x}, ${y})`}
                  />
                );
              }

              return (
                <div 
                  key={key} 
                  className={`w-10 h-10 min-w-[40px] min-h-[40px] rounded border border-black/10 shadow-sm transition-colors cursor-crosshair ${getCellColor(cell.canopyHeight)}`}
                  title={`Cell (${cell.gridX}, ${cell.gridY})\nCanopy: ${cell.canopyHeight.toFixed(2)} m\nDensity: ${cell.pointDensity} pts\nAvg Z: ${cell.avgHeight.toFixed(2)} m`}
                />
              );
            });
          })}
        </div>
      </div>

    </div>
  );
}
