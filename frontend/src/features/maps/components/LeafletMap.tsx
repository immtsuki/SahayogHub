import { useRef } from 'react';
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

function RecenterControl() {
  const map = useMap();

  const handleClick = () => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => map.flyTo([coords.latitude, coords.longitude], 14),
      () => map.flyTo([40.78, -73.97], 13),
    );
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

interface LeafletMapProps {
  markers: MapMarker[];
  clusterMarkers?: { lat: number; lng: number; count: number }[];
  onMarkerClick: (marker: MapMarker) => void;
  center?: [number, number];
  zoom?: number;
}

export default function LeafletMap({
  markers,
  clusterMarkers = [],
  onMarkerClick,
  center = [40.78, -73.97],
  zoom = 13,
}: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
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
        {clusterMarkers.map((c, i) => (
          <Marker
            key={`cluster-${i}`}
            position={[c.lat, c.lng]}
            icon={createClusterIcon(c.count)}
          />
        ))}
        <RecenterControl />
      </MapContainer>
    </div>
  );
}
