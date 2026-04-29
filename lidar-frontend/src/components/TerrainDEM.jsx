import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

// ── Risk‑level color palette (bar chart mode) ──
const RISK_COLORS = {
  NORMAL: '#22c55e',
  FIRE_RISK: '#ef4444',
  LANDSLIDE_RISK: '#f97316',
  URBAN_ZONE: '#3b82f6',
};

function riskColor(level) {
  return RISK_COLORS[level] || '#e5e7eb';
}

// ── Elevation‑based color gradient (smooth terrain mode) ──
const ELEVATION_STOPS = [
  '#1a6b3c', // 0.0  deep green
  '#2d9e5f', // 0.2
  '#8db84a', // 0.4
  '#f0e528', // 0.6  yellow
  '#e07b20', // 0.8  orange
  '#8b1a1a', // 1.0  dark red
];

function getElevationColor(t) {
  const color = new THREE.Color();
  if (t < 0.2) color.lerpColors(
    new THREE.Color('#1a6b3c'), new THREE.Color('#2d9e5f'), t/0.2)
  else if (t < 0.4) color.lerpColors(
    new THREE.Color('#2d9e5f'), new THREE.Color('#8db84a'), (t-0.2)/0.2)
  else if (t < 0.6) color.lerpColors(
    new THREE.Color('#8db84a'), new THREE.Color('#f0e528'), (t-0.4)/0.2)
  else if (t < 0.8) color.lerpColors(
    new THREE.Color('#f0e528'), new THREE.Color('#e07b20'), (t-0.6)/0.2)
  else color.lerpColors(
    new THREE.Color('#e07b20'), new THREE.Color('#8b1a1a'), (t-0.8)/0.2)
  return color;
}

// ════════════════════════════════════════════
//  Bar‑Chart Mode — instanced for performance
// ════════════════════════════════════════════

function BarChartScene({ cells, centerX, centerY, onHover, onUnhover }) {
  const meshRef = useRef();
  const tempObj = useMemo(() => new THREE.Object3D(), []);
  const colorArray = useMemo(() => new Float32Array(cells.length * 3), [cells.length]);

  // Pointer events per‑instance
  const handlePointer = useCallback(
    (e) => {
      e.stopPropagation();
      const idx = e.instanceId;
      if (idx != null && idx < cells.length) {
        onHover(cells[idx], e);
      }
    },
    [cells, onHover]
  );

  return (
    <instancedMesh
      ref={(ref) => {
        meshRef.current = ref;
        if (!ref) return;
        const col = new THREE.Color();
        cells.forEach((cell, i) => {
          const h = Math.max(cell.canopyHeight * 0.1, 0.1);
          tempObj.position.set(cell.gridX - centerX, h / 2, cell.gridY - centerY);
          tempObj.scale.set(0.9, h, 0.9);
          tempObj.updateMatrix();
          ref.setMatrixAt(i, tempObj.matrix);
          col.set(riskColor(cell.riskLevel));
          colorArray[i * 3] = col.r;
          colorArray[i * 3 + 1] = col.g;
          colorArray[i * 3 + 2] = col.b;
        });
        ref.instanceMatrix.needsUpdate = true;
        ref.geometry.setAttribute(
          'color',
          new THREE.InstancedBufferAttribute(colorArray, 3)
        );
      }}
      args={[undefined, undefined, cells.length]}
      onPointerMove={handlePointer}
      onPointerOut={(e) => {
        e.stopPropagation();
        onUnhover();
      }}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial vertexColors toneMapped={false} />
    </instancedMesh>
  );
}

// ════════════════════════════════════════════
//  Smooth Terrain Mode — elevation‑colored mesh
// ════════════════════════════════════════════

function SmoothTerrainScene({ cells }) {
  const geometry = useMemo(() => {
    let minGridX = Infinity, maxGridX = -Infinity;
    let minGridY = Infinity, maxGridY = -Infinity;
    
    cells.forEach(c => {
      if (c.gridX < minGridX) minGridX = c.gridX;
      if (c.gridX > maxGridX) maxGridX = c.gridX;
      if (c.gridY < minGridY) minGridY = c.gridY;
      if (c.gridY > maxGridY) maxGridY = c.gridY;
    });

    const gridCols = maxGridX - minGridX + 1;
    const gridRows = maxGridY - minGridY + 1;

    const map = new Map();
    let globalMinHeight = Infinity, globalMaxHeight = -Infinity;
    
    cells.forEach(c => {
      const h = c.avgHeight;
      map.set(`${c.gridX},${c.gridY}`, { avgHeight: h, riskLevel: c.riskLevel });
      if (h < globalMinHeight) globalMinHeight = h;
      if (h > globalMaxHeight) globalMaxHeight = h;
    });

    if (globalMinHeight === Infinity) { globalMinHeight = 0; globalMaxHeight = 1; }
    if (globalMaxHeight === globalMinHeight) globalMaxHeight += 1;

    const positions = [];
    const colors = [];
    const indices = [];

    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        const x = col - gridCols / 2;
        const z = row - gridRows / 2;
        
        const key = `${minGridX + col},${minGridY + row}`;
        const cellData = map.get(key);
        const height = cellData ? cellData.avgHeight : globalMinHeight;
        
        const y = (height - globalMinHeight) * 0.05;
        positions.push(x, y, z);
        
        const t = (height - globalMinHeight) / (globalMaxHeight - globalMinHeight);
        const color = getElevationColor(t);
        colors.push(color.r, color.g, color.b);
      }
    }

    for (let row = 0; row < gridRows - 1; row++) {
      for (let col = 0; col < gridCols - 1; col++) {
        const topLeft = row * gridCols + col;
        const topRight = row * gridCols + (col + 1);
        const bottomLeft = (row + 1) * gridCols + col;
        const bottomRight = (row + 1) * gridCols + (col + 1);
        
        indices.push(topLeft, bottomLeft, topRight);
        indices.push(topRight, bottomLeft, bottomRight);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    return geo;
  }, [cells]);

  return (
    <mesh geometry={geometry}>
      <meshLambertMaterial vertexColors side={THREE.DoubleSide} />
    </mesh>
  );
}

// ════════════════════════════════════════════
//  Scene wrapper (lights, controls, ground)
// ════════════════════════════════════════════

function SceneContent({ cells, mode, onHover, onUnhover }) {
  const { camera } = useThree();

  const bounds = useMemo(() => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const c of cells) {
      if (c.gridX < minX) minX = c.gridX;
      if (c.gridX > maxX) maxX = c.gridX;
      if (c.gridY < minY) minY = c.gridY;
      if (c.gridY > maxY) maxY = c.gridY;
    }
    return { minX, maxX, minY, maxY };
  }, [cells]);

  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  useEffect(() => {
    if (mode === 'terrain') {
      const gridCols = bounds.maxX - bounds.minX + 1;
      const gridRows = bounds.maxY - bounds.minY + 1;
      camera.position.set(gridCols / 2, gridRows * 0.8, gridRows * 1.2);
    } else {
      camera.position.set(0, 30, 50);
    }
    camera.lookAt(0, 0, 0);
  }, [mode, bounds, camera]);

  return (
    <>
      {mode === 'terrain' ? (
        <>
          <ambientLight intensity={0.5} />
          <directionalLight position={[20, 50, 20]} intensity={1.5} />
        </>
      ) : (
        <>
          <ambientLight intensity={0.4} />
          <directionalLight position={[50, 100, 50]} intensity={1.2} castShadow />
          <directionalLight position={[-20, 30, -10]} intensity={0.4} />
        </>
      )}

      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        minDistance={5}
        maxDistance={200}
      />

      {/* Subtle ground grid */}
      <gridHelper args={[200, 200, '#1e293b', '#1e293b']} position={[0, -0.01, 0]} />

      {mode === 'bar' ? (
        <BarChartScene
          cells={cells}
          centerX={centerX}
          centerY={centerY}
          onHover={onHover}
          onUnhover={onUnhover}
        />
      ) : (
        <SmoothTerrainScene cells={cells} />
      )}
    </>
  );
}

// ════════════════════════════════════════════
//  Legend components
// ════════════════════════════════════════════

function RiskLegend() {
  return (
    <div className="flex flex-wrap gap-4 items-center justify-center">
      {Object.entries(RISK_COLORS).map(([key, color]) => (
        <div key={key} className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded-sm" style={{ backgroundColor: color }} />
          <span className="text-sm text-slate-300 font-medium">
            {key
              .replace(/_/g, ' ')
              .replace(/\b\w/g, (c) => c.toUpperCase())}
          </span>
        </div>
      ))}
    </div>
  );
}

function ElevationLegend() {
  const gradient = ELEVATION_STOPS.join(', ');
  return (
    <div className="flex flex-col items-center gap-1 w-full max-w-md mx-auto">
      <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Elevation</span>
      <div
        className="w-full h-4 rounded-sm"
        style={{ background: `linear-gradient(to right, ${gradient})` }}
      />
      <div className="flex justify-between w-full">
        <span className="text-xs text-slate-400">Low</span>
        <span className="text-xs text-slate-400">High</span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════
//  Main component
// ════════════════════════════════════════════

export default function TerrainDEM({ cells, filteredCells }) {
  const activeCells = filteredCells !== null ? filteredCells : cells;

  const [mode, setMode] = useState('bar');
  const [tooltip, setTooltip] = useState(null);
  const containerRef = useRef(null);

  const handleHover = useCallback((cell, e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setTooltip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      data: cell,
    });
  }, []);

  const handleUnhover = useCallback(() => setTooltip(null), []);

  // ── Empty state ──
  if (!activeCells || activeCells.length === 0) {
    return (
      <div
        className="w-full rounded-lg flex items-center justify-center"
        style={{ height: 500, background: '#0f172a' }}
      >
        <p className="text-slate-400 text-lg">Process a file to see 3D terrain</p>
      </div>
    );
  }

  return (
    <div className="w-full rounded-lg overflow-hidden" style={{ background: '#0f172a' }}>
      {/* ── Controls row ── */}
      <div className="flex items-center justify-between px-4 py-3 flex-wrap gap-3">
        {/* Mode toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setMode('bar')}
            className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
              mode === 'bar'
                ? 'bg-blue-600 text-white'
                : 'border border-slate-500 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Bar Chart
          </button>
          <button
            onClick={() => setMode('terrain')}
            className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
              mode === 'terrain'
                ? 'bg-blue-600 text-white'
                : 'border border-slate-500 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Smooth Terrain
          </button>
        </div>

        {/* Height scale info */}
        <span className="text-xs text-slate-400 font-medium">Height scale: 1 unit = 10m</span>
      </div>

      {/* ── 3D Canvas ── */}
      <div ref={containerRef} className="relative">
        <Canvas
          camera={{ position: [0, 30, 50], fov: 60 }}
          style={{ width: '100%', height: '500px', background: '#0f172a' }}
        >
          <SceneContent
            cells={activeCells}
            mode={mode}
            onHover={handleHover}
            onUnhover={handleUnhover}
          />
        </Canvas>

        {/* ── Tooltip overlay (bar mode only) ── */}
        {tooltip && mode === 'bar' && (
          <div
            className="absolute bg-slate-800 border border-slate-600 shadow-xl rounded-md p-3 text-sm z-50 pointer-events-none"
            style={{ top: tooltip.y + 14, left: tooltip.x + 14, minWidth: 180 }}
          >
            <div className="font-bold text-white border-b border-slate-600 pb-1 mb-1">
              Cell ({tooltip.data.gridX}, {tooltip.data.gridY})
            </div>
            <div className="text-slate-300">
              <span className="font-semibold text-slate-100">Risk:</span> {tooltip.data.riskLevel}
            </div>
            <div className="text-slate-300">
              <span className="font-semibold text-slate-100">Type:</span> {tooltip.data.dominantType}
            </div>
            <div className="text-slate-300">
              <span className="font-semibold text-slate-100">Canopy:</span> {tooltip.data.canopyHeight.toFixed(2)} m
            </div>
            <div className="text-slate-300">
              <span className="font-semibold text-slate-100">Points:</span> {tooltip.data.pointDensity}
            </div>
          </div>
        )}
      </div>

      {/* ── Legend ── */}
      <div className="px-4 py-3 border-t border-slate-700">
        {mode === 'bar' ? <RiskLegend /> : <ElevationLegend />}
      </div>
    </div>
  );
}
