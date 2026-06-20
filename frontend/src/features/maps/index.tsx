import { useEffect, useMemo, useState } from 'react';
import FilterTabs from '../../shared/components/FilterTabs';
import NearbyItemsList from './components/NearbyItemsList';
import MapBottomCard from './components/MapBottomCard';
import MapSearchBar from './components/MapSearchBar';
import LeafletMap from './components/LeafletMap';
import type { MapMarker, NearbyItem } from './types';
import { useGeolocation } from '../../shared/hooks/useGeolocation';
import { fetchReports, toMapMarker, toNearbyItem } from '../../shared/api/reports';

const MAP_FILTER_TABS = ['All', 'Lost', 'Found', 'Today'];

// Fallback centre when geolocation is unavailable
const FALLBACK: [number, number] = [40.78, -73.97];

export default function MapsPage() {
  const [activeFilter, setActiveFilter] = useState('All');
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [nearby, setNearby] = useState<NearbyItem[]>([]);
  const { coords: userLocation, loading: geoLoading, error: geoError } = useGeolocation({ watch: true });

  useEffect(() => {
    let active = true;

    async function loadMapReports() {
      try {
        const reports = await fetchReports();
        if (!active) return;
        const reportsWithCoordinates = reports.filter((report) => report.lat !== null && report.lng !== null);
        const nextMarkers = reportsWithCoordinates.map(toMapMarker);
        setMarkers(nextMarkers);
        setNearby(reportsWithCoordinates.slice(0, 4).map(toNearbyItem));
      } catch {
        if (!active) return;
        setMarkers([]);
        setNearby([]);
      }
    }

    loadMapReports();
    return () => {
      active = false;
    };
  }, []);

  const centre = userLocation ?? (markers[0] ? [markers[0].lat, markers[0].lng] as [number, number] : FALLBACK);

  const filteredMarkers = useMemo(() => markers.filter((m) => {
    const statusMatches =
      activeFilter === 'Lost' ? m.status === 'LOST'
      : activeFilter === 'Found' ? m.status === 'FOUND'
      : true;
    const searchMatches = searchQuery ? (() => {
      const needle = searchQuery.toLowerCase();
      return [m.title, m.location, m.description].some((value) => value?.toLowerCase().includes(needle));
    })() : true;
    return statusMatches && searchMatches;
  }), [activeFilter, markers, searchQuery]);

  const handleNearbySelect = (item: NearbyItem) => {
    const marker = markers.find((m) => m.id === item.id);
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
          clusterMarkers={[]}
          onMarkerClick={setSelectedMarker}
          userLocation={userLocation}
          center={centre}
        />
      </div>
      <div className="absolute top-2 left-3 right-3 md:left-1/2 md:-translate-x-1/2 md:w-[460px] z-[1000]">
        <MapSearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search lost items, places, or reports"
        />
      </div>
      <div className="absolute top-[3rem] left-3 right-3 z-[1000]">
        <FilterTabs
          tabs={MAP_FILTER_TABS}
          active={activeFilter}
          onChange={setActiveFilter}
          scroll
        />
      </div>
      <div className="hidden md:block absolute top-[6.5rem] left-4 z-[1000]">
        <NearbyItemsList items={nearby} onSelect={handleNearbySelect} />
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
