import type { NearbyItem } from '../types';
import StatusBadge from '../../../shared/components/StatusBadge';

interface NearbyItemsListProps {
  items: NearbyItem[];
  onSelect: (item: NearbyItem) => void;
}

export default function NearbyItemsList({ items, onSelect }: NearbyItemsListProps) {
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 w-60">
      <div className="flex items-center justify-between mb-0.5">
        <h3 className="text-sm font-semibold text-gray-900">Nearby Items</h3>
        <button
          aria-label="Filter list"
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
            <line x1="4" y1="6"  x2="20" y2="6"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
            <line x1="11" y1="18" x2="13" y2="18"/>
          </svg>
        </button>
      </div>
      <p className="text-[11px] font-normal text-gray-400 mb-3">Live reports around you</p>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center gap-2.5 cursor-pointer hover:bg-gray-50 rounded-xl p-1.5 -mx-1.5 transition-colors group"
            onClick={() => onSelect(item)}
          >
            <img
              src={item.image}
              alt={item.title}
              className="w-11 h-11 rounded-xl object-cover shrink-0"
              loading="lazy"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-900 truncate">{item.title}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <StatusBadge status={item.status} />
                <span className="text-[11px] font-normal text-gray-400">{item.distance}</span>
              </div>
            </div>
            <button className="text-[11px] font-semibold text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              View
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
