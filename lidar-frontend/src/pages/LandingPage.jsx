import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function getElevationColor(t) {
  const color = new THREE.Color();
  if (t < 0.2) color.lerpColors(new THREE.Color('#1a6b3c'), new THREE.Color('#2d9e5f'), t/0.2);
  else if (t < 0.4) color.lerpColors(new THREE.Color('#2d9e5f'), new THREE.Color('#8db84a'), (t-0.2)/0.2);
  else if (t < 0.6) color.lerpColors(new THREE.Color('#8db84a'), new THREE.Color('#f0e528'), (t-0.4)/0.2);
  else if (t < 0.8) color.lerpColors(new THREE.Color('#f0e528'), new THREE.Color('#e07b20'), (t-0.6)/0.2);
  else color.lerpColors(new THREE.Color('#e07b20'), new THREE.Color('#8b1a1a'), (t-0.8)/0.2);
  return color;
}

function AnimatedTerrain() {
  const meshRef = useRef();

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(80, 80, 80, 80);
    const pos = geo.attributes.position;
    const colors = [];

    let minH = Infinity, maxH = -Infinity;
    const heights = [];

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const dist = Math.sqrt(x*x + y*y);
      const h = (Math.sin(x * 0.2) + Math.cos(y * 0.2)) * 4 + Math.sin(dist * 0.3) * 3;
      pos.setZ(i, h);
      heights.push(h);
      if (h < minH) minH = h;
      if (h > maxH) maxH = h;
    }

    for (let i = 0; i < pos.count; i++) {
      const h = heights[i];
      const t = (h - minH) / (maxH - minH || 1);
      const c = getElevationColor(t);
      colors.push(c.r, c.g, c.b);
    }

    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
    geo.computeVertexNormals();
    return geo;
  }, []);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.z = state.clock.elapsedTime * 0.05;
    }
  });

  return (
    <mesh ref={meshRef} geometry={geometry} rotation={[-Math.PI / 2.5, 0, 0]} position={[0, -10, -20]}>
      <meshLambertMaterial vertexColors side={THREE.DoubleSide} />
    </mesh>
  );
}

export default function LandingPage({ onStart }) {
  return (
    <div className="min-h-screen bg-[#0a0f1e] text-slate-100 font-sans flex flex-col relative overflow-hidden">
      
      {/* Background 3D DEM */}
      <div className="absolute inset-0 z-0 opacity-50 pointer-events-none">
        <Canvas camera={{ position: [0, 5, 20], fov: 60 }}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 20, 10]} intensity={1.5} />
          <AnimatedTerrain />
        </Canvas>
      </div>

      {/* Overlay gradient to ensure text readability */}
      <div className="absolute inset-0 z-0 bg-gradient-to-t from-[#0a0f1e] via-[#0a0f1e]/60 to-transparent pointer-events-none"></div>

      {/* Top Navbar */}
      <nav className="bg-[#0a0f1e]/80 backdrop-blur-md border-b border-slate-800 text-white w-full sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center">
          <svg className="w-8 h-8 mr-3 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">Lidar Terrain Analyzer</h1>
        </div>
      </nav>

      {/* Content */}
      <div className="flex-1 relative z-10 flex flex-col items-center justify-center p-8 text-center pointer-events-none">
        <div className="max-w-3xl space-y-8 animate-fade-in-up">
          <div className="inline-block p-4 rounded-full bg-slate-800/80 mb-4 ring-1 ring-slate-700 backdrop-blur-md">
            <svg className="w-16 h-16 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
            </svg>
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-white drop-shadow-lg">
            Discover the Depth of <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Terrain Data</span>
          </h1>
          <p className="text-xl text-slate-300 leading-relaxed max-w-2xl mx-auto drop-shadow-md">
            Upload your LiDAR point clouds and instantly generate high-fidelity 3D Digital Elevation Models (DEMs). Filter by risk levels, canopy height, and vegetation types to unlock critical insights for forestry, urban planning, and environmental analysis.
          </p>
          <div className="pt-8 pointer-events-auto">
            <button 
              onClick={onStart}
              className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-bold text-lg shadow-[0_0_20px_rgba(79,70,229,0.5)] hover:shadow-[0_0_30px_rgba(79,70,229,0.8)] transition-all transform hover:-translate-y-1"
            >
              Start Processing File
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
