import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
  LOST:  'bg-red-100 text-red-600',
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
        <a href={href} className="text-sm font-semibold text-blue-600 hover:text-blue-700 break-all">{value}</a>
      ) : (
        <p className="text-sm font-semibold text-gray-900 break-all">{value}</p>
      )}
    </div>
  );
}

/** Full-screen image lightbox */
function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
      onClick={onClose}
    >
      <img
        src={src}
        alt={alt}
        className="max-w-full max-h-full object-contain rounded-xl shadow-2xl select-none"
        onClick={(e) => e.stopPropagation()}
      />
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/30 text-white rounded-full flex items-center justify-center text-xl cursor-pointer transition-colors"
        aria-label="Close lightbox"
      >×</button>
    </div>
  );
}

/** Full-screen map overlay */
function MapFullscreen({ lat, lng, location, onClose }: { lat: number; lng: number; location: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Header is ~53px; subtract it so the map fills the remaining space exactly.
  const HEADER_H = 53;
  const panelVh  = 70; // matches h-[70vh] below
  const mapH     = `calc(${panelVh}vh - ${HEADER_H}px)`;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col" style={{ height: `${panelVh}vh` }}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <svg className="text-blue-500 shrink-0" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/>
            </svg>
            <span className="text-sm font-semibold text-gray-900 truncate">{location}</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 text-lg cursor-pointer transition-colors"
            aria-label="Close map"
          >×</button>
        </div>
        {/* Give Leaflet a concrete CSS height — flex-1 / height:100% is unreliable */}
        <div style={{ height: mapH, minHeight: 0 }}>
          <LocationPreviewMap lat={lat} lng={lng} height={mapH} zoom={16} interactive />
        </div>
      </div>
    </div>
  );
}

export default function ItemDetailModal({ item, onClose }: Props) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const hasCoordinates = typeof item.lat === 'number' && typeof item.lng === 'number';

  const contactRows = [
    { label: 'User Name', value: item.user.name },
    item.user.email ? { label: 'Email',   value: item.user.email, href: `mailto:${item.user.email}` } : null,
    item.user.phone ? { label: 'Contact', value: item.user.phone, href: `tel:${item.user.phone}` }   : null,
  ].filter(Boolean) as { label: string; value: string; href?: string }[];

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <>
      {lightboxOpen && createPortal(
        <ImageLightbox src={item.image} alt={item.title} onClose={() => setLightboxOpen(false)} />,
        document.body
      )}
      {mapFullscreen && hasCoordinates && createPortal(
        <MapFullscreen
          lat={item.lat as number}
          lng={item.lng as number}
          location={item.location}
          onClose={() => setMapFullscreen(false)}
        />,
        document.body
      )}

      {/* Modal — centered on all screen sizes, never goes below screen */}
      {createPortal(
      <div
        className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 md:p-6"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="w-full max-w-xl bg-white rounded-3xl overflow-hidden flex flex-col shadow-2xl"
          style={{ maxHeight: 'min(92vh, 780px)' }}
        >
          {/* Image — clickable for lightbox */}
          <div className="relative shrink-0 cursor-zoom-in group" onClick={() => setLightboxOpen(true)}>
            <img src={item.image} alt={item.title} className="w-full h-48 md:h-60 object-cover" />
            {/* Zoom hint overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 text-white text-xs font-medium px-3 py-1.5 rounded-full">
                Click to enlarge
              </span>
            </div>
            <span className={`absolute top-3 left-3 text-xs font-bold px-3 py-1 rounded-full ${STATUS_COLOR[item.status]}`}>
              {item.status}
            </span>
            {item.matchPercent !== undefined && (
              <span className="absolute top-3 right-12 bg-blue-500 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                {item.matchPercent}% match
              </span>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="absolute top-3 right-3 w-8 h-8 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center cursor-pointer transition-colors"
              aria-label="Close"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          {/* Scrollable body */}
          <div className="overflow-y-auto flex-1 px-5 py-4 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-lg font-bold text-gray-900 leading-snug">{item.title}</h2>
              <span className="flex items-center gap-1 text-xs text-gray-400 shrink-0 mt-0.5">
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/>
                </svg>
                {item.distance}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <DetailValue label="Location" value={item.location} />
              <DetailValue label="Date"     value={item.date} />
              <DetailValue label="Posted"   value={item.postedAgo} />
              <DetailValue label="Status"   value={item.status} />
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

            {/* Map section — click to expand */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Report Location</p>
              <div className="rounded-2xl border border-gray-200 overflow-hidden bg-gray-50">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
                  <div className="flex items-center gap-2 min-w-0">
                    <svg className="shrink-0 text-blue-500" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/>
                    </svg>
                    <span className="text-sm font-semibold text-gray-800 truncate">{item.location}</span>
                  </div>
                  {hasCoordinates && (
                    <button
                      onClick={() => setMapFullscreen(true)}
                      className="shrink-0 text-xs text-blue-500 hover:text-blue-700 font-medium cursor-pointer ml-2"
                    >
                      Expand ↗
                    </button>
                  )}
                </div>
                {hasCoordinates ? (
                  <div className="cursor-zoom-in" onClick={() => setMapFullscreen(true)}>
                    <LocationPreviewMap lat={item.lat as number} lng={item.lng as number} height={180} zoom={15} />
                  </div>
                ) : (
                  <div className="h-24 flex items-center justify-center text-sm text-gray-400">
                    No coordinates for this report.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>,
      document.body
    )}
    </>
  );
}
