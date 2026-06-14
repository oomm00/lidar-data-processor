import { useEffect, useState, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Rectangle, Tooltip, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { gridCellToLatLon } from '../api/lidarApi';

// Helper component to center/zoom map dynamically
function ChangeView({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, zoom, { animate: true, duration: 1.2 });
    }
  }, [center, zoom, map]);
  return null;
}

export default function ActionPlanMap({ 
  cells, 
  originLat, 
  originLon, 
  resolution,
  greenClusterCells, 
  cascadeRiskCells, 
  drainageCells, 
  fireBufferCells,
  highlightCoordinate,
  selectedRecoText
}) {
  const [mapCenter, setMapCenter] = useState([originLat, originLon]);
  const [mapZoom, setMapZoom] = useState(15);

  const highlightCell = useMemo(() => {
    if (!selectedRecoText) return null;
    const match = selectedRecoText.match(/\b(?:at|Cell)\b\s*\(([\d.]+),\s*([\d.]+)\)/);
    if (match) {
      return {
        gridX: Math.round(parseFloat(match[1])),
        gridY: Math.round(parseFloat(match[2]))
      };
    }
    return null;
  }, [selectedRecoText]);

  useEffect(() => {
    if (highlightCoordinate) {
      setMapCenter(highlightCoordinate);
      setMapZoom(18); // Zoom in on highlighted recommendation zone
    }
  }, [highlightCoordinate]);

  // Determine path options for action plan overlay categories
  const getCellOptions = (cell) => {
    const key = `${cell.gridX},${cell.gridY}`;

    // 1. Priority Development Cluster (Green zones)
    if (greenClusterCells[key]) {
      return {
        color: '#16a34a',
        fillColor: '#22c55e',
        fillOpacity: 0.6,
        weight: 1,
        label: `Priority: ${greenClusterCells[key]}`,
      };
    }

    // 2. Cascade Risk (Red outlined zones)
    if (cascadeRiskCells.has(key)) {
      return {
        color: '#ef4444',
        fillColor: '#ef4444',
        fillOpacity: 0.1,
        weight: 2,
        dashArray: '3, 4',
        label: 'Cascade Debris Flow Path',
      };
    }

    // 3. Drainage Channels (Blue dashed/hatched zones)
    if (drainageCells.has(key)) {
      return {
        color: '#2563eb',
        fillColor: '#3b82f6',
        fillOpacity: 0.4,
        weight: 1.5,
        dashArray: '4, 4',
        label: 'Drainage Path (No Construction)',
      };
    }

    // 4. Fire Risk Buffer (Orange zones)
    if (fireBufferCells.has(key)) {
      return {
        color: '#ea580c',
        fillColor: '#f97316',
        fillOpacity: 0.45,
        weight: 1,
        label: 'Fire Break Buffer Zone',
      };
    }

    // Normal non-priority cells in summary mode
    return {
      color: '#475569',
      fillColor: '#1e293b',
      fillOpacity: 0.1,
      weight: 0.5,
      label: 'General Terrain Cell',
    };
  };

  return (
    <div className="w-full h-full relative" style={{ background: '#0a0f1e' }}>
      <MapContainer 
        center={[originLat, originLon]} 
        zoom={15} 
        style={{ width: '100%', height: '100%', background: '#0a0f1e' }}
      >
        <ChangeView center={mapCenter} zoom={mapZoom} />

        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
        />

        {/* Draw Overlay Cells */}
        {cells.map(cell => {
          const key = `${cell.gridX},${cell.gridY}`;
          const [lat1, lon1] = gridCellToLatLon(cell.gridX, cell.gridY, resolution, originLat, originLon);
          const [lat2, lon2] = gridCellToLatLon(cell.gridX + 1, cell.gridY + 1, resolution, originLat, originLon);
          const bounds = [[lat1, lon1], [lat2, lon2]];
          const options = getCellOptions(cell);

          const isHighlighted = highlightCell && highlightCell.gridX === cell.gridX && highlightCell.gridY === cell.gridY;

          return (
            <Rectangle 
              key={key}
              bounds={bounds}
              pathOptions={{
                color: isHighlighted ? '#6366f1' : options.color,
                fillColor: isHighlighted ? '#818cf8' : options.fillColor,
                fillOpacity: isHighlighted ? 0.8 : options.fillOpacity,
                weight: isHighlighted ? 3 : options.weight,
                dashArray: options.dashArray,
              }}
              eventHandlers={{
                mouseover: (e) => {
                  e.target._map.getContainer().style.cursor = 'pointer';
                },
                mouseout: (e) => {
                  e.target._map.getContainer().style.cursor = '';
                },
              }}
            >
              <Tooltip>
                <strong>{options.label}</strong><br/>
                Coordinates: ({cell.gridX}, {cell.gridY})<br/>
                Best Use: {cell.bestUse}<br/>
                Max Slope: {cell.maxSlope.toFixed(1)}°
              </Tooltip>
            </Rectangle>
          );
        })}

        {/* Highlight Popup */}
        {highlightCoordinate && selectedRecoText && (
          <Popup position={highlightCoordinate}>
            <div className="text-slate-900 font-semibold text-xs p-1 max-w-[250px] leading-relaxed">
              {selectedRecoText}
            </div>
          </Popup>
        )}
      </MapContainer>

      {/* Dynamic Overlay Legend */}
      <div className="absolute bottom-6 right-6 z-[1000] bg-[#0f172a]/95 backdrop-blur-md p-4 rounded-xl border border-slate-700 shadow-2xl pointer-events-auto">
        <h3 className="text-xs font-bold text-slate-200 mb-3 uppercase tracking-wider">Action Plan Overlay</h3>
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 bg-[#22c55e] opacity-60 rounded-sm border border-[#16a34a]"></div>
            <span className="text-xs text-slate-300 font-semibold">Priority Development Site (Largest bestUse Cluster)</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 bg-[#ef4444] opacity-10 rounded-sm border-2 border-dashed border-[#ef4444]"></div>
            <span className="text-xs text-slate-300 font-semibold">Cascade Risk Flow Path (Slope Stabilization Needed)</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 bg-[#3b82f6] opacity-40 rounded-sm border border-dashed border-[#2563eb]"></div>
            <span className="text-xs text-slate-300 font-semibold">Major Drainage Channel (Preserve Unobstructed)</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 bg-[#f97316] opacity-45 rounded-sm border border-[#ea580c]"></div>
            <span className="text-xs text-slate-300 font-semibold">Fire Break Buffer Zone (15m clearing buffer)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
