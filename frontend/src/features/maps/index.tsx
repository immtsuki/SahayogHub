import { useState, useMemo } from 'react';
import FilterTabs from '../../shared/components/FilterTabs';
import NearbyItemsList from './components/NearbyItemsList';
import MapBottomCard from './components/MapBottomCard';
import MapSearchBar from './components/MapSearchBar';
import LeafletMap from './components/LeafletMap';
import { mapMarkers, nearbyItems, clusterOffsets } from './data';
import type { MapMarker, NearbyItem } from './types';
import { useGeolocation } from '../../shared/hooks/useGeolocation';

const MAP_FILTER_TABS = ['All', 'Lost', 'Found', 'Today'];

// Fallback centre when geolocation is unavailable
const FALLBACK: [number, number] = [40.78, -73.97];

export default function MapsPage() {
  const [activeFilter, setActiveFilter] = useState('All');
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { coords: userLocation, loading: geoLoading, error: geoError } = useGeolocation();

  const centre = userLocation ?? FALLBACK;

  // Rebase all markers relative to the user's actual position
  const rebasedMarkers = useMemo<MapMarker[]>(() =>
    mapMarkers.map((m, i) => ({
      ...m,
      lat: centre[0] + (clusterOffsets[i]?.dlat ?? 0),
      lng: centre[1] + (clusterOffsets[i]?.dlng ?? 0),
    })),
    [centre],
  );

  const rebasedClusters = useMemo(() =>
    clusterOffsets.slice(mapMarkers.length).map((o) => ({
      lat: centre[0] + o.dlat,
      lng: centre[1] + o.dlng,
      count: o.count ?? 0,
    })),
    [centre],
  );

  const filteredMarkers = rebasedMarkers.filter((m) => {
    if (activeFilter === 'Lost')  return m.status === 'LOST';
    if (activeFilter === 'Found') return m.status === 'FOUND';
    return true;
  });

  const handleNearbySelect = (item: NearbyItem) => {
    const marker = rebasedMarkers.find((m) => m.id === `m${item.id.replace('n', '')}`);
    if (marker) setSelectedMarker(marker);
  };

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Geo permission / loading banner */}
      {geoLoading && (
        <div className="absolute top-0 inset-x-0 z-[1100] flex items-center justify-center gap-2 bg-blue-500 text-white text-xs py-1.5 font-medium">
          <span className="animate-spin">⏳</span> Getting your location…
        </div>
      )}
      {geoError && !geoLoading && (
        <div className="absolute top-0 inset-x-0 z-[1100] flex items-center justify-center gap-2 bg-amber-500 text-white text-xs py-1.5 font-medium">
          ⚠️ Location unavailable — showing default area
        </div>
      )}

      <div className="absolute inset-0">
        <LeafletMap
          markers={filteredMarkers}
          clusterMarkers={rebasedClusters}
          onMarkerClick={setSelectedMarker}
          userLocation={userLocation}
        />
      </div>
      <div className="absolute top-3 left-3 right-3 md:left-1/2 md:-translate-x-1/2 md:w-[460px] z-[1000]">
        <MapSearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search lost items, places, or reports"
        />
      </div>
      <div className="absolute top-[3.25rem] left-3 right-3 z-[1000]">
        <FilterTabs
          tabs={MAP_FILTER_TABS}
          active={activeFilter}
          onChange={setActiveFilter}
          scroll
        />
      </div>
      <div className="hidden md:block absolute top-4 left-4 z-[1000]">
        <NearbyItemsList items={nearbyItems} onSelect={handleNearbySelect} />
      </div>
      {selectedMarker && (
        <div className="absolute z-[1000] left-3 right-3 bottom-[4.75rem] md:bottom-5 md:left-1/2 md:-translate-x-1/2 md:w-[480px] md:right-auto">
          <MapBottomCard
            marker={selectedMarker}
            onClose={() => setSelectedMarker(null)}
          />
        </div>
      )}
    </div>
  );
}
