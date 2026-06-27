import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon   from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow });

export interface PickedLocation {
  lat: number;
  lng: number;
  label: string;
}

// Fly to initial position once
function FlyTo({ coords }: { coords: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.flyTo(coords, 15, { duration: 1 }); }, [coords, map]);
  return null;
}

// Draggable pin — click anywhere to move
function DraggablePin({
  position,
  onChange,
}: {
  position: [number, number];
  onChange: (pos: [number, number]) => void;
}) {
  useMapEvents({
    click(e) { onChange([e.latlng.lat, e.latlng.lng]); },
  });
  return (
    <Marker
      position={position}
      draggable
      eventHandlers={{
        dragend(e) {
          const m = e.target as L.Marker;
          const ll = m.getLatLng();
          onChange([ll.lat, ll.lng]);
        },
      }}
    />
  );
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
    const data = await res.json();
    return data.display_name?.split(',').slice(0, 3).join(', ') ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

interface LocationPickerModalProps {
  initial: [number, number];
  onConfirm: (loc: PickedLocation) => void;
  onClose: () => void;
}

export default function LocationPickerModal({ initial, onConfirm, onClose }: LocationPickerModalProps) {
  const [pin, setPin]         = useState<[number, number]>(initial);
  const [label, setLabel]     = useState<string>('');
  const [loading, setLoading] = useState(true);

  async function updatePin(pos: [number, number]) {
    setPin(pos);
    setLoading(true);
    const l = await reverseGeocode(pos[0], pos[1]);
    setLabel(l);
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    reverseGeocode(initial[0], initial[1]).then((l) => {
      if (!active) return;
      setLabel(l);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [initial]);

  return (
    <div className="fixed inset-0 md:top-14 z-[9998] bg-black/60 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center justify-between shrink-0 shadow-sm">
        <div className="min-w-0">
          <p className="text-xs text-gray-400 font-medium">Select actual location of item found</p>
          <p className="text-sm font-semibold text-gray-900 truncate mt-0.5">
            {loading ? 'Locating…' : label || 'Tap map to set location'}
          </p>
        </div>
        <button
          onClick={onClose}
          className="ml-3 shrink-0 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 text-lg cursor-pointer transition-colors"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {/* Map — fills remaining space, buttons float over it */}
      <div className="flex-1 min-h-0 relative">
        <MapContainer
          center={initial}
          zoom={15}
          style={{ width: '100%', height: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
            maxZoom={20}
          />
          <FlyTo coords={initial} />
          <DraggablePin position={pin} onChange={updatePin} />
        </MapContainer>

        {/* Buttons overlaid on the map */}
        <div
          className="absolute left-4 right-4 z-[1000] flex gap-3"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 4.5rem)' }}
        >
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 bg-white/90 backdrop-blur-sm text-gray-700 text-sm font-medium py-2.5 rounded-xl hover:bg-white transition-colors cursor-pointer shadow"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm({ lat: pin[0], lng: pin[1], label })}
            disabled={loading}
            className="flex-1 bg-blue-500/90 backdrop-blur-sm hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors cursor-pointer shadow"
          >
            Confirm Location
          </button>
        </div>
      </div>
    </div>
  );
}
