import { downloadCertificate } from '../services/api';
import { FileText } from 'lucide-react';

const PhasingMatrix = ({ redZones }) => {
  return (
    <div className="bg-dark p-4 rounded-lg shadow-lg border border-gray-800 text-light overflow-auto h-full">
      <h2 className="text-xl font-bold mb-4">Relocation Phasing Matrix</h2>
      <table className="w-full text-sm text-left">
        <thead className="text-xs text-gray-400 uppercase bg-gray-800">
          <tr>
            <th className="px-4 py-3 rounded-tl-lg">Zone ID</th>
            <th className="px-4 py-3">Score</th>
            <th className="px-4 py-3">Phase</th>
            <th className="px-4 py-3">Assigned Site</th>
            <th className="px-4 py-3 rounded-tr-lg">Action</th>
          </tr>
        </thead>
        <tbody>
          {redZones.map((zone) => (
            <tr key={zone.id} className="border-b border-gray-800 hover:bg-gray-800/50">
              <td className="px-4 py-3 font-medium">#{zone.id}</td>
              <td className="px-4 py-3 text-red-400 font-mono">{zone.priority_score.toFixed(1)}</td>
              <td className="px-4 py-3">
                <span className={`px-2 py-1 rounded text-xs font-bold ${
                  zone.phase === 'Immediate' ? 'bg-red-900/50 text-red-400' :
                  zone.phase === 'Short-Term' ? 'bg-orange-900/50 text-orange-400' :
                  'bg-yellow-900/50 text-yellow-400'
                }`}>
                  {zone.phase}
                </span>
              </td>
              <td className="px-4 py-3">{zone.assigned_site_id ? `Site #${zone.assigned_site_id}` : 'UNASSIGNED'}</td>
              <td className="px-4 py-3">
                <button 
                  onClick={() => downloadCertificate(zone.id)}
                  className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs transition"
                >
                  <FileText size={14} /> Certificate
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PhasingMatrix;
