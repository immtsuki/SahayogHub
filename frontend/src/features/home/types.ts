import type { ItemStatus, User } from '../../shared/types';

export interface FeedItem {
  id: string;
  user: User;
  status: ItemStatus;
  title: string;
  description: string;
  date: string;
  image: string;
  location: string;
  lat?: number;
  lng?: number;
  distance: string;
  postedAgo: string;
}

export interface QuickStats {
  lost: number;
  found: number;
  recoveries: number;
}

export interface CommunityMember {
  id: string;
  name: string;
  avatar: string;
  trustScore: number;
  rank: number;
}
