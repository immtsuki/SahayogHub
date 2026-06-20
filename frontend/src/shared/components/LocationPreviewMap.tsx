import { useEffect } from 'react';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

interface LocationPreviewMapProps {
  lat: number;
  lng: number;
  height?: number | string;
  zoom?: number;
  interactive?: boolean;
}

/**
 * Calls invalidateSize repeatedly until the container has a real pixel height.
 * This fixes the grey/broken tile issue when a map is rendered inside a modal,
 * portal, or any container that starts with 0 height (CSS transition, hidden,
 * overflow:hidden, etc.).
 */
function InvalidateSizeOnMount() {
  const map = useMap();

  useEffect(() => {
    // Fire immediately…
    map.invalidateSize();

    // …then keep retrying on rAF until the container actually has height.
    let rafId: number;
    let attempts = 0;
    const MAX = 30; // ~500 ms at 60 fps is plenty

    function tick() {
      attempts++;
      map.invalidateSize();
      const container = map.getContainer();
      const hasHeight = container.offsetHeight > 0;
      if (!hasHeight && attempts < MAX) {
        rafId = requestAnimationFrame(tick);
      }
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [map]);

  return null;
}

export default function LocationPreviewMap({
  lat,
  lng,
  height = 220,
  zoom = 15,
  interactive = false,
}: LocationPreviewMapProps) {
  const center: [number, number] = [lat, lng];

  // Accept numeric (px) or any valid CSS string ("100%", "100vh", etc.)
  const mapHeight = typeof height === 'number' ? `${height}px` : height;

  return (
    <MapContainer
      key={`${lat}-${lng}-${String(height)}-${interactive ? 'i' : 's'}`}
      center={center}
      zoom={zoom}
      style={{ width: '100%', height: mapHeight }}
      zoomControl={interactive}
      dragging={interactive}
      scrollWheelZoom={interactive}
      doubleClickZoom={interactive}
      keyboard={interactive}
      attributionControl={false}
    >
      <InvalidateSizeOnMount />
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
      />
      <Marker position={center} />
    </MapContainer>
  );
}
