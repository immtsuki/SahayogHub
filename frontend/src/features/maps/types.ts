import type { ItemStatus } from '../../shared/types';

export interface NearbyItem {
  id: string;
  title: string;
  status: ItemStatus;
  distance: string;
  image: string;
}

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  status: ItemStatus;
  title: string;
  distance: string;
  postedAgo: string;
  image: string;
  cluster?: number;
}
