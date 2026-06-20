import { useEffect } from 'react';
import type { ItemStatus } from '../types';

export interface ItemDetail {
  id: string;
  title: string;
  description: string;
  image: string;
  status: ItemStatus;
  date: string;
  location: string;
  distance: string;
  postedAgo: string;
  user: { name: string; avatar: string };
  matchPercent?: number;
}

interface Props {
  item: ItemDetail;
  onClose: () => void;
}

const STATUS_COLOR: Record<ItemStatus, string> = {
  LOST:  'bg-red-100 text-red-600',
  FOUND: 'bg-green-100 text-green-600',
};

export default function ItemDetailModal({ item, onClose }: Props) {
  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[9990] bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Sheet — slides up on mobile, centered card on desktop */}
      <div className="w-full md:max-w-lg bg-white md:rounded-3xl rounded-t-3xl overflow-hidden flex flex-col max-h-[92vh] md:max-h-[85vh] shadow-2xl">

        {/* Image */}
        <div className="relative shrink-0">
          <img src={item.image} alt={item.title} className="w-full h-52 md:h-64 object-cover" />

          {/* Status badge */}
          <span className={`absolute top-3 left-3 text-xs font-bold px-3 py-1 rounded-full ${STATUS_COLOR[item.status]}`}>
            {item.status}
          </span>

          {/* Match % if available */}
          {item.matchPercent !== undefined && (
            <span className="absolute top-3 right-12 bg-blue-500 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
              {item.matchPercent}% match
            </span>
          )}

          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center text-lg transition-colors cursor-pointer"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-5 py-5 flex flex-col gap-4">

          {/* Title + distance */}
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-lg font-bold text-gray-900 leading-snug">{item.title}</h2>
            <span className="flex items-center gap-1 text-xs text-gray-400 shrink-0 mt-0.5">
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/>
              </svg>
              {item.distance}
            </span>
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: '📍', label: 'Location',   value: item.location  },
              { icon: '🕐', label: 'Date',        value: item.date      },
              { icon: '⏱', label: 'Posted',      value: item.postedAgo },
              { icon: '🏷', label: 'Status',      value: item.status    },
            ].map(({ icon, label, value }) => (
              <div key={label} className="bg-gray-50 rounded-xl px-3 py-2.5">
                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-0.5">{icon} {label}</p>
                <p className="text-sm font-semibold text-gray-800">{value}</p>
              </div>
            ))}
          </div>

          {/* Description */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Description</p>
            <p className="text-sm text-gray-600 leading-relaxed">{item.description}</p>
          </div>

          {/* Reporter */}
          <div className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3">
            <img src={item.user.avatar} alt={item.user.name} className="w-10 h-10 rounded-full object-cover ring-2 ring-gray-200" />
            <div>
              <p className="text-xs text-gray-400 font-medium">Reported by</p>
              <p className="text-sm font-semibold text-gray-900">{item.user.name}</p>
            </div>
            <button className="ml-auto text-xs text-blue-500 hover:text-blue-700 font-semibold border border-blue-200 px-3 py-1.5 rounded-xl hover:bg-blue-50 transition-colors cursor-pointer">
              Message
            </button>
          </div>
        </div>

        {/* Footer actions */}
        <div className="shrink-0 px-5 py-4 border-t border-gray-100 flex gap-3"
          style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
        >
          <button className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer flex items-center justify-center gap-1.5">
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
            Save
          </button>
          <button className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5">
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            Contact Reporter
          </button>
        </div>
      </div>
    </div>
  );
}
