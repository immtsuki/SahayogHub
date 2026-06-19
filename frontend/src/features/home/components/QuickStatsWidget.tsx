import type { QuickStats } from '../types';

interface Props { stats: QuickStats; }

const statConfig = [
  { key: 'lost'       as const, label: 'Lost',       color: 'text-red-500',   bg: 'bg-red-50'   },
  { key: 'found'      as const, label: 'Found',      color: 'text-green-500', bg: 'bg-green-50' },
  { key: 'recoveries' as const, label: 'Recoveries', color: 'text-blue-500',  bg: 'bg-blue-50'  },
];

export default function QuickStatsWidget({ stats }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Stats</h3>
      <div className="grid grid-cols-3 gap-2">
        {statConfig.map(({ key, label, color, bg }) => (
          <div key={key} className={`flex flex-col items-center ${bg} rounded-xl py-3 px-1`}>
            <span className={`text-xl font-bold ${color}`}>{stats[key]}</span>
            <span className="text-[11px] font-medium text-gray-500 mt-0.5">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
