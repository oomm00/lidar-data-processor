import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8080/api';

const RISK_COLORS = {
  NORMAL: '#22c55e',
  FIRE_RISK: '#ef4444',
  LANDSLIDE_RISK: '#f97316',
  URBAN_ZONE: '#3b82f6',
};

const TYPE_COLORS = {
  Ground: '#ca8a04',
  Vegetation: '#16a34a',
  Building: '#6b7280',
  Rock: '#78350f',
  Unknown: '#e5e7eb',
};

const DEFAULT_CELL_SIZE = 20;
const MIN_CELL_SIZE = 8;
const MAX_CELL_SIZE = 60;
const GAP = 1;
const LABEL_MARGIN = 30;
const MIN_CANVAS = 400;

export default function HeatmapGrid({ result }) {
  const [gridCells, setGridCells] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('risk');
  const [cellSize, setCellSize] = useState(DEFAULT_CELL_SIZE);
  const [tooltip, setTooltip] = useState(null);

  const canvasRef = useRef(null);

  // Fetch data when result changes
  useEffect(() => {
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

        const lines = response.data.trim().split(/\r?\n/);
        if (lines.length <= 1) {
          setGridCells([]);
          return;
        }

        const parsedCells = lines
          .slice(1)
          .map((line) => {
            const p = line.split(',');
            if (p.length < 15) return null;
            return {
              gridX: parseInt(p[0], 10),
              gridY: parseInt(p[1], 10),
              minHeight: parseFloat(p[2]),
              maxHeight: parseFloat(p[3]),
              canopyHeight: parseFloat(p[4]),
              avgHeight: parseFloat(p[5]),
              pointDensity: parseInt(p[6], 10),
              groundPoints: parseInt(p[7], 10),
              vegetationPoints: parseInt(p[8], 10),
              buildingPoints: parseInt(p[9], 10),
              rockPoints: parseInt(p[10], 10),
              dominantType: p[11],
              vegetationPercent: parseFloat(p[12]),
              builtPercent: parseFloat(p[13]),
              riskLevel: p[14],
            };
          })
          .filter(Boolean);

        setGridCells(parsedCells);
      } catch (err) {
        console.error('Failed to fetch map data:', err);
        setError('Failed to load map data from server.');
      } finally {
        setLoading(false);
      }
    };

    fetchGridData();
  }, [result]);

  // Precompute bounds and cell lookup
  const { minX, maxX, minY, maxY, cols, rows, cellMap } = useMemo(() => {
    if (gridCells.length === 0) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0, cols: 0, rows: 0, cellMap: new Map() };
    }
    let mnX = Infinity, mxX = -Infinity, mnY = Infinity, mxY = -Infinity;
    const map = new Map();
    for (const c of gridCells) {
      if (c.gridX < mnX) mnX = c.gridX;
      if (c.gridX > mxX) mxX = c.gridX;
      if (c.gridY < mnY) mnY = c.gridY;
      if (c.gridY > mxY) mxY = c.gridY;
      map.set(`${c.gridX},${c.gridY}`, c);
    }
    return {
      minX: mnX,
      maxX: mxX,
      minY: mnY,
      maxY: mxY,
      cols: mxX - mnX + 1,
      rows: mxY - mnY + 1,
      cellMap: map,
    };
  }, [gridCells]);

  const step = cellSize + GAP;

  const canvasWidth = useMemo(() => {
    if (cols === 0) return MIN_CANVAS;
    return Math.max(MIN_CANVAS, cols * step + LABEL_MARGIN);
  }, [cols, step]);

  const canvasHeight = useMemo(() => {
    if (rows === 0) return MIN_CANVAS;
    return Math.max(MIN_CANVAS, rows * step + LABEL_MARGIN);
  }, [rows, step]);

  // Draw the canvas
  useEffect(() => {
    if (!canvasRef.current || gridCells.length === 0 || loading) return;

    const canvas = canvasRef.current;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d');

    // 1. Background fill
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // 2. Subtle grid lines
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 0.5;
    for (let gx = 0; gx <= cols; gx++) {
      const x = LABEL_MARGIN + gx * step;
      ctx.beginPath();
      ctx.moveTo(x, LABEL_MARGIN);
      ctx.lineTo(x, LABEL_MARGIN + rows * step);
      ctx.stroke();
    }
    for (let gy = 0; gy <= rows; gy++) {
      const y = LABEL_MARGIN + gy * step;
      ctx.beginPath();
      ctx.moveTo(LABEL_MARGIN, y);
      ctx.lineTo(LABEL_MARGIN + cols * step, y);
      ctx.stroke();
    }

    // 3. Coordinate labels
    ctx.fillStyle = '#64748b';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    for (let gx = 0; gx < cols; gx += 5) {
      const x = LABEL_MARGIN + gx * step + cellSize / 2;
      ctx.fillText(String(minX + gx), x, LABEL_MARGIN - 3);
    }
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let gy = 0; gy < rows; gy += 5) {
      const y = LABEL_MARGIN + gy * step + cellSize / 2;
      ctx.fillText(String(minY + gy), LABEL_MARGIN - 4, y);
    }

    // 4. Draw data cells
    ctx.globalAlpha = 0.85;
    for (const cell of gridCells) {
      const px = LABEL_MARGIN + (cell.gridX - minX) * step;
      const py = LABEL_MARGIN + (cell.gridY - minY) * step;

      let color;
      if (viewMode === 'risk') {
        color = RISK_COLORS[cell.riskLevel] || '#e5e7eb';
      } else {
        color = TYPE_COLORS[cell.dominantType] || '#e5e7eb';
      }

      ctx.fillStyle = color;
      ctx.fillRect(px, py, cellSize, cellSize);

      // Thin dark border
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, cellSize - 1, cellSize - 1);
      ctx.globalAlpha = 0.85;
    }

    ctx.globalAlpha = 1;
  }, [gridCells, viewMode, cellSize, loading, canvasWidth, canvasHeight, cols, rows, minX, minY]);

  // Hover handler
  const handleMouseMove = useCallback(
    (e) => {
      if (gridCells.length === 0 || !canvasRef.current) {
        setTooltip(null);
        return;
      }
      const rect = canvasRef.current.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const gx = Math.floor((mx - LABEL_MARGIN) / step) + minX;
      const gy = Math.floor((my - LABEL_MARGIN) / step) + minY;

      const cell = cellMap.get(`${gx},${gy}`);
      if (cell) {
        setTooltip({ x: e.clientX, y: e.clientY, data: cell });
      } else {
        setTooltip(null);
      }
    },
    [gridCells, cellMap, step, minX, minY],
  );

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  // Zoom handlers
  const zoomIn = () => setCellSize((s) => Math.min(MAX_CELL_SIZE, s + 4));
  const zoomOut = () => setCellSize((s) => Math.max(MIN_CELL_SIZE, s - 4));

  // ─── Empty state ───
  if (!result) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-8 text-center text-slate-500">
        <p className="text-lg">Process a file to see the terrain map</p>
      </div>
    );
  }

  // ─── Render ───
  return (
    <div className="w-full flex flex-col items-center p-4 gap-4">
      {/* Controls row */}
      <div className="flex items-center gap-4 flex-wrap justify-center">
        {/* View toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('risk')}
            className={`px-4 py-2 rounded-md font-semibold text-sm transition-colors ${
              viewMode === 'risk'
                ? 'bg-slate-800 text-white'
                : 'border border-slate-300 text-slate-600 hover:bg-slate-100'
            }`}
          >
            Risk View
          </button>
          <button
            onClick={() => setViewMode('type')}
            className={`px-4 py-2 rounded-md font-semibold text-sm transition-colors ${
              viewMode === 'type'
                ? 'bg-slate-800 text-white'
                : 'border border-slate-300 text-slate-600 hover:bg-slate-100'
            }`}
          >
            Type View
          </button>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-2 border border-slate-300 rounded-md px-2 py-1">
          <button
            onClick={zoomOut}
            disabled={cellSize <= MIN_CELL_SIZE}
            className="w-7 h-7 flex items-center justify-center rounded text-lg font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            −
          </button>
          <span className="text-xs text-slate-500 w-12 text-center select-none">
            {cellSize}px
          </span>
          <button
            onClick={zoomIn}
            disabled={cellSize >= MAX_CELL_SIZE}
            className="w-7 h-7 flex items-center justify-center rounded text-lg font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            +
          </button>
        </div>
      </div>

      {/* Canvas container */}
      <div
        className="overflow-auto rounded-lg border border-slate-200 bg-white"
        style={{
          maxWidth: '100%',
          maxHeight: 620,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)',
        }}
      >
        {loading ? (
          <div
            className="flex items-center justify-center text-slate-500 text-lg"
            style={{ width: MIN_CANVAS, height: MIN_CANVAS }}
          >
            Loading terrain map...
          </div>
        ) : error ? (
          <div
            className="flex items-center justify-center"
            style={{ width: MIN_CANVAS, height: MIN_CANVAS }}
          >
            <div className="text-red-500 bg-red-50 p-4 rounded-md border text-center">
              <p className="font-semibold">{error}</p>
            </div>
          </div>
        ) : gridCells.length === 0 ? (
          <div
            className="flex items-center justify-center text-slate-500"
            style={{ width: MIN_CANVAS, height: MIN_CANVAS }}
          >
            No map data available.
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            className="cursor-crosshair block"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          />
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 items-center justify-center p-4 border border-slate-200 rounded-md shadow-sm w-full max-w-[800px] bg-slate-50">
        {viewMode === 'risk'
          ? Object.entries(RISK_COLORS).map(([key, color]) => (
              <div key={key} className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: color }} />
                <span className="text-sm font-medium">
                  {key
                    .replace(/_/g, ' ')
                    .replace(/\b\w/g, (c) => c.toUpperCase())}
                </span>
              </div>
            ))
          : Object.entries(TYPE_COLORS).map(([key, color]) => (
              <div key={key} className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: color }} />
                <span className="text-sm font-medium">{key}</span>
              </div>
            ))}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed bg-white border border-slate-300 shadow-lg rounded-md p-3 text-sm z-50 pointer-events-none"
          style={{ top: tooltip.y + 15, left: tooltip.x + 15 }}
        >
          <div className="font-bold border-b pb-1 mb-1">
            Cell: ({tooltip.data.gridX}, {tooltip.data.gridY})
          </div>
          <div>
            <span className="font-semibold text-slate-700">Risk Level:</span>{' '}
            {tooltip.data.riskLevel}
          </div>
          <div>
            <span className="font-semibold text-slate-700">Dominant Type:</span>{' '}
            {tooltip.data.dominantType}
          </div>
          <div>
            <span className="font-semibold text-slate-700">Canopy Height:</span>{' '}
            {tooltip.data.canopyHeight.toFixed(2)} m
          </div>
          <div>
            <span className="font-semibold text-slate-700">Vegetation:</span>{' '}
            {tooltip.data.vegetationPercent.toFixed(1)}%
          </div>
          <div>
            <span className="font-semibold text-slate-700">Points:</span>{' '}
            {tooltip.data.pointDensity}
          </div>
        </div>
      )}
    </div>
  );
}
