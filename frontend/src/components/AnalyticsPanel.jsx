import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const AnalyticsPanel = ({ redZones }) => {
  const phaseData = [
    { name: 'Immediate', count: redZones.filter(z => z.phase === 'Immediate').length, color: '#ef4444' },
    { name: 'Short-Term', count: redZones.filter(z => z.phase === 'Short-Term').length, color: '#f97316' },
    { name: 'Medium-Term', count: redZones.filter(z => z.phase === 'Medium-Term').length, color: '#eab308' },
  ];

  const topRisk = [...redZones].sort((a, b) => b.priority_score - a.priority_score).slice(0, 5);

  return (
    <div className="flex flex-col gap-6 h-full p-4 bg-dark rounded-lg shadow-lg border border-gray-800 text-light overflow-y-auto">
      <h2 className="text-xl font-bold text-gray-200">Priority Analytics</h2>
      
      <div>
        <h3 className="text-sm font-semibold text-gray-400 mb-2">Relocation Phasing Breakdown</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={phaseData}>
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip cursor={{fill: '#1e293b'}} contentStyle={{backgroundColor: '#0f172a', border: 'none'}} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {phaseData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-400 mb-2">Top 5 Red Zones</h3>
        <ul className="space-y-2">
          {topRisk.map((zone, idx) => (
            <li key={idx} className="bg-gray-800 p-2 rounded text-sm flex justify-between items-center">
              <span>Habitation #{zone.habitation_id}</span>
              <span className="font-mono text-danger font-bold">{zone.priority_score.toFixed(1)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default AnalyticsPanel;
