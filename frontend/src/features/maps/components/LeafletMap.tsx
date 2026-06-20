import { useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { MapMarker } from '../types';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// ── Icon helpers ──────────────────────────────────────────────────────────────

function createStatusIcon(status: 'LOST' | 'FOUND') {
  const isLost = status === 'LOST';
  const bg = isLost ? '#ef4444' : '#22c55e';
  const label = isLost ? 'Lost' : 'Found';

  return L.divIcon({
    html: `<div style="
        background:${bg};color:white;font-size:11px;font-weight:700;
        padding:5px 12px;border-radius:999px;white-space:nowrap;
        display:flex;align-items:center;gap:4px;
        box-shadow:0 2px 8px rgba(0,0,0,.3);"
    >📍 ${label}</div>`,
    className: '',
    iconAnchor: [36, 16],
    popupAnchor: [0, -22],
  });
}

function createClusterIcon(count: number) {
  return L.divIcon({
    html: `<div style="
        background:#3b82f6;color:white;width:38px;height:38px;border-radius:50%;
        display:flex;align-items:center;justify-content:center;
        font-weight:700;font-size:13px;box-shadow:0 2px 8px rgba(59,130,246,.5);"
    >${count}</div>`,
    className: '',
    iconAnchor: [19, 19],
  });
}

function createUserLocationIcon() {
  return L.divIcon({
    html: `<div style="
        width:18px;height:18px;border-radius:50%;
        background:#3b82f6;border:3px solid white;
        box-shadow:0 0 0 4px rgba(59,130,246,0.3),0 2px 8px rgba(0,0,0,0.25);">
      </div>`,
    className: '',
    iconAnchor: [9, 9],
    popupAnchor: [0, -12],
  });
}

// ── Map sub-components ────────────────────────────────────────────────────────

/** Flies to the user's location the first time it becomes available. */
function RecenterOnUser({ coords }: { coords: [number, number] | null }) {
  const map = useMap();
  const didFly = useRef(false);

  useEffect(() => {
    if (coords && !didFly.current) {
      map.flyTo(coords, 15, { duration: 1.4 });
      didFly.current = true;
    }
  }, [coords, map]);

  return null;
}

/** Blue "recenter" FAB — flies back to live coords on tap. */
function RecenterControl({ userCoords }: { userCoords: [number, number] | null }) {
  const map = useMap();

  const handleClick = () => {
    if (userCoords) {
      map.flyTo(userCoords, 15);
    } else {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => map.flyTo([coords.latitude, coords.longitude], 15),
        () => map.flyTo([40.78, -73.97], 13),
      );
    }
  };

  return (
    <button
      onClick={handleClick}
      style={{
        position: 'absolute',
        bottom: 24,
        right: 16,
        zIndex: 1000,
        background: '#3b82f6',
        color: 'white',
        width: 48,
        height: 48,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 12px rgba(59,130,246,.4)',
        border: 'none',
        cursor: 'pointer',
        fontSize: 20,
        transition: 'background .2s',
      }}
      aria-label="My location"
      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#2563eb')}
      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#3b82f6')}
    >
      🎯
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface LeafletMapProps {
  markers: MapMarker[];
  clusterMarkers?: { lat: number; lng: number; count: number }[];
  onMarkerClick: (marker: MapMarker) => void;
  userLocation?: [number, number] | null;
  center?: [number, number];
  zoom?: number;
}

export default function LeafletMap({
  markers,
  clusterMarkers = [],
  onMarkerClick,
  userLocation = null,
  center = [40.78, -73.97],
  zoom = 13,
}: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <MapContainer
        center={userLocation ?? center}
        zoom={zoom}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={20}
        />

        {/* Fly to user on first fix */}
        <RecenterOnUser coords={userLocation} />

        {/* User's live location dot */}
        {userLocation && (
          <Marker position={userLocation} icon={createUserLocationIcon()}>
            <Popup>
              <div className="text-xs font-medium">📍 You are here</div>
            </Popup>
          </Marker>
        )}

        {/* Item markers */}
        {markers.map((m) => (
          <Marker
            key={m.id}
            position={[m.lat, m.lng]}
            icon={createStatusIcon(m.status)}
            eventHandlers={{ click: () => onMarkerClick(m) }}
          >
            <Popup>
              <div className="text-xs leading-relaxed">
                <strong>{m.title}</strong><br />
                {m.distance} · {m.postedAgo}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Cluster markers */}
        {clusterMarkers.map((c, i) => (
          <Marker
            key={`cluster-${i}`}
            position={[c.lat, c.lng]}
            icon={createClusterIcon(c.count)}
          />
        ))}

        <RecenterControl userCoords={userLocation} />
      </MapContainer>
    </div>
  );
}
