import { useEffect, useState } from 'react';
import type { AiMatch } from '../types';
import ItemDetailModal from './ItemDetailModal';
import type { ItemDetail } from './ItemDetailModal';

interface Props {
  reportType: 'lost' | 'found';
  matches: AiMatch[];
  onClose: () => void;
}

export default function MatchResultsModal({ reportType, matches, onClose }: Props) {
  const [selectedMatch, setSelectedMatch] = useState<AiMatch | null>(null);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const hasMatches = matches.length > 0;
  const oppLabel   = reportType === 'lost' ? 'Found' : 'Lost';

  function toItemDetail(match: AiMatch): ItemDetail {
    return {
      id: match.id,
      title: match.title,
      description: match.description,
      image: match.images?.[0] || match.image || '',
      status: match.report_type === 'lost' ? 'LOST' : 'FOUND',
      date: match.date || '',
      location: match.location || 'Location not specified',
      lat: match.lat,
      lng: match.lng,
      distance: '',
      postedAgo: match.postedAgo || '',
      user: {
        name: match.contact?.name || match.user?.name || 'Unknown',
        avatar: match.contact?.avatar || match.user?.avatar || `https://i.pravatar.cc/40?u=${match.id}`,
        email: match.contact?.email || match.user?.email,
        phone: match.contact?.phone || match.user?.phone,
      },
      matchPercent: Math.round(match.matchPercent ?? 0),
    };
  }

  return (
    <>
      {selectedMatch && (
        <ItemDetailModal
          item={toItemDetail(selectedMatch)}
          onClose={() => setSelectedMatch(null)}
        />
      )}
    <div
      className="fixed inset-0 z-[9995] bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full md:max-w-lg bg-white md:rounded-3xl rounded-t-3xl overflow-hidden flex flex-col max-h-[92vh] md:max-h-[85vh] shadow-2xl">

        {/* Header */}
        <div className={`px-5 pt-5 pb-4 border-b border-gray-100 ${hasMatches ? 'bg-green-50' : 'bg-gray-50'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${hasMatches ? 'bg-green-500' : 'bg-gray-300'}`}>
                {hasMatches ? (
                  <svg width="20" height="20" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                )}
              </div>
              <div>
                <p className={`text-base font-bold ${hasMatches ? 'text-green-800' : 'text-gray-700'}`}>
                  {hasMatches ? `${matches.length} Potential Match${matches.length > 1 ? 'es' : ''} Found!` : 'No Matches Found Yet'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {hasMatches
                    ? `We compared your report against ${oppLabel.toLowerCase()} reports in the database.`
                    : 'Your report has been saved. We\'ll notify you when a match is found.'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 text-lg cursor-pointer transition-colors shrink-0"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-5 py-4">
          {hasMatches ? (
            <div className="flex flex-col gap-3">
              {matches.map((match, i) => (
                <div
                  key={match.id ?? i}
                  onClick={() => setSelectedMatch(match)}
                  className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl p-3 shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-pointer"
                >
                  {/* Image */}
                  <div className="relative shrink-0">
                    <img
                      src={(match.images?.[0] || match.image) ?? ''}
                      alt={match.title}
                      className="w-16 h-16 rounded-xl object-cover bg-gray-100"
                    />
                    {/* Match % */}
                    <span className="absolute -top-1.5 -right-1.5 bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow">
                      {Math.round(match.matchPercent ?? 0)}%
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{match.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {match.location || 'Location not specified'}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${oppLabel === 'Found' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                        {oppLabel.toUpperCase()}
                      </span>
                      <span className="text-[10px] text-gray-400">{match.date || match.postedAgo || ''}</span>
                    </div>
                  </div>

                  {/* Reporter avatar */}
                  {match.user?.avatar && (
                    <img
                      src={match.user.avatar}
                      alt={match.user.name}
                      className="w-8 h-8 rounded-full object-cover shrink-0 border-2 border-white shadow"
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                <svg width="28" height="28" fill="none" stroke="#9ca3af" strokeWidth="1.5" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-600">No visual matches found</p>
              <p className="text-xs text-gray-400 max-w-xs">
                Your report is live and we'll automatically compare it as new reports come in.
                You'll receive a notification when a match is found.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-5 py-4 border-t border-gray-100 flex gap-3"
          style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
        >
          <button
            onClick={onClose}
            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            {hasMatches ? 'View All Notifications' : 'Got It'}
          </button>
        </div>
      </div>
    </div>
    </>
  );
}
