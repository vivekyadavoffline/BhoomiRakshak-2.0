import { useState, useEffect } from 'react';
import { getLayers, getRedZones, computeEngine } from './services/api';
import Map from './components/Map';
import AnalyticsPanel from './components/AnalyticsPanel';
import PhasingMatrix from './components/PhasingMatrix';
import { AlertTriangle, Activity, XCircle } from 'lucide-react';

function App() {
  const [layers, setLayers] = useState({ hazards: null, habitations: null, sites: null });
  const [redZones, setRedZones] = useState([]);
  const [selectedZone, setSelectedZone] = useState(null);
  const [loading, setLoading] = useState(true);
  const [engineRunning, setEngineRunning] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const layersData = await getLayers();
      const zonesData = await getRedZones();
      setLayers(layersData);
      setRedZones(zonesData);
    } catch (error) {
      console.error("Error fetching data", error);
    } finally {
      setLoading(false);
    }
  };

  const runEngine = async () => {
    setEngineRunning(true);
    try {
      await computeEngine();
      await fetchData();
    } catch (error) {
      console.error("Engine failure", error);
    } finally {
      setEngineRunning(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-darker text-light font-sans">
      {/* Top Navbar */}
      <header className="bg-dark border-b border-gray-800 p-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <AlertTriangle className="text-danger" size={28} />
          <h1 className="text-2xl font-bold tracking-tight">BHOOMI RAKSHAK</h1>
          <span className="bg-gray-800 text-xs px-2 py-1 rounded text-gray-400">AUTHORITY MVP</span>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={runEngine} 
            disabled={engineRunning}
            className={`flex items-center gap-2 px-4 py-2 rounded font-bold transition ${
              engineRunning ? 'bg-gray-700 text-gray-500' : 'bg-info hover:bg-blue-600 text-white'
            }`}
          >
            <Activity size={18} className={engineRunning ? 'animate-spin' : ''} />
            {engineRunning ? 'COMPUTING...' : 'RUN ANALYTICS ENGINE'}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden flex gap-4 p-4">
        
        {/* Left Column: Analytics & Matrix */}
        <div className="w-1/3 flex flex-col gap-4 h-full">
          <div className="h-2/5">
            <AnalyticsPanel redZones={redZones} />
          </div>
          <div className="h-3/5">
            <PhasingMatrix redZones={redZones} />
          </div>
        </div>

        {/* Right Column: GIS Map & Details Panel */}
        <div className="w-2/3 flex flex-col gap-4 h-full relative">
          <div className="flex-1 bg-dark rounded-lg border border-gray-800 overflow-hidden relative">
            {loading ? (
              <div className="flex items-center justify-center h-full text-gray-500">Loading spatial data...</div>
            ) : (
              <Map layers={layers} redZones={redZones} onZoneSelect={setSelectedZone} />
            )}

            {/* Map Legend */}
            <div className="absolute bottom-4 left-4 z-[1000] bg-dark/90 p-3 rounded shadow-lg border border-gray-700 text-xs">
              <h4 className="font-bold mb-2">Layer Legend</h4>
              <div className="flex items-center gap-2 mb-1"><div className="w-4 h-4 bg-red-600 opacity-50 border border-red-600"></div> Hazard Zones</div>
              <div className="flex items-center gap-2 mb-1"><div className="w-4 h-4 bg-emerald-500 opacity-50 border border-emerald-500"></div> Candidate Sites</div>
              <div className="flex items-center gap-2 mt-3 mb-1 font-bold">Red Zones (Habitations)</div>
              <div className="flex items-center gap-2 mb-1"><div className="w-4 h-4 bg-red-500 border border-red-500"></div> Immediate Phase</div>
              <div className="flex items-center gap-2 mb-1"><div className="w-4 h-4 bg-orange-500 border border-orange-500"></div> Short-Term Phase</div>
              <div className="flex items-center gap-2 mb-1"><div className="w-4 h-4 bg-yellow-500 border border-yellow-500"></div> Medium-Term Phase</div>
            </div>
          </div>
          
          {/* XAI Explanation Overlay / Panel */}
          {selectedZone && (
            <div className="h-48 bg-dark rounded-lg border border-gray-800 p-4 shadow-lg flex flex-col">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-bold">Habitation #{selectedZone.habitation_id} Analysis</h3>
                <button onClick={() => setSelectedZone(null)} className="text-gray-400 hover:text-white">
                  <XCircle size={20} />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-4 mb-4">
                <div className="bg-gray-800 p-2 rounded text-center">
                  <div className="text-xs text-gray-400 uppercase">Priority Score</div>
                  <div className="text-xl font-mono font-bold text-danger">{selectedZone.priority_score.toFixed(1)}</div>
                </div>
                <div className="bg-gray-800 p-2 rounded text-center">
                  <div className="text-xs text-gray-400 uppercase">Hazard</div>
                  <div className="text-xl font-mono font-bold">{selectedZone.hazard_score.toFixed(1)}</div>
                </div>
                <div className="bg-gray-800 p-2 rounded text-center">
                  <div className="text-xs text-gray-400 uppercase">Vulnerability</div>
                  <div className="text-xl font-mono font-bold">{selectedZone.vulnerability_score.toFixed(1)}/10</div>
                </div>
                <div className="bg-gray-800 p-2 rounded text-center">
                  <div className="text-xs text-gray-400 uppercase">Phase</div>
                  <div className={`text-sm font-bold mt-1 ${
                    selectedZone.phase === 'Immediate' ? 'text-red-400' :
                    selectedZone.phase === 'Short-Term' ? 'text-orange-400' : 'text-yellow-400'
                  }`}>{selectedZone.phase}</div>
                </div>
              </div>
              <div>
                <span className="text-xs text-gray-400 uppercase block mb-1">Explainable AI (XAI) Justification</span>
                <p className="text-sm text-gray-300 italic">"{selectedZone.xai_explanation}"</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
