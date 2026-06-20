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
  height?: number;
  zoom?: number;
  interactive?: boolean;
}

function ResizeWhenMounted() {
  const map = useMap();

  useEffect(() => {
    const id = window.setTimeout(() => map.invalidateSize(), 0);
    return () => window.clearTimeout(id);
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
  const mapHeight = `${height}px`;

  return (
    <MapContainer
      key={`${lat}-${lng}-${height}-${interactive ? 'interactive' : 'static'}`}
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
      <ResizeWhenMounted />
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
      />
      <Marker position={center} />
    </MapContainer>
  );
}
