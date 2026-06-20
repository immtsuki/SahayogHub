import { useState } from 'react';
import StatusBadge from '../../../shared/components/StatusBadge';
import ItemDetailModal from '../../../shared/components/ItemDetailModal';
import type { MatchItem } from '../data';

interface MatchCardProps {
  item: MatchItem;
}

export default function MatchCard({ item }: MatchCardProps) {
  const [detailOpen, setDetailOpen] = useState(false);

  return (
    <>
      {detailOpen && (
        <ItemDetailModal
          item={{ ...item, matchPercent: item.matchPercent }}
          onClose={() => setDetailOpen(false)}
        />
      )}

      <article className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow duration-200">
        {/* ── User header ── */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={item.user.avatar}
              alt={item.user.name}
              className="w-10 h-10 rounded-full object-cover shrink-0 ring-2 ring-gray-100"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-gray-900 text-sm">{item.user.name}</span>
                <StatusBadge status={item.status} />
              </div>
              <p className="text-xs text-gray-400 mt-0.5 font-normal">Posted {item.postedAgo}</p>
            </div>
          </div>
          <span className="shrink-0 bg-blue-500 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full">
            {item.matchPercent}%
          </span>
        </div>

        {/* ── Image ── */}
        <div className="relative">
          <img
            src={item.image}
            alt={item.title}
            className="w-full h-48 sm:h-52 object-cover"
            loading="lazy"
          />
        </div>

        {/* ── Body ── */}
        <div className="px-4 py-3 space-y-2">
          {/* Title + distance */}
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-gray-900 leading-snug">{item.title}</h3>
            <span className="flex items-center gap-1 text-[11px] text-gray-400 font-normal shrink-0">
              <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                <circle cx="12" cy="9" r="2.5"/>
              </svg>
              {item.distance}
            </span>
          </div>

          {/* Date + location */}
          <div className="flex items-center gap-3 text-[11px] text-gray-400 font-normal flex-wrap">
            <span className="flex items-center gap-1">
              <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
              </svg>
              {item.date}
            </span>
            <span className="flex items-center gap-1">
              <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                <circle cx="12" cy="9" r="2.5"/>
              </svg>
              {item.location}
            </span>
          </div>

          {/* View Details */}
          <button
            onClick={() => setDetailOpen(true)}
            className="w-full bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors duration-150"
          >
            View Details
          </button>

          {/* Actions */}
          <div className="flex items-center justify-end gap-1 pt-1">
            <button aria-label="Save" className="p-1.5 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
              </svg>
            </button>
            <button aria-label="Share" className="p-1.5 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98"/>
              </svg>
            </button>
            <button aria-label="Comment" className="p-1.5 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </button>
          </div>
        </div>
      </article>
    </>
  );
}
