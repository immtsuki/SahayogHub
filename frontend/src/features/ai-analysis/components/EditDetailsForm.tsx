import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useGeolocation } from '../../../shared/hooks/useGeolocation';
import LocationPickerModal from './LocationPickerModal';
import type { PickedLocation } from './LocationPickerModal';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon   from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow });

const CATEGORIES = ['Bags & Luggage', 'Electronics', 'Clothing', 'Accessories', 'Keys', 'Wallet', 'Other'];

const inputCls = 'w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition';

export interface FormData {
  itemName: string;
  category: string;
  description: string;
  location: PickedLocation | null;
}

interface EditDetailsFormProps {
  onDataChange?: (data: FormData) => void;
}

export default function EditDetailsForm({ onDataChange }: EditDetailsFormProps) {
  const [itemName,     setItemName]     = useState('Black Nike Backpack');
  const [category,     setCategory]     = useState('Bags & Luggage');
  const [description,  setDescription]  = useState(
    'Black Nike branded backpack with multiple compartments and padded straps. Last seen with a small keychain attached to the front zipper.'
  );
  const [location,     setLocation]     = useState<PickedLocation | null>(null);
  const [pickerOpen,   setPickerOpen]   = useState(false);

  const { coords, loading: geoLoading } = useGeolocation();
  const centre: [number, number] = coords ?? [40.78, -73.97];

  // Notify parent whenever form data changes
  useEffect(() => {
    onDataChange?.({ itemName, category, description, location });
  }, [itemName, category, description, location]);

  function handleUseCurrentLocation() {
    if (!coords) return;
    setLocation({ lat: coords[0], lng: coords[1], label: 'Current location' });
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${coords[0]}&lon=${coords[1]}&format=json`)
      .then((r) => r.json())
      .then((d) => {
        const label = d.display_name?.split(',').slice(0, 3).join(', ') ?? 'Current location';
        setLocation({ lat: coords[0], lng: coords[1], label });
      })
      .catch(() => {});
  }

  return (
    <>
      {pickerOpen && (
        <LocationPickerModal
          initial={centre}
          onConfirm={(loc) => { setLocation(loc); setPickerOpen(false); }}
          onClose={() => setPickerOpen(false)}
        />
      )}

      <div className="flex flex-col gap-4">
        <h2 className="font-bold text-gray-900 text-base">Edit Details</h2>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Item Name</label>
          <input type="text" value={itemName} onChange={(e) => setItemName(e.target.value)} className={inputCls} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Category</label>
          <div className="relative">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${inputCls} appearance-none cursor-pointer`}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-xs">▼</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className={`${inputCls} resize-y`} />
        </div>

        {/* ── Location ── */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">Location</label>

          {location ? (
            /* Location set — show label + change button + mini map */
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
                <svg className="shrink-0 text-blue-500" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/>
                </svg>
                <span className="flex-1 text-sm text-blue-700 truncate">{location.label}</span>
                <button
                  onClick={() => setPickerOpen(true)}
                  className="shrink-0 text-xs text-blue-500 hover:text-blue-700 font-medium cursor-pointer transition-colors"
                >
                  Change
                </button>
              </div>

              {/* Mini map preview — key forces remount on location change so map fills new size */}
              <div className="rounded-xl overflow-hidden border border-gray-200" style={{ height: '220px' }}>
                <MapContainer
                  key={`${location.lat}-${location.lng}`}
                  center={[location.lat, location.lng]}
                  zoom={15}
                  style={{ width: '100%', height: '220px' }}
                  zoomControl={false}
                  dragging={false}
                  scrollWheelZoom={false}
                  doubleClickZoom={false}
                  keyboard={false}
                  attributionControl={false}
                >
                  <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    subdomains="abcd"
                  />
                  <Marker position={[location.lat, location.lng]} />
                </MapContainer>
              </div>
            </div>
          ) : (
            /* No location yet — two options */
            <div className="flex flex-col gap-2">
              <button
                onClick={handleUseCurrentLocation}
                disabled={geoLoading || !coords}
                className="flex items-center justify-center gap-2 w-full border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 text-gray-700 text-sm font-medium py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/>
                </svg>
                {geoLoading ? 'Getting location…' : 'Use Current Location'}
              </button>

              <button
                onClick={() => setPickerOpen(true)}
                className="flex items-center justify-center gap-2 w-full border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-600 text-sm font-medium py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/>
                </svg>
                Select actual location of item found
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
