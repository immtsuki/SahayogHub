import type { CommunityMember } from '../types';

interface CommunityWidgetProps {
  members: CommunityMember[];
}

const rankStyle: Record<number, { badge: string; ring: string }> = {
  1: { badge: 'bg-yellow-100 text-yellow-700', ring: 'ring-yellow-300' },
  2: { badge: 'bg-gray-100   text-gray-600',   ring: 'ring-gray-200'  },
  3: { badge: 'bg-orange-100 text-orange-600', ring: 'ring-orange-200' },
};

export default function CommunityWidget({ members }: CommunityWidgetProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Top Community Members</h3>
      <ul className="flex flex-col gap-3">
        {members.map((member) => {
          const s = rankStyle[member.rank] ?? { badge: 'bg-gray-100 text-gray-500', ring: 'ring-gray-100' };
          return (
            <li key={member.id} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={member.avatar}
                  alt={member.name}
                  className={`w-9 h-9 rounded-full object-cover shrink-0 ring-2 ${s.ring}`}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{member.name}</p>
                  <p className="text-[11px] font-normal text-gray-400">Trust Score {member.trustScore}</p>
                </div>
              </div>
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 ${s.badge}`}>
                #{member.rank}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
