import { useEffect, useMemo, useCallback, useState } from 'react';
import { MapContainer, TileLayer, ImageOverlay, Popup, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { gridCellToLatLon } from '../api/lidarApi';

// pixels per cell (3 gives good visibility without huge canvas)
const PX = 3;

// ─── Zone colours [r, g, b, a] ───────────────────────────────────────────────
const ZONE_COLORS = {
  // Priority clusters by bestUse
  CONSTRUCTION: [100, 116, 139, 210],   // slate
  AGRICULTURE:  [34,  197,  94, 220],   // green
  SOLAR:        [234, 179,   8, 210],   // amber

  CASCADE_FILL:  [220,  38,  38, 160],  // red fill (cascade interior)
  CASCADE_EDGE:  [127,  29,  29, 255],  // dark red border (edge cells)
  DRAINAGE_FILL: [ 59, 130, 246, 180],  // blue
  DRAINAGE_HATCH:[29,  78, 216, 255],   // darker blue hatch lines
  FIRE_FILL:     [249, 115,  22, 170],  // orange

  // highlighted selected-reco cell
  HIGHLIGHT:     [129, 140, 248, 240],  // indigo
};

// ─── Build the single canvas PNG ─────────────────────────────────────────────
function buildCanvas(cells, greenClusterCells, cascadeRiskCells, drainageCells, fireBufferCells, highlightKey) {
  if (!cells || cells.length === 0) return null;

  // Grid extents
  let minGX = Infinity, maxGX = -Infinity;
  let minGY = Infinity, maxGY = -Infinity;
  cells.forEach(c => {
    if (c.gridX < minGX) minGX = c.gridX;
    if (c.gridX > maxGX) maxGX = c.gridX;
    if (c.gridY < minGY) minGY = c.gridY;
    if (c.gridY > maxGY) maxGY = c.gridY;
  });

  const cols = maxGX - minGX + 1;
  const rows = maxGY - minGY + 1;
  const W = cols * PX;
  const H = rows * PX;

  const canvas = document.createElement('canvas');
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  const imageData = ctx.createImageData(W, H);
  const data = imageData.data;

  // helper: fill a cell block with [r,g,b,a]
  const fillCell = (col, row, rgba) => {
    const [r, g, b, a] = rgba;
    const baseX = col * PX;
    const baseY = row * PX;
    for (let py = 0; py < PX; py++) {
      for (let px = 0; px < PX; px++) {
        const idx = ((baseY + py) * W + (baseX + px)) * 4;
        // alpha-blend over existing
        const srcA = a / 255;
        const dstA = data[idx + 3] / 255;
        const outA = srcA + dstA * (1 - srcA);
        if (outA > 0) {
          data[idx]     = Math.round((r * srcA + data[idx]     * dstA * (1 - srcA)) / outA);
          data[idx + 1] = Math.round((g * srcA + data[idx + 1] * dstA * (1 - srcA)) / outA);
          data[idx + 2] = Math.round((b * srcA + data[idx + 2] * dstA * (1 - srcA)) / outA);
          data[idx + 3] = Math.round(outA * 255);
        }
      }
    }
  };

  // helper: draw diagonal hatch lines across a cell block (cheap hatching)
  const hatchCell = (col, row, lineColor, bgColor) => {
    const [br, bg, bb, ba] = bgColor;
    const [hr, hg, hb] = lineColor;
    const baseX = col * PX;
    const baseY = row * PX;
    for (let py = 0; py < PX; py++) {
      for (let px = 0; px < PX; px++) {
        const idx = ((baseY + py) * W + (baseX + px)) * 4;
        // diagonal line when px+py is even
        const isHatch = ((px + py) % 2 === 0);
        const [r, g, b, a] = isHatch ? [hr, hg, hb, 220] : [br, bg, bb, ba];
        const srcA = a / 255;
        const dstA = data[idx + 3] / 255;
        const outA = srcA + dstA * (1 - srcA);
        if (outA > 0) {
          data[idx]     = Math.round((r * srcA + data[idx]     * dstA * (1 - srcA)) / outA);
          data[idx + 1] = Math.round((g * srcA + data[idx + 1] * dstA * (1 - srcA)) / outA);
          data[idx + 2] = Math.round((b * srcA + data[idx + 2] * dstA * (1 - srcA)) / outA);
          data[idx + 3] = Math.round(outA * 255);
        }
      }
    }
  };

  // Layer 1 – fire buffer (bottom, subtlest)
  cells.forEach(cell => {
    const key = `${cell.gridX},${cell.gridY}`;
    if (!fireBufferCells.has(key)) return;
    const col = cell.gridX - minGX;
    const row = maxGY - cell.gridY;
    fillCell(col, row, ZONE_COLORS.FIRE_FILL);
  });

  // Layer 2 – drainage channels (hatched blue)
  cells.forEach(cell => {
    const key = `${cell.gridX},${cell.gridY}`;
    if (!drainageCells.has(key)) return;
    const col = cell.gridX - minGX;
    const row = maxGY - cell.gridY;
    hatchCell(col, row, ZONE_COLORS.DRAINAGE_HATCH, ZONE_COLORS.DRAINAGE_FILL);
  });

  // Layer 3 – cascade risk (fill + edge border)
  // First pass: fill interiors
  cells.forEach(cell => {
    const key = `${cell.gridX},${cell.gridY}`;
    if (!cascadeRiskCells.has(key)) return;
    const col = cell.gridX - minGX;
    const row = maxGY - cell.gridY;
    fillCell(col, row, ZONE_COLORS.CASCADE_FILL);
  });
  // Second pass: darker border on edge cells (any neighbour NOT in cascadeSet)
  cells.forEach(cell => {
    const key = `${cell.gridX},${cell.gridY}`;
    if (!cascadeRiskCells.has(key)) return;
    const isEdge = (
      !cascadeRiskCells.has(`${cell.gridX},${cell.gridY + 1}`) ||
      !cascadeRiskCells.has(`${cell.gridX},${cell.gridY - 1}`) ||
      !cascadeRiskCells.has(`${cell.gridX + 1},${cell.gridY}`) ||
      !cascadeRiskCells.has(`${cell.gridX - 1},${cell.gridY}`)
    );
    if (!isEdge) return;
    const col = cell.gridX - minGX;
    const row = maxGY - cell.gridY;
    // draw a 1px dark border around the PX block
    const baseX = col * PX;
    const baseY = row * PX;
    const [er, eg, eb, ea] = ZONE_COLORS.CASCADE_EDGE;
    for (let p = 0; p < PX; p++) {
      // top row of cell block
      let idx = (baseY * W + (baseX + p)) * 4;
      data[idx] = er; data[idx+1] = eg; data[idx+2] = eb; data[idx+3] = ea;
      // bottom row
      idx = ((baseY + PX - 1) * W + (baseX + p)) * 4;
      data[idx] = er; data[idx+1] = eg; data[idx+2] = eb; data[idx+3] = ea;
      // left col
      idx = ((baseY + p) * W + baseX) * 4;
      data[idx] = er; data[idx+1] = eg; data[idx+2] = eb; data[idx+3] = ea;
      // right col
      idx = ((baseY + p) * W + (baseX + PX - 1)) * 4;
      data[idx] = er; data[idx+1] = eg; data[idx+2] = eb; data[idx+3] = ea;
    }
  });

  // Layer 4 – green priority clusters (top)
  cells.forEach(cell => {
    const key = `${cell.gridX},${cell.gridY}`;
    const useType = greenClusterCells[key];
    if (!useType) return;
    const col = cell.gridX - minGX;
    const row = maxGY - cell.gridY;
    fillCell(col, row, ZONE_COLORS[useType] || ZONE_COLORS.AGRICULTURE);
  });

  // Layer 5 – highlight (selected reco cell, topmost)
  if (highlightKey) {
    const [hx, hy] = highlightKey.split(',').map(Number);
    if (hx >= minGX && hx <= maxGX && hy >= minGY && hy <= maxGY) {
      fillCell(hx - minGX, maxGY - hy, ZONE_COLORS.HIGHLIGHT);
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return { dataUrl: canvas.toDataURL('image/png'), minGX, maxGX, minGY, maxGY };
}

// ─── Re-center helper ─────────────────────────────────────────────────────────
function ChangeView({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, zoom, { animate: true, duration: 1.0 });
  }, [center, zoom, map]);
  return null;
}

// ─── Click-to-inspect ─────────────────────────────────────────────────────────
function GridClickHandler({ cellMap, originLat, originLon, resolution, onCellClick }) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      const gridX = Math.floor(
        (lng - originLon) * 111320 * Math.cos(originLat * Math.PI / 180) / resolution
      );
      const gridY = Math.floor((lat - originLat) * 111320 / resolution);
      const cell = cellMap.get(`${gridX},${gridY}`);
      if (cell) onCellClick({ cell, latlng: e.latlng });
    },
  });
  return null;
}

// ─── Main component ───────────────────────────────────────────────────────────
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
  selectedRecoText,
}) {
  const [mapCenter, setMapCenter] = useState([originLat, originLon]);
  const [mapZoom,   setMapZoom]   = useState(15);
  const [clickedCell, setClickedCell] = useState(null);

  // Parse highlighted cell key from selectedRecoText
  const highlightKey = useMemo(() => {
    if (!selectedRecoText) return null;
    const m = selectedRecoText.match(/\b(?:at|Cell)\b\s*\(([\d.]+),\s*([\d.]+)\)/);
    if (m) return `${Math.round(parseFloat(m[1]))},${Math.round(parseFloat(m[2]))}`;
    return null;
  }, [selectedRecoText]);

  // Fast cell lookup map
  const cellMap = useMemo(() => {
    const m = new Map();
    if (cells) cells.forEach(c => m.set(`${c.gridX},${c.gridY}`, c));
    return m;
  }, [cells]);

  // Fly to highlight when reco selected
  useEffect(() => {
    if (highlightCoordinate) {
      setMapCenter(highlightCoordinate);
      setMapZoom(17);
    }
  }, [highlightCoordinate]);

  // ── Canvas raster (memoized) ───────────────────────────────────────────────
  const canvasResult = useMemo(
    () => buildCanvas(cells, greenClusterCells, cascadeRiskCells, drainageCells, fireBufferCells, highlightKey),
    [cells, greenClusterCells, cascadeRiskCells, drainageCells, fireBufferCells, highlightKey]
  );

  // Geographic bounds of the overlay
  const overlayBounds = useMemo(() => {
    if (!canvasResult) return null;
    const { minGX, maxGX, minGY, maxGY } = canvasResult;
    const [s, w] = gridCellToLatLon(minGX,     minGY,     resolution, originLat, originLon);
    const [n, e] = gridCellToLatLon(maxGX + 1, maxGY + 1, resolution, originLat, originLon);
    return [[s, w], [n, e]];
  }, [canvasResult, resolution, originLat, originLon]);

  const handleCellClick = useCallback(({ cell, latlng }) => {
    setClickedCell({ cell, latlng });
  }, []);

  return (
    <div className="w-full h-full relative" style={{ background: '#0a0f1e' }}>
      <MapContainer
        center={[originLat, originLon]}
        zoom={15}
        preferCanvas={true}
        style={{ width: '100%', height: '100%', background: '#0a0f1e' }}
      >
        <ChangeView center={mapCenter} zoom={mapZoom} />
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

        {/* ── Single canvas raster overlay ── */}
        {canvasResult && overlayBounds && (
          <ImageOverlay
            url={canvasResult.dataUrl}
            bounds={overlayBounds}
            opacity={0.82}
            zIndex={400}
          />
        )}

        {/* ── Click popup ── */}
        {clickedCell && (
          <Popup
            position={clickedCell.latlng}
            onClose={() => setClickedCell(null)}
          >
            <div className="text-slate-900 text-xs font-medium leading-relaxed min-w-[170px]">
              <div className="font-bold text-sm mb-1">
                Cell ({clickedCell.cell.gridX}, {clickedCell.cell.gridY})
              </div>
              <div>Best Use: <span className="font-semibold">{clickedCell.cell.bestUse}</span></div>
              <div>Risk: {clickedCell.cell.riskLevel}</div>
              <div>Slope: {clickedCell.cell.maxSlope?.toFixed(1)}°</div>
              <div>Flow Acc.: {clickedCell.cell.flowAccumulation}</div>
              <div>Avg Height: {clickedCell.cell.avgHeight?.toFixed(1)} m</div>
              {clickedCell.cell.cascadeRisk && (
                <div className="mt-1 text-red-600 font-bold">⚠ Cascade Risk</div>
              )}
            </div>
          </Popup>
        )}
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-6 right-6 z-[1000] bg-[#0f172a]/95 backdrop-blur-md p-4 rounded-xl border border-slate-700 shadow-2xl pointer-events-auto">
        <h3 className="text-xs font-bold text-slate-200 mb-3 uppercase tracking-wider">Action Plan Overlay</h3>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-sm" style={{ background: 'rgba(34,197,94,0.86)' }} />
            <span className="text-xs text-slate-300 font-semibold">Priority Development Site</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-sm border-2" style={{ background: 'rgba(220,38,38,0.63)', borderColor: '#7f1d1d' }} />
            <span className="text-xs text-slate-300 font-semibold">Cascade Risk Flow Path</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-sm" style={{
              background: 'repeating-linear-gradient(45deg, rgba(29,78,216,1) 0px, rgba(29,78,216,1) 1px, rgba(59,130,246,0.7) 1px, rgba(59,130,246,0.7) 3px)'
            }} />
            <span className="text-xs text-slate-300 font-semibold">Drainage Channel</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-sm" style={{ background: 'rgba(249,115,22,0.67)' }} />
            <span className="text-xs text-slate-300 font-semibold">Fire Break Buffer Zone</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-sm" style={{ background: 'rgba(129,140,248,0.94)' }} />
            <span className="text-xs text-slate-300 font-semibold">Selected Recommendation</span>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-slate-700 text-[10px] text-slate-500">
          🖱 Click any zone to inspect
        </div>
      </div>
    </div>
  );
}
