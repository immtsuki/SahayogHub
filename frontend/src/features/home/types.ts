import type { ItemStatus, User } from '../../shared/types';

export interface FeedItem {
  id: string;
  user: User;
  status: ItemStatus;
  image: string;
  location: string;
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
