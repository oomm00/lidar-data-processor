import { useEffect, useState, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, ImageOverlay, Polyline, Popup, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { gridCellToLatLon } from '../api/lidarApi';

// ─────────────────────────────────────────────
//  Color-mode palettes (mirrors TerrainDEM logic)
// ─────────────────────────────────────────────
const RISK_COLORS = {
  NORMAL:         [34,  197, 94,  30],   // green, low opacity
  FIRE_RISK:      [239, 68,  68,  200],  // red
  LANDSLIDE_RISK: [249, 115, 22,  200],  // orange
  URBAN_ZONE:     [59,  130, 246, 180],  // blue
};

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function lerpColor(c1, c2, t) {
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * t),
    Math.round(c1[1] + (c2[1] - c1[1]) * t),
    Math.round(c1[2] + (c2[2] - c1[2]) * t),
  ];
}

// Rainbow elevation ramp: blue → cyan → green → yellow → orange → red
const ELEV_RAMP = [
  [10,  0,  170],
  [0,   85, 255],
  [0,  170, 255],
  [0,  232, 170],
  [136,255,  0],
  [255,238,  0],
  [255,136,  0],
  [255, 34,  0],
  [204,  0,  0],
];
function elevColor(t) {
  const clamped = Math.max(0, Math.min(1, t));
  const scaled  = clamped * (ELEV_RAMP.length - 1);
  const lo      = Math.floor(scaled);
  const hi      = Math.min(lo + 1, ELEV_RAMP.length - 1);
  return lerpColor(ELEV_RAMP[lo], ELEV_RAMP[hi], scaled - lo);
}

function getCellRGBA(cell, colorMode, globalMin, globalMax) {
  if (!cell) return null;
  switch (colorMode) {
    case 'risk': {
      const c = RISK_COLORS[cell.riskLevel] || [136, 136, 136, 50];
      return c; // [r, g, b, a]
    }
    case 'suitability': {
      const map = {
        CONSTRUCTION: [100, 116, 139, 210],
        AGRICULTURE:  [34,  197,  94, 210],
        SOLAR:        [234, 179,   8, 210],
        UNSUITABLE:   [239,  68,  68, 210],
      };
      return map[cell.bestUse] || [136, 136, 136, 180];
    }
    case 'slope': {
      const t = Math.min(1, (cell.maxSlope || 0) / 45);
      const c = lerpColor([34, 197, 94], [239, 68, 68], t);
      return [...c, 200];
    }
    case 'drainage': {
      const accum = cell.flowAccumulation || 1;
      const t = Math.min(1, Math.log10(accum) / 2);
      const c = lerpColor([224, 242, 254], [30, 58, 138], t);
      return [...c, cell.cascadeRisk ? 220 : 180];
    }
    default: { // elevation
      const h = cell.avgHeight ?? cell.maxHeight ?? 0;
      const t = (h - globalMin) / ((globalMax - globalMin) || 1);
      const c = elevColor(t);
      return [...c, 200];
    }
  }
}

// ─────────────────────────────────────────────
//  Build canvas data URL (memoized)
// ─────────────────────────────────────────────
const PX = 3; // pixels per cell for visibility

function buildCanvasDataUrl(activeCells, colorMode, filteredSet, isFilterActive) {
  if (!activeCells || activeCells.length === 0) return null;

  // Compute grid extents
  let minGX = Infinity, maxGX = -Infinity;
  let minGY = Infinity, maxGY = -Infinity;
  let globalMin = Infinity, globalMax = -Infinity;
  activeCells.forEach(c => {
    if (c.gridX < minGX) minGX = c.gridX;
    if (c.gridX > maxGX) maxGX = c.gridX;
    if (c.gridY < minGY) minGY = c.gridY;
    if (c.gridY > maxGY) maxGY = c.gridY;
    const h = c.avgHeight ?? c.maxHeight ?? 0;
    if (h < globalMin) globalMin = h;
    if (h > globalMax) globalMax = h;
  });

  const cols = maxGX - minGX + 1;
  const rows = maxGY - minGY + 1;
  const W = cols * PX;
  const H = rows * PX;

  const canvas = document.createElement('canvas');
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Transparent black background
  ctx.clearRect(0, 0, W, H);

  const imageData = ctx.createImageData(W, H);
  const data = imageData.data;

  activeCells.forEach(cell => {
    const key = `${cell.gridX},${cell.gridY}`;
    const dimmed = isFilterActive && !filteredSet.has(key);

    const rgba = getCellRGBA(cell, colorMode, globalMin, globalMax);
    if (!rgba) return;

    let [r, g, b, a] = rgba;
    if (dimmed) { r = 30; g = 41; b = 59; a = 80; }

    const col = cell.gridX - minGX;
    const row = maxGY - cell.gridY; // flip Y so north is up

    for (let py = 0; py < PX; py++) {
      for (let px = 0; px < PX; px++) {
        const x = col * PX + px;
        const y = row * PX + py;
        const idx = (y * W + x) * 4;
        data[idx]     = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = a;
      }
    }
  });

  ctx.putImageData(imageData, 0, 0);
  return { dataUrl: canvas.toDataURL('image/png'), minGX, maxGX, minGY, maxGY };
}

// ─────────────────────────────────────────────
//  Auto-fit map to overlay bounds when data loads
// ─────────────────────────────────────────────
function FitBoundsOnLoad({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [20, 20], maxZoom: 18 });
    }
  }, [bounds, map]);
  return null;
}

// ─────────────────────────────────────────────
//  Click handler: lat/lng → grid cell lookup
// ─────────────────────────────────────────────
function GridClickHandler({ cellMap, originLat, originLon, resolution, onCellClick }) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      const gridX = Math.floor(
        (lng - originLon) * 111320 * Math.cos(originLat * Math.PI / 180) / resolution
      );
      const gridY = Math.floor((lat - originLat) * 111320 / resolution);
      const cell = cellMap.get(`${gridX},${gridY}`);
      // Store plain {lat,lng} — NOT the Leaflet LatLng object — so React can serialize it
      if (cell) onCellClick({ cell, latlng: { lat, lng } });
    },
  });
  return null;
}

// ─────────────────────────────────────────────
//  Main component
// ─────────────────────────────────────────────
export default function LeafletMap({ cells, filteredCells, originLat, originLon, resolution }) {
  const [roads, setRoads] = useState([]);
  const [colorMode, setColorMode] = useState('risk');
  const [clickedCell, setClickedCell] = useState(null); // { cell, latlng }

  const activeCells = filteredCells !== null ? filteredCells : cells;
  const isFilterActive = filteredCells !== null;

  // Fast O(1) cell lookup by "gridX,gridY"
  const cellMap = useMemo(() => {
    const m = new Map();
    if (cells) cells.forEach(c => m.set(`${c.gridX},${c.gridY}`, c));
    return m;
  }, [cells]);

  const filteredSet = useMemo(() => {
    const s = new Set();
    if (filteredCells) filteredCells.forEach(c => s.add(`${c.gridX},${c.gridY}`));
    return s;
  }, [filteredCells]);

  // ── Fetch roads (Overpass) ────────────────
  useEffect(() => {
    if (!cells || cells.length === 0) return;
    let maxGridX = -Infinity, maxGridY = -Infinity;
    cells.forEach(c => {
      if (c.gridX > maxGridX) maxGridX = c.gridX;
      if (c.gridY > maxGridY) maxGridY = c.gridY;
    });
    const south = originLat;
    const north = originLat + (maxGridY * resolution) / 111320;
    const west  = originLon;
    const east  = originLon + (maxGridX * resolution) / (111320 * Math.cos(originLat * Math.PI / 180));
    const query = `[out:json];way["highway"](${south},${west},${north},${east});out geom;`;
    fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: query })
      .then(r => r.json())
      .then(data => {
        if (data?.elements) {
          setRoads(data.elements.map(el => ({
            points: el.geometry.map(g => [g.lat, g.lon]),
            name: el.tags?.name || el.tags?.highway || 'Road',
          })));
        }
      })
      .catch(err => console.error('Overpass API error:', err));
  }, [originLat, originLon, cells, resolution]);

  // ── Landslide set for road coloring ──────
  const landslideCells = useMemo(() => {
    const s = new Set();
    if (activeCells) activeCells.forEach(c => {
      if (c.riskLevel === 'LANDSLIDE_RISK') s.add(`${c.gridX},${c.gridY}`);
    });
    return s;
  }, [activeCells]);

  // ── Canvas raster (the key performance fix) ──
  const canvasResult = useMemo(
    () => buildCanvasDataUrl(activeCells, colorMode, filteredSet, isFilterActive),
    [activeCells, colorMode, filteredSet, isFilterActive]
  );

  // Compute geographic bounds of the image overlay
  const overlayBounds = useMemo(() => {
    if (!canvasResult) return null;
    const { minGX, maxGX, minGY, maxGY } = canvasResult;
    const [southLat, westLon] = gridCellToLatLon(minGX,     minGY,     resolution, originLat, originLon);
    const [northLat, eastLon] = gridCellToLatLon(maxGX + 1, maxGY + 1, resolution, originLat, originLon);
    return [[southLat, westLon], [northLat, eastLon]];
  }, [canvasResult, resolution, originLat, originLon]);

  const handleCellClick = useCallback(({ cell, latlng }) => {
    setClickedCell({ cell, latlng });
  }, []);

  if (!activeCells || activeCells.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900 rounded-lg border border-slate-800">
        <p className="text-slate-400 text-lg">Process a file to see map view</p>
      </div>
    );
  }

  const COLOR_MODES = [
    { id: 'risk',        label: 'Risk' },
    { id: 'suitability', label: 'Suitability' },
    { id: 'slope',       label: 'Slope' },
    { id: 'drainage',    label: 'Drainage' },
    { id: 'elevation',   label: 'Elevation' },
  ];

  return (
    <div className="w-full h-full relative" style={{ background: '#0f172a' }}>

      {/* Color mode toggle */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] flex gap-1 bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-xl p-1 shadow-xl pointer-events-auto">
        {COLOR_MODES.map(m => (
          <button
            key={m.id}
            onClick={() => setColorMode(m.id)}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
              colorMode === m.id
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Cell count badge */}
      <div className="absolute top-14 left-1/2 -translate-x-1/2 z-[1000] bg-slate-900/80 border border-slate-700 text-slate-400 text-[10px] font-mono px-3 py-1 rounded-full pointer-events-none">
        {activeCells.length.toLocaleString()} cells · canvas raster
      </div>

      <MapContainer
        center={[originLat, originLon]}
        zoom={13}
        preferCanvas={true}
        style={{ width: '100%', height: '100%', background: '#0f172a' }}
      >
        <FitBoundsOnLoad bounds={overlayBounds} />
        <GridClickHandler
          cellMap={cellMap}
          originLat={originLat}
          originLon={originLon}
          resolution={resolution}
          onCellClick={handleCellClick}
        />

        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
        />

        {/* ── Single canvas raster overlay (O(1) DOM cost) ── */}
        {canvasResult && overlayBounds && (
          <ImageOverlay
            url={canvasResult.dataUrl}
            bounds={overlayBounds}
            opacity={0.75}
            zIndex={400}
          />
        )}

        {/* ── Click popup — key forces remount so it opens fresh each click ── */}
        {clickedCell && (
          <Popup
            key={`${clickedCell.cell.gridX}-${clickedCell.cell.gridY}`}
            position={[clickedCell.latlng.lat, clickedCell.latlng.lng]}
            onClose={() => setClickedCell(null)}
          >
            <div className="text-slate-900 text-xs font-medium leading-relaxed min-w-[160px]">
              <div className="font-bold text-sm mb-1">
                Cell ({clickedCell.cell.gridX}, {clickedCell.cell.gridY})
              </div>
              <div>Risk: <span className="font-semibold">{clickedCell.cell.riskLevel}</span></div>
              <div>Type: {clickedCell.cell.dominantType}</div>
              <div>Best Use: {clickedCell.cell.bestUse}</div>
              <div>Slope: {clickedCell.cell.maxSlope?.toFixed(1)}°</div>
              <div>Avg Height: {clickedCell.cell.avgHeight?.toFixed(1)} m</div>
              {clickedCell.cell.cascadeRisk && (
                <div className="mt-1 text-red-600 font-bold">⚠ Cascade Risk</div>
              )}
            </div>
          </Popup>
        )}

        {/* ── Road overlay (small DOM, not the bottleneck) ── */}
        {roads.map((road, idx) => {
          let inLandslide = false;
          for (const pt of road.points) {
            const gridX = Math.floor((pt[1] - originLon) * 111320 * Math.cos(originLat * Math.PI / 180) / resolution);
            const gridY = Math.floor((pt[0] - originLat) * 111320 / resolution);
            if (landslideCells.has(`${gridX},${gridY}`)) { inLandslide = true; break; }
          }
          return (
            <Polyline
              key={idx}
              positions={road.points}
              pathOptions={{
                color:   inLandslide ? '#ef4444' : '#ffffff',
                weight:  inLandslide ? 4 : 2,
                opacity: inLandslide ? 1.0 : 0.7,
              }}
            />
          );
        })}
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-6 right-6 z-[1000] bg-slate-900/90 backdrop-blur-md p-4 rounded-lg border border-slate-700 shadow-xl pointer-events-auto min-w-[160px]">
        {colorMode === 'risk' && (
          <>
            <h3 className="text-xs font-bold text-white mb-2 uppercase tracking-wide">Risk Zones</h3>
            {[
              { color: '#22c55e33', label: 'Normal' },
              { color: '#ef4444cc', label: 'Fire Risk' },
              { color: '#f97316cc', label: 'Landslide Risk' },
              { color: '#3b82f6bb', label: 'Urban Zone' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-2 mb-1">
                <div className="w-4 h-4 rounded-sm border border-white/10" style={{ background: color }} />
                <span className="text-xs text-slate-200">{label}</span>
              </div>
            ))}
          </>
        )}
        {colorMode === 'suitability' && (
          <>
            <h3 className="text-xs font-bold text-white mb-2 uppercase tracking-wide">Suitability</h3>
            {[
              { color: '#64748b', label: 'Construction' },
              { color: '#22c55e', label: 'Agriculture' },
              { color: '#eab308', label: 'Solar' },
              { color: '#ef4444', label: 'Unsuitable' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-2 mb-1">
                <div className="w-4 h-4 rounded-sm" style={{ background: color }} />
                <span className="text-xs text-slate-200">{label}</span>
              </div>
            ))}
          </>
        )}
        {colorMode === 'slope' && (
          <>
            <h3 className="text-xs font-bold text-white mb-2 uppercase tracking-wide">Slope</h3>
            <div className="w-full h-3 rounded-sm mb-1" style={{ background: 'linear-gradient(to right, #22c55e, #ef4444)' }} />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>Flat 0°</span><span>Steep 45°+</span>
            </div>
          </>
        )}
        {colorMode === 'drainage' && (
          <>
            <h3 className="text-xs font-bold text-white mb-2 uppercase tracking-wide">Drainage</h3>
            <div className="w-full h-3 rounded-sm mb-1" style={{ background: 'linear-gradient(to right, #e0f2fe, #1e3a8a)' }} />
            <div className="flex justify-between text-[10px] text-slate-400 mb-2">
              <span>Low</span><span>High Flow</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border border-red-500 bg-red-500/20 rounded-sm" />
              <span className="text-xs text-red-400 font-semibold">Cascade Risk</span>
            </div>
          </>
        )}
        {colorMode === 'elevation' && (
          <>
            <h3 className="text-xs font-bold text-white mb-2 uppercase tracking-wide">Elevation</h3>
            <div className="w-full h-3 rounded-sm mb-1"
              style={{ background: 'linear-gradient(to right, #0a00aa, #0055ff, #00aaff, #88ff00, #ffee00, #ff8800, #cc0000)' }} />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>Low</span><span>High</span>
            </div>
          </>
        )}
        <div className="border-t border-slate-700 mt-2 pt-2 flex items-center gap-2">
          <div className="w-4 h-[2px] bg-white" />
          <span className="text-xs text-slate-400">Road</span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="w-4 h-[3px] bg-[#ef4444]" />
          <span className="text-xs text-slate-400">Road in Hazard Zone</span>
        </div>
      </div>

      {/* Click hint */}
      <div className="absolute bottom-6 left-6 z-[1000] bg-slate-900/80 border border-slate-700 text-slate-400 text-[10px] px-3 py-1.5 rounded-lg pointer-events-none">
        🖱 Click any cell to inspect
      </div>
    </div>
  );
}
