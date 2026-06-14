import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import SummaryPanel from './components/SummaryPanel';
import FilterControls from './components/FilterControls';
import TerrainDEM from './components/TerrainDEM';
import UploadForm from './components/UploadForm';
import LandingPage from './pages/LandingPage';
import InsightsPanel from './components/InsightsPanel';
import LeafletMap from './components/LeafletMap';
import ActionPlanView from './components/ActionPlanView';
import ReportView from './components/ReportView';

// 12-location Uttarakhand cycle — each file processed uses the next location
const UTTARAKHAND_LOCATIONS = [
  { name: 'Kedarnath',       lat: 30.7346, lon: 79.0669 },
  { name: 'Badrinath',       lat: 30.7433, lon: 79.4938 },
  { name: 'Rishikesh',       lat: 30.0869, lon: 78.2676 },
  { name: 'Haridwar',        lat: 29.9457, lon: 78.1642 },
  { name: 'Mussoorie',       lat: 30.4598, lon: 78.0644 },
  { name: 'Nainital',        lat: 29.3919, lon: 79.4542 },
  { name: 'Auli',            lat: 30.5228, lon: 79.5660 },
  { name: 'Valley of Flowers', lat: 30.7280, lon: 79.6050 },
  { name: 'Chopta',          lat: 30.3982, lon: 79.2196 },
  { name: 'Lansdowne',       lat: 29.8370, lon: 78.6870 },
  { name: 'Chakrata',        lat: 30.7113, lon: 77.8690 },
  { name: 'Munsiyari',       lat: 30.0667, lon: 80.2333 },
];

export default function App() {
  const [started, setStarted] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cells, setCells] = useState(null);
  const [filteredCells, setFilteredCells] = useState(null);
  const [viewMode, setViewMode] = useState('report');
  const [resolution, setResolution] = useState(1.0);

  // Cycle index advances with every file processed
  const locationIndexRef = useRef(0);
  const [processedOrigin, setProcessedOrigin] = useState({
    lat: UTTARAKHAND_LOCATIONS[0].lat,
    lon: UTTARAKHAND_LOCATIONS[0].lon,
    resolution: 1.0,
    name: UTTARAKHAND_LOCATIONS[0].name,
  });
  const [highlightedReco, setHighlightedReco] = useState(null);

  useEffect(() => {
    setFilteredCells(null);
    if (!result) {
      setCells(null);
      return;
    }

    // Advance to next location in the 12-location cycle
    const loc = UTTARAKHAND_LOCATIONS[locationIndexRef.current % UTTARAKHAND_LOCATIONS.length];
    locationIndexRef.current += 1;
    setProcessedOrigin({ lat: loc.lat, lon: loc.lon, resolution, name: loc.name });

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
            if (p.length < 22) return null;
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
              maxSlope: parseFloat(p[15]),
              slopeDirection: p[16],
              constructionScore: parseFloat(p[17]),
              agricultureScore: parseFloat(p[18]),
              solarScore: parseFloat(p[19]),
              bestUse: (() => {
                const cScore = parseFloat(p[17]);
                const aScore = parseFloat(p[18]);
                const sScore = parseFloat(p[19]);
                const max = Math.max(cScore, aScore, sScore);
                if (max < 30.0) return 'UNSUITABLE';
                if (max === cScore) return 'CONSTRUCTION';
                if (max === aScore) return 'AGRICULTURE';
                return 'SOLAR';
              })(),
              flowAccumulation: parseInt(p[20], 10),
              cascadeRisk: p[21] === 'true',
            };
          })
          .filter(Boolean);

        setCells(parsedCells);
        setViewMode('report');
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
    setViewMode('report');
    setHighlightedReco(null);
  };

  const handleUploadNew = () => {
    setResult(null);
    setCells(null);
    setFilteredCells(null);
    setError(null);
    setViewMode('report');
    setHighlightedReco(null);
    setResolution(1.0);
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
            <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">Geospatial Mapping System</h1>
          </div>

          {/* View Mode Switching Tabs (only when cells are loaded) */}
          {cells && (
            <div className="flex bg-[#0a0f1e] p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setViewMode('report')}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                  viewMode === 'report'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Executive Report
              </button>
              <button
                onClick={() => setViewMode('3d')}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                  viewMode === '3d'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
                </svg>
                3D Terrain DEM
              </button>
              <button
                onClick={() => setViewMode('2d')}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                  viewMode === '2d'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                2D Interactive Map
              </button>
              <button
                onClick={() => setViewMode('actionPlan')}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                  viewMode === 'actionPlan'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
                Action Plan Map
              </button>
            </div>
          )}

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

        {!cells ? (
          /* Upload Form Area when cells are not loaded */
          <main className="flex-1 bg-[#0a0f1e] relative flex flex-col min-w-[600px] h-full">
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
                  resolution={resolution}
                  setResolution={setResolution}
                  nextLocationName={UTTARAKHAND_LOCATIONS[locationIndexRef.current % UTTARAKHAND_LOCATIONS.length].name}
                />
              </div>
            </div>
          </main>
        ) : viewMode === 'report' ? (
          /* Executive Report View occupies the entire screen below navbar */
          <ReportView
            insights={result?.insights || []}
            recommendations={result?.recommendations || []}
            onViewOnMap={(recoText) => {
              setViewMode('actionPlan');
              setHighlightedReco(recoText);
            }}
          />
        ) : viewMode === 'actionPlan' ? (
          /* Executive Summary Mode (Action Plan) replaces sidebar and main area */
          <ActionPlanView
            cells={cells}
            originLat={processedOrigin.lat}
            originLon={processedOrigin.lon}
            resolution={processedOrigin.resolution}
            recommendations={result?.recommendations || []}
            highlightedRecoText={highlightedReco}
          />
        ) : (
          /* Standard 3D DEM or 2D Interactive Map Mode (Sidebar + Main Area) */
          <>
            {/* Sidebar */}
            <aside className="w-[420px] bg-[#0f172a] h-full overflow-y-auto border-r border-slate-800 p-6 flex flex-col gap-8 shrink-0 custom-scrollbar z-10">
              
              {/* Analysis Results */}
              <section>
                <h2 className="text-sm font-bold mb-4 text-indigo-400 uppercase tracking-wider flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
                  Analysis Results
                </h2>
                {result && result.insights && (
                  <div className="mb-6">
                    <InsightsPanel insights={result.insights} recommendations={result.recommendations} />
                  </div>
                )}
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

            {/* Main view container */}
            <main className="flex-1 bg-[#0a0f1e] relative flex flex-col min-w-[600px] h-full">
              <div className="flex-1 w-full h-full relative">
                {viewMode === '3d' ? (
                  <TerrainDEM
                    cells={cells}
                    filteredCells={filteredCells}
                    hideControls={false}
                  />
                ) : (
                  <LeafletMap
                    cells={cells}
                    filteredCells={filteredCells}
                    originLat={processedOrigin.lat}
                    originLon={processedOrigin.lon}
                    resolution={processedOrigin.resolution}
                  />
                )}
              </div>
            </main>
          </>
        )}
      </div>
    </div>
  );
}
