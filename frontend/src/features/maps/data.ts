import type { NearbyItem, MapMarker } from './types';

// Lat/lng offsets relative to the user's position (in degrees).
// ~0.001° ≈ 110 m, so these spread items within ~1–2 km.
// Entries 0–3 correspond to mapMarkers; entries 4–6 are cluster positions.
export const clusterOffsets = [
  { dlat:  0.005, dlng:  0.002 },  // m1
  { dlat: -0.008, dlng: -0.004 },  // m2
  { dlat:  0.001, dlng:  0.010 },  // m3
  { dlat: -0.018, dlng: -0.010 },  // m4
  { dlat:  0.015, dlng:  0.007, count: 12 },  // cluster 1
  { dlat: -0.018, dlng: -0.015, count: 8  },  // cluster 2
  { dlat: -0.009, dlng:  0.015, count: 5  },  // cluster 3
];

export const nearbyItems: NearbyItem[] = [
  {
    id: 'n1',
    title: 'Black Nike Back...',
    status: 'LOST',
    distance: '0.4 mi',
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=80&q=80',
  },
  {
    id: 'n2',
    title: 'Brown Leather ...',
    status: 'FOUND',
    distance: '0.7 mi',
    image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=80&q=80',
  },
  {
    id: 'n3',
    title: 'White AirPods C...',
    status: 'LOST',
    distance: '1.1 mi',
    image: 'https://images.unsplash.com/photo-1606741965440-3f20f24d44c0?w=80&q=80',
  },
  {
    id: 'n4',
    title: 'Round Glasses',
    status: 'FOUND',
    distance: '1.4 mi',
    image: 'https://images.unsplash.com/photo-1591076482161-42ce6da69f67?w=80&q=80',
  },
];

export const mapMarkers: MapMarker[] = [
  {
    id: 'm1',
    lat: 40.785, lng: -73.968,
    status: 'LOST',
    title: 'Black Nike Backpack',
    distance: '0.4 mi away',
    postedAgo: '12 min ago',
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=80&q=80',
  },
  {
    id: 'm2',
    lat: 40.772, lng: -73.974,
    status: 'FOUND',
    title: 'Brown Leather Bag',
    distance: '0.4 mi away',
    postedAgo: '2h ago',
    image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=80&q=80',
  },
  {
    id: 'm3',
    lat: 40.778, lng: -73.962,
    status: 'FOUND',
    title: 'Round Glasses',
    distance: '0.9 mi away',
    postedAgo: '45 min ago',
    image: 'https://images.unsplash.com/photo-1591076482161-42ce6da69f67?w=80&q=80',
  },
  {
    id: 'm4',
    lat: 40.762, lng: -73.98,
    status: 'LOST',
    title: 'White AirPods Case',
    distance: '1.1 mi away',
    postedAgo: '30 min ago',
    image: 'https://images.unsplash.com/photo-1606741965440-3f20f24d44c0?w=80&q=80',
  },
];
