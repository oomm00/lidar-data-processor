import { useState, useEffect } from 'react';
import axios from 'axios';
import UploadForm from './components/UploadForm';
import SummaryPanel from './components/SummaryPanel';
import FilterControls from './components/FilterControls';
import TerrainDEM from './components/TerrainDEM';

export default function App() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cells, setCells] = useState(null);
  const [filteredCells, setFilteredCells] = useState(null);

  useEffect(() => {
    setFilteredCells(null);
    if (!result) {
      setCells(null);
      return;
    }

    const fetchGridData = async () => {
      try {
        const response = await axios.get('http://localhost:8080/api/result', {
          responseType: 'text',
        });

        const lines = response.data.trim().split(/\r?\n/);
        if (lines.length <= 1) {
          setCells([]);
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

        setCells(parsedCells);
      } catch (err) {
        console.error('Failed to fetch map data:', err);
        setError('Failed to load map data from server.');
      }
    };

    fetchGridData();
  }, [result]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      
      {/* Top Navbar */}
      <nav className="bg-indigo-600 text-white shadow-md w-full sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center">
          <svg className="w-8 h-8 mr-3 text-indigo-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <h1 className="text-xl font-bold tracking-tight">Lidar Terrain Analyzer</h1>
        </div>
      </nav>

      {/* Loading Progress Bar */}
      {loading && (
        <div className="w-full h-1 bg-indigo-100 overflow-hidden">
          <div className="h-full bg-indigo-500 animate-pulse transition-all duration-300 w-full"></div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        
        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md shadow-sm flex items-start justify-between">
            <div className="flex">
              <svg className="h-5 w-5 text-red-500 mr-3 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-red-800">Processing Error</h3>
                <div className="mt-1 text-sm text-red-700">{error}</div>
              </div>
            </div>
            <button 
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 rounded p-1"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}

        {/* Section 1: Upload */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold mb-4 text-slate-800 border-b pb-2 flex items-center">
            <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center text-sm mr-2 font-bold">1</span>
            Upload Point Cloud
          </h2>
          <UploadForm 
            onResult={setResult} 
            setLoading={setLoading} 
            setError={setError} 
            isLoading={loading}
          />
        </section>

        {/* Section 2: Map Controls */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold mb-4 text-slate-800 border-b pb-2 flex items-center">
            <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center text-sm mr-2 font-bold">2</span>
            Map Controls
          </h2>
          <FilterControls cells={cells} onFilterChange={setFilteredCells} />
        </section>

        {/* Section 3: Analysis Results (Summary only) */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold mb-6 text-slate-800 border-b pb-2 flex items-center">
            <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center text-sm mr-2 font-bold">3</span>
            Analysis Results
          </h2>
          <SummaryPanel result={result} />
        </section>

        {/* Section 4: 3D Terrain View */}
        {cells && (
          <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold mb-4 text-slate-800 border-b pb-2 flex items-center">
              <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center text-sm mr-2 font-bold">4</span>
              3D Terrain View (DEM)
            </h2>
            <TerrainDEM cells={cells} filteredCells={filteredCells} />
          </section>
        )}

      </main>

    </div>
  );
}
