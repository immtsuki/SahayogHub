import type { MapMarker } from '../types';
import StatusBadge from '../../../shared/components/StatusBadge';

interface MapBottomCardProps {
  marker: MapMarker;
  onClose: () => void;
}

export default function MapBottomCard({ marker, onClose }: MapBottomCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
      <img
        src={marker.image}
        alt={marker.title}
        className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover shrink-0"
        loading="lazy"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <p className="font-semibold text-sm text-gray-900 truncate">{marker.title}</p>
          <StatusBadge status={marker.status} />
        </div>
        <p className="flex items-center gap-2 text-[11px] font-normal text-gray-400 flex-wrap">
          <span className="flex items-center gap-1">
            <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            </svg>
            {marker.distance}
          </span>
          <span aria-hidden="true">•</span>
          <span className="flex items-center gap-1">
            <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
            </svg>
            {marker.postedAgo}
          </span>
        </p>
      </div>

      <div className="flex flex-col items-end gap-2 shrink-0">
        <button
          onClick={onClose}
          className="p-1 text-gray-300 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          aria-label="Close"
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
        <button className="bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors whitespace-nowrap">
          View Details
        </button>
      </div>
    </div>
  );
}
