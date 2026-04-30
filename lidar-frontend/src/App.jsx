import { useState, useEffect } from 'react';
import axios from 'axios';
import SummaryPanel from './components/SummaryPanel';
import FilterControls from './components/FilterControls';
import TerrainDEM from './components/TerrainDEM';
import UploadForm from './components/UploadForm';
import LandingPage from './pages/LandingPage';

export default function App() {
  const [started, setStarted] = useState(false);
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

  if (!started) {
    return <LandingPage onStart={() => setStarted(true)} />;
  }

  const handleBackToHome = () => {
    setStarted(false);
    setResult(null);
    setCells(null);
    setFilteredCells(null);
    setError(null);
  };

  const handleUploadNew = () => {
    setResult(null);
    setCells(null);
    setFilteredCells(null);
    setError(null);
  };

  return (
    <div className="h-screen bg-[#0a0f1e] text-slate-100 font-sans flex flex-col overflow-hidden">
      
      {/* Top Navbar */}
      <nav className="bg-[#0f172a] border-b border-slate-800 text-white w-full shrink-0 h-16 z-50">
        <div className="w-full px-6 h-full flex items-center justify-between">
          <div className="flex items-center cursor-pointer group" onClick={handleBackToHome}>
            <svg className="w-8 h-8 mr-3 text-indigo-400 group-hover:text-indigo-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">Lidar Terrain Analyzer</h1>
          </div>
          <button 
            onClick={handleBackToHome}
            className="text-sm font-medium text-slate-300 hover:text-white transition-colors flex items-center bg-slate-800 px-3 py-1.5 rounded-md hover:bg-slate-700"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Back to Home
          </button>
        </div>
      </nav>

      {/* Loading Progress Bar */}
      {loading && (
        <div className="w-full h-1 bg-slate-800 overflow-hidden shrink-0">
          <div className="h-full bg-indigo-500 animate-pulse transition-all duration-300 w-full"></div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Error Banner */}
        {error && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[100] w-full max-w-2xl bg-red-900/90 border-l-4 border-red-500 p-4 rounded-md shadow-lg flex items-start justify-between backdrop-blur-sm">
            <div className="flex">
              <svg className="h-5 w-5 text-red-400 mr-3 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-red-100">Processing Error</h3>
                <div className="mt-1 text-sm text-red-200">{error}</div>
              </div>
            </div>
            <button 
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-200 focus:outline-none rounded p-1"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}

        {/* Sidebar */}
        <aside className="w-[420px] bg-[#0f172a] h-full overflow-y-auto border-r border-slate-800 p-6 flex flex-col gap-8 shrink-0 custom-scrollbar z-10">
          
          {/* Analysis Results */}
          <section>
            <h2 className="text-sm font-bold mb-4 text-indigo-400 uppercase tracking-wider flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
              Analysis Results
            </h2>
            <SummaryPanel result={result} />
          </section>

          {/* Map Filters */}
          <section>
            <h2 className="text-sm font-bold mb-4 text-indigo-400 uppercase tracking-wider flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/></svg>
              Map Filters
            </h2>
            <div className="filter-controls-dark">
              <FilterControls cells={cells} onFilterChange={setFilteredCells} />
            </div>
          </section>

          <div className="mt-auto pt-4">
            <button 
              onClick={handleUploadNew}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold shadow-lg border border-slate-600 transition-colors flex items-center justify-center"
            >
              <svg className="w-5 h-5 mr-2 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
              Upload New File
            </button>
          </div>
        </aside>

        {/* Main 3D View */}
        <main className="flex-1 bg-[#0a0f1e] relative flex flex-col min-w-[600px] h-full">
          {!cells ? (
            /* Upload Form — shown when no data is loaded */
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="w-full max-w-xl bg-[#0f172a] rounded-2xl shadow-2xl border border-slate-700 p-8">
                <h2 className="text-2xl font-semibold mb-6 text-white border-b border-slate-700 pb-4 flex items-center">
                  <span className="bg-indigo-500 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm mr-3 font-bold shadow-lg">1</span>
                  Upload Point Cloud
                </h2>
                <UploadForm
                  onResult={setResult}
                  setLoading={setLoading}
                  setError={setError}
                  isLoading={loading}
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 w-full h-full relative">
              <TerrainDEM
                cells={cells}
                filteredCells={filteredCells}
                hideControls={false}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

