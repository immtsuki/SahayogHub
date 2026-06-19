import { useState } from 'react';
import FilterTabs from '../../shared/components/FilterTabs';
import NearbyItemsList from './components/NearbyItemsList';
import MapBottomCard from './components/MapBottomCard';
import MapSearchBar from './components/MapSearchBar';
import LeafletMap from './components/LeafletMap';
import { mapMarkers, nearbyItems } from './data';
import type { MapMarker, NearbyItem } from './types';

const MAP_FILTER_TABS = ['All', 'Lost', 'Found', 'Today'];

const clusterMarkers = [
  { lat: 40.795, lng: -73.963, count: 12 },
  { lat: 40.762, lng: -73.985, count: 8  },
  { lat: 40.771, lng: -73.955, count: 5  },
];

export default function MapsPage() {
  const [activeFilter, setActiveFilter] = useState('All');
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(mapMarkers[0]);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredMarkers = mapMarkers.filter((m) => {
    if (activeFilter === 'Lost')  return m.status === 'LOST';
    if (activeFilter === 'Found') return m.status === 'FOUND';
    return true;
  });

  const handleNearbySelect = (item: NearbyItem) => {
    const marker = mapMarkers.find((m) => m.id === `m${item.id.replace('n', '')}`);
    if (marker) setSelectedMarker(marker);
  };

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div className="absolute inset-0">
        <LeafletMap
          markers={filteredMarkers}
          clusterMarkers={clusterMarkers}
          onMarkerClick={setSelectedMarker}
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
