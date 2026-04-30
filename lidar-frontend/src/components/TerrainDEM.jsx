import { useMemo, useRef, useCallback, useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

const HEIGHT_SCALE = 0.20;

// ── Classic rainbow DEM palette (blue low → red high, like the reference image) ──
const ELEV_RAMP = [
  new THREE.Color('#0a00aa'), // deep blue  (lowest)
  new THREE.Color('#0055ff'), // blue
  new THREE.Color('#00aaff'), // cyan
  new THREE.Color('#00e8aa'), // teal-green
  new THREE.Color('#88ff00'), // yellow-green
  new THREE.Color('#ffee00'), // yellow
  new THREE.Color('#ff8800'), // orange
  new THREE.Color('#ff2200'), // orange-red
  new THREE.Color('#cc0000'), // deep red   (highest)
];

function getElevationColor(t) {
  const clamped = Math.max(0, Math.min(1, t));
  const scaled  = clamped * (ELEV_RAMP.length - 1);
  const lo      = Math.floor(scaled);
  const hi      = Math.min(lo + 1, ELEV_RAMP.length - 1);
  const c       = new THREE.Color();
  c.lerpColors(ELEV_RAMP[lo], ELEV_RAMP[hi], scaled - lo);
  return c;
}

// Risk highlight colours (vivid, used when filter is active)
const RISK_HIGHLIGHT = {
  NORMAL:         new THREE.Color('#22c55e'),
  FIRE_RISK:      new THREE.Color('#ef4444'),
  LANDSLIDE_RISK: new THREE.Color('#f97316'),
  URBAN_ZONE:     new THREE.Color('#60a5fa'),
};
const DIM_COLOR  = new THREE.Color('#1e293b');
const ROAD_COLOR = new THREE.Color('#3b82f6'); // blue road ribbon

// ════════════════════════════════════════════════════════
//  Build shared grid data (used by both terrain and road)
// ════════════════════════════════════════════════════════
function buildGridData(allCells) {
  const gridXs = allCells.map(c => c.gridX);
  const gridYs = allCells.map(c => c.gridY);
  const minGX  = Math.min(...gridXs), maxGX = Math.max(...gridXs);
  const minGY  = Math.min(...gridYs), maxGY = Math.max(...gridYs);
  const cols   = maxGX - minGX + 1;
  const rows   = maxGY - minGY + 1;

  // Separate road (Building) cells from terrain cells
  const terrainCells = allCells.filter(c => c.dominantType !== 'Building');
  const roadCells    = allCells.filter(c => c.dominantType === 'Building');

  // Height + cell reference grids — only from terrain cells
  const heightGrid = Array(rows).fill(null).map(() => Array(cols).fill(null));
  const cellGrid   = Array(rows).fill(null).map(() => Array(cols).fill(null));
  const isRoad     = Array(rows).fill(null).map(() => Array(cols).fill(false));

  const allTerrainHeights = terrainCells.map(c => c.avgHeight);
  const globalMin = Math.min(...allTerrainHeights);
  const globalMax = Math.max(...allTerrainHeights);
  const globalMid = (globalMin + globalMax) / 2;

  terrainCells.forEach(c => {
    const col = c.gridX - minGX;
    const row = c.gridY - minGY;
    heightGrid[row][col] = c.avgHeight;
    cellGrid[row][col]   = c;
  });

  // Mark road positions
  roadCells.forEach(c => {
    const col = c.gridX - minGX;
    const row = c.gridY - minGY;
    isRoad[row][col] = true;
  });

  // Fill nulls (including road positions) with neighbour interpolation then mid
  const interpolate = (r, c) => {
    const neighbours = [
      r > 0      && heightGrid[r-1][c],
      r < rows-1 && heightGrid[r+1][c],
      c > 0      && heightGrid[r][c-1],
      c < cols-1 && heightGrid[r][c+1],
    ].filter(v => v !== null && v !== false);
    return neighbours.length > 0
      ? neighbours.reduce((a, b) => a + b, 0) / neighbours.length
      : globalMid;
  };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (heightGrid[r][c] === null) {
        heightGrid[r][c] = interpolate(r, c);
      }
    }
  }

  return { heightGrid, cellGrid, isRoad, roadCells, minGX, minGY, cols, rows, globalMin, globalMax };
}

// ════════════════════════════════════════════════════════
//  Smooth terrain mesh (excludes road cells, smooth surface)
// ════════════════════════════════════════════════════════
function SmoothTerrainMesh({ gridData, filteredCells }) {
  const { heightGrid, cellGrid, isRoad, cols, rows, globalMin, globalMax } = gridData;

  const geometry = useMemo(() => {
    const isFilterActive = filteredCells !== null;
    const filteredSet    = new Set();
    if (isFilterActive && filteredCells) {
      filteredCells.forEach(c => filteredSet.add(`${c.gridX},${c.gridY}`));
    }

    const positions = new Float32Array(rows * cols * 3);
    const colors    = new Float32Array(rows * cols * 3);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const idx = (row * cols + col) * 3;
        const h   = heightGrid[row][col];
        const y   = (h - globalMin) * HEIGHT_SCALE;

        positions[idx]   = col - cols / 2;
        positions[idx+1] = y;
        positions[idx+2] = row - rows / 2;

        const cell = cellGrid[row][col];
        const key  = cell ? `${cell.gridX},${cell.gridY}` : null;

        let color;
        if (isFilterActive) {
          if (key && filteredSet.has(key)) {
            color = RISK_HIGHLIGHT[cell.riskLevel] || RISK_HIGHLIGHT.NORMAL;
          } else {
            color = DIM_COLOR;
          }
        } else {
          const t = (h - globalMin) / (globalMax - globalMin || 1);
          color = getElevationColor(t);
        }

        colors[idx]   = color.r;
        colors[idx+1] = color.g;
        colors[idx+2] = color.b;
      }
    }

    const indices = [];
    for (let row = 0; row < rows - 1; row++) {
      for (let col = 0; col < cols - 1; col++) {
        const tl = row * cols + col;
        const tr = row * cols + col + 1;
        const bl = (row + 1) * cols + col;
        const br = (row + 1) * cols + col + 1;
        indices.push(tl, bl, tr);
        indices.push(tr, bl, br);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [gridData, filteredCells]);

  return (
    <mesh geometry={geometry}>
      <meshLambertMaterial vertexColors side={THREE.DoubleSide} />
    </mesh>
  );
}

// ════════════════════════════════════════════════════════
//  Road ribbon — flat quads sitting just ABOVE the terrain
// ════════════════════════════════════════════════════════
function RoadRibbon({ gridData }) {
  const { heightGrid, roadCells, minGX, minGY, cols, rows, globalMin } = gridData;

  const mesh = useMemo(() => {
    if (!roadCells || roadCells.length === 0) return null;

    const verts  = [];
    const idxArr = [];
    const clrs   = [];
    const LIFT   = 0.08; // raise road above terrain surface

    roadCells.forEach(cell => {
      const col  = cell.gridX - minGX;
      const row  = cell.gridY - minGY;
      const h    = heightGrid[row][col];
      const y    = (h - globalMin) * HEIGHT_SCALE + LIFT;
      const cx   = col - cols / 2;
      const cz   = row - rows / 2;
      const half = 0.45;

      const base = verts.length / 3;
      // 4 corners of a flat unit quad
      verts.push(cx - half, y, cz - half);
      verts.push(cx + half, y, cz - half);
      verts.push(cx + half, y, cz + half);
      verts.push(cx - half, y, cz + half);

      idxArr.push(base, base+1, base+2, base, base+2, base+3);
      for (let i = 0; i < 4; i++) {
        clrs.push(ROAD_COLOR.r, ROAD_COLOR.g, ROAD_COLOR.b);
      }
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(new Float32Array(clrs), 3));
    geo.setIndex(idxArr);
    geo.computeVertexNormals();
    return geo;
  }, [gridData]);

  if (!mesh) return null;

  return (
    <mesh geometry={mesh}>
      <meshLambertMaterial vertexColors side={THREE.DoubleSide} />
    </mesh>
  );
}

// ════════════════════════════════════════════════════════
//  Scene root
// ════════════════════════════════════════════════════════
function SceneContent({ allCells, filteredCells }) {
  const { camera } = useThree();

  const gridData = useMemo(() => buildGridData(allCells), [allCells]);

  useEffect(() => {
    const { cols, rows } = gridData;
    camera.position.set(cols * 0.4, rows * 1.0, rows * 1.5);
    camera.lookAt(0, 0, 0);
  }, [gridData, camera]);

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[40, 100, 40]}  intensity={1.8} />
      <directionalLight position={[-30, 60, -30]} intensity={0.4} />
      <hemisphereLight skyColor="#1e3a5f" groundColor="#0a0a1a" intensity={0.35} />
      <OrbitControls enablePan enableZoom enableRotate minDistance={3} maxDistance={500} />
      <gridHelper args={[400, 400, '#0d1b2a', '#0d1b2a']} position={[0, -0.05, 0]} />
      <SmoothTerrainMesh gridData={gridData} filteredCells={filteredCells} />
      <RoadRibbon gridData={gridData} />
    </>
  );
}

// ════════════════════════════════════════════════════════
//  Legend
// ════════════════════════════════════════════════════════
const ELEV_STOPS_CSS = [
  '#0a00aa','#0055ff','#00aaff','#00e8aa',
  '#88ff00','#ffee00','#ff8800','#ff2200','#cc0000',
];

function TerrainLegend({ filterActive }) {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2 items-center justify-center">
      {/* Elevation ramp */}
      <div className="flex items-center gap-2">
        <div className="relative w-28 h-3.5 rounded-sm overflow-hidden">
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(to right, ${ELEV_STOPS_CSS.join(', ')})` }}
          />
        </div>
        <span className="text-xs text-slate-300">Elevation (Low → High)</span>
      </div>

      <div className="w-px h-4 bg-slate-600" />

      {/* Road */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-2.5 rounded-sm bg-[#3b82f6]" />
        <span className="text-xs text-blue-300 font-semibold">Road</span>
      </div>

      {filterActive && (
        <>
          <div className="w-px h-4 bg-slate-600" />
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded-sm bg-[#f97316]" />
            <span className="text-xs text-orange-300 font-semibold">Highlighted (filtered)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded-sm bg-[#1e293b]" />
            <span className="text-xs text-slate-400">Outside filter (dimmed)</span>
          </div>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════
//  Main export
// ════════════════════════════════════════════════════════
export default function TerrainDEM({ cells, filteredCells, hideControls = false }) {
  const filterActive = filteredCells !== null;

  if (!cells || cells.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background: '#0a0f1e' }}>
        <p className="text-slate-400 text-lg">Process a file to see 3D terrain</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative" style={{ background: '#0a0f1e' }}>
      <div className="absolute inset-0">
        <Canvas
          camera={{ position: [0, 30, 50], fov: 55 }}
          style={{ width: '100%', height: '100%', background: '#0a0f1e' }}
        >
          <SceneContent allCells={cells} filteredCells={filteredCells} />
        </Canvas>
      </div>

      {!hideControls && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-slate-900/85 backdrop-blur-md rounded-xl border border-slate-700/50 px-5 py-3 pointer-events-none">
          <TerrainLegend filterActive={filterActive} />
        </div>
      )}
    </div>
  );
}
