import { useEffect } from 'react';
import type { ItemStatus } from '../types';
import LocationPreviewMap from './LocationPreviewMap';

export interface ItemDetail {
  id: string;
  title: string;
  description: string;
  image: string;
  status: ItemStatus;
  date: string;
  location: string;
  lat?: number | null;
  lng?: number | null;
  distance: string;
  postedAgo: string;
  user: { name: string; avatar: string; email?: string; phone?: string };
  matchPercent?: number;
}

interface Props {
  item: ItemDetail;
  onClose: () => void;
}

const STATUS_COLOR: Record<ItemStatus, string> = {
  LOST: 'bg-red-100 text-red-600',
  FOUND: 'bg-green-100 text-green-600',
};

function DetailValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-xl px-3 py-2.5">
      <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-gray-800">{value}</p>
    </div>
  );
}

function ContactValue({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="rounded-xl border border-gray-100 px-3 py-2.5 bg-white">
      <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-0.5">{label}</p>
      {href ? (
        <a href={href} className="text-sm font-semibold text-blue-600 hover:text-blue-700 break-all">
          {value}
        </a>
      ) : (
        <p className="text-sm font-semibold text-gray-900 break-all">{value}</p>
      )}
    </div>
  );
}

export default function ItemDetailModal({ item, onClose }: Props) {
  const hasCoordinates = typeof item.lat === 'number' && typeof item.lng === 'number';
  const contactRows = [
    { label: 'User Name', value: item.user.name },
    item.user.email ? { label: 'Gmail', value: item.user.email, href: `mailto:${item.user.email}` } : null,
    item.user.phone ? { label: 'Contact', value: item.user.phone, href: `tel:${item.user.phone}` } : null,
  ].filter(Boolean) as { label: string; value: string; href?: string }[];

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[9990] bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full md:max-w-xl bg-white md:rounded-3xl rounded-t-3xl overflow-hidden flex flex-col max-h-[92vh] md:max-h-[85vh] shadow-2xl">
        <div className="relative shrink-0">
          <img src={item.image} alt={item.title} className="w-full h-52 md:h-64 object-cover" />

          <span className={`absolute top-3 left-3 text-xs font-bold px-3 py-1 rounded-full ${STATUS_COLOR[item.status]}`}>
            {item.status}
          </span>

          {item.matchPercent !== undefined && (
            <span className="absolute top-3 right-12 bg-blue-500 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
              {item.matchPercent}% match
            </span>
          )}

          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-5 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-lg font-bold text-gray-900 leading-snug">{item.title}</h2>
            <span className="flex items-center gap-1 text-xs text-gray-400 shrink-0 mt-0.5">
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                <circle cx="12" cy="9" r="2.5" />
              </svg>
              {item.distance}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <DetailValue label="Location" value={item.location} />
            <DetailValue label="Date" value={item.date} />
            <DetailValue label="Posted" value={item.postedAgo} />
            <DetailValue label="Status" value={item.status} />
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Description</p>
            <p className="text-sm text-gray-600 leading-relaxed">{item.description}</p>
          </div>

          <div className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3">
            <img src={item.user.avatar} alt={item.user.name} className="w-10 h-10 rounded-full object-cover ring-2 ring-gray-200" />
            <div className="min-w-0">
              <p className="text-xs text-gray-400 font-medium">Reported by</p>
              <p className="text-sm font-semibold text-gray-900 truncate">{item.user.name}</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Contact Details</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-gray-50 rounded-2xl p-2">
              {contactRows.map((row) => (
                <ContactValue key={row.label} {...row} />
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Report Location</p>
            <div className="rounded-2xl border border-gray-200 overflow-hidden bg-gray-50">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                <svg className="shrink-0 text-blue-500" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                  <circle cx="12" cy="9" r="2.5" />
                </svg>
                <span className="text-sm font-semibold text-gray-800 truncate">{item.location}</span>
              </div>
              {hasCoordinates ? (
                <LocationPreviewMap lat={item.lat as number} lng={item.lng as number} height={210} />
              ) : (
                <div className="h-32 flex items-center justify-center px-4 text-center text-sm text-gray-400">
                  Map coordinates were not added for this report.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
