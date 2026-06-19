import type { FeedItem } from '../types';
import StatusBadge from '../../../shared/components/StatusBadge';

interface FeedCardProps {
  item: FeedItem;
}

export default function FeedCard({ item }: FeedCardProps) {
  return (
    <article className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow duration-200">
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
        <button
          className="text-gray-300 hover:text-gray-500 p-1.5 rounded-full hover:bg-gray-50 transition-colors shrink-0"
          aria-label="More options"
        >
          <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="2"  cy="8" r="1.5"/>
            <circle cx="8"  cy="8" r="1.5"/>
            <circle cx="14" cy="8" r="1.5"/>
          </svg>
        </button>
      </div>
      <div className="relative">
        <img
          src={item.image}
          alt={`Item reported by ${item.user.name}`}
          className="w-full h-52 sm:h-60 object-cover"
          loading="lazy"
        />
      </div>
      <div className="px-4 py-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 text-xs text-gray-400 font-normal min-w-0 flex-wrap">
            <span className="flex items-center gap-1 shrink-0">
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                <circle cx="12" cy="9" r="2.5"/>
              </svg>
              {item.location}, {item.distance}
            </span>
            <span className="flex items-center gap-1 shrink-0">
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
              </svg>
              {item.postedAgo}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
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
        <button className="w-full bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors duration-150">
          View Details
        </button>
      </div>
    </article>
  );
}
