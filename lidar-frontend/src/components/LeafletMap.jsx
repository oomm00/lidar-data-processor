import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Rectangle, Polyline, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { gridCellToLatLon } from '../api/lidarApi';

export default function LeafletMap({ cells, filteredCells, originLat, originLon, resolution }) {
  const [roads, setRoads] = useState([]);

  const activeCells = filteredCells !== null ? filteredCells : cells;

  useEffect(() => {
    if (!cells || cells.length === 0) return;

    let maxGridX = -Infinity;
    let maxGridY = -Infinity;
    cells.forEach(c => {
      if (c.gridX > maxGridX) maxGridX = c.gridX;
      if (c.gridY > maxGridY) maxGridY = c.gridY;
    });

    const south = originLat;
    const north = originLat + (maxGridY * resolution) / 111320;
    const west = originLon;
    const east = originLon + (maxGridX * resolution) / (111320 * Math.cos(originLat * Math.PI / 180));

    const query = `
      [out:json];
      way["highway"](${south},${west},${north},${east});
      out geom;
    `;

    fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: query
    })
    .then(r => r.json())
    .then(data => {
      if (data && data.elements) {
        const fetchedRoads = data.elements.map(el => ({
          points: el.geometry.map(g => [g.lat, g.lon]),
          name: el.tags?.name || el.tags?.highway || 'Road'
        }));
        setRoads(fetchedRoads);
      }
    })
    .catch(err => console.error("Failed to fetch roads from Overpass API:", err));
  }, [originLat, originLon, cells, resolution]);

  const landslideCells = useMemo(() => {
    const set = new Set();
    if (activeCells) {
      activeCells.forEach(c => {
        if (c.riskLevel === 'LANDSLIDE_RISK') {
          set.add(`${c.gridX},${c.gridY}`);
        }
      });
    }
    return set;
  }, [activeCells]);

  if (!activeCells || activeCells.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900 rounded-lg border border-slate-800">
        <p className="text-slate-400 text-lg">Process a file to see map view</p>
      </div>
    );
  }

  const getRiskColorAndOpacity = (riskLevel) => {
    switch(riskLevel) {
      case 'NORMAL': return { color: '#22c55e', opacity: 0.1 };
      case 'FIRE_RISK': return { color: '#ef4444', opacity: 0.6 };
      case 'LANDSLIDE_RISK': return { color: '#f97316', opacity: 0.6 };
      case 'URBAN_ZONE': return { color: '#3b82f6', opacity: 0.5 };
      default: return { color: '#888888', opacity: 0.2 };
    }
  };

  return (
    <div className="w-full h-full relative" style={{ background: '#0f172a' }}>
      <MapContainer 
        center={[originLat, originLon]} 
        zoom={13} 
        style={{ width: '100%', height: '100%', background: '#0f172a' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
        />

        {/* Draw Risk Zone Rectangles */}
        {activeCells.map(cell => {
          const [lat1, lon1] = gridCellToLatLon(cell.gridX, cell.gridY, resolution, originLat, originLon);
          const [lat2, lon2] = gridCellToLatLon(cell.gridX + 1, cell.gridY + 1, resolution, originLat, originLon);
          const bounds = [[lat1, lon1], [lat2, lon2]];
          const { color, opacity } = getRiskColorAndOpacity(cell.riskLevel);

          return (
            <Rectangle 
              key={`${cell.gridX}-${cell.gridY}`}
              bounds={bounds}
              pathOptions={{ color: color, fillColor: color, fillOpacity: opacity, weight: 0.5 }}
            >
              <Tooltip>
                Cell ({cell.gridX}, {cell.gridY})<br/>
                Risk: {cell.riskLevel}<br/>
                Type: {cell.dominantType}
              </Tooltip>
            </Rectangle>
          );
        })}

        {/* Road Overlay */}
        {roads.map((road, idx) => {
          let inLandslide = false;
          for (let pt of road.points) {
            const lat = pt[0];
            const lon = pt[1];
            const gridX = Math.floor((lon - originLon) * 111320 * Math.cos(lat * Math.PI / 180) / resolution);
            const gridY = Math.floor((lat - originLat) * 111320 / resolution);
            if (landslideCells.has(`${gridX},${gridY}`)) {
              inLandslide = true;
              break;
            }
          }

          const color = inLandslide ? '#ef4444' : '#ffffff';
          const weight = inLandslide ? 4 : 2;
          const opacity = inLandslide ? 1 : 0.7;

          return (
            <Polyline 
              key={idx} 
              positions={road.points} 
              pathOptions={{ color, weight, opacity }}
            >
              <Tooltip>
                {road.name}<br/>
                {inLandslide ? 'Status: HAZARD ZONE (Landslide)' : 'Status: Clear'}
              </Tooltip>
            </Polyline>
          );
        })}
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-6 right-6 z-[1000] bg-slate-900/90 backdrop-blur-md p-4 rounded-lg border border-slate-700 shadow-xl pointer-events-auto">
        <h3 className="text-sm font-bold text-white mb-3 uppercase tracking-wide">Risk Zones</h3>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-[#22c55e] opacity-10 rounded-sm border border-[#22c55e]"></div>
            <span className="text-xs text-slate-200">Normal</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-[#ef4444] opacity-60 rounded-sm border border-[#ef4444]"></div>
            <span className="text-xs text-slate-200">Fire Risk</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-[#f97316] opacity-60 rounded-sm border border-[#f97316]"></div>
            <span className="text-xs text-slate-200">Landslide Risk</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-[#3b82f6] opacity-50 rounded-sm border border-[#3b82f6]"></div>
            <span className="text-xs text-slate-200">Urban Zone</span>
          </div>
          <div className="w-full h-px bg-slate-700 my-1"></div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-[2px] bg-white"></div>
            <span className="text-xs text-slate-200">Road</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-[4px] bg-[#ef4444]"></div>
            <span className="text-xs text-slate-200">Road in Hazard Zone</span>
          </div>
        </div>
      </div>
    </div>
  );
}
