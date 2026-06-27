import type { ItemStatus } from '../../shared/types';

export interface MatchItem {
  id: string;
  image: string;
  matchPercent: number;
  title: string;
  distance: string;
  date: string;
  status: ItemStatus;
  location: string;
  lat?: number;
  lng?: number;
  description: string;
  postedAgo: string;
  user: { name: string; avatar: string; email?: string; phone?: string };
}

export type StatusFilter = 'Lost' | 'Found' | 'All' | 'Nearby' | 'Recent';
export const STATUS_FILTERS: StatusFilter[] = ['Lost', 'Found', 'All', 'Nearby', 'Recent'];
export const SORT_OPTIONS = ['Closest Match', 'Most Recent', 'Nearest'];
