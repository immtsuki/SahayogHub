import type { ItemStatus } from '../../shared/types';

export interface ProfileUser {
  name: string;
  avatar: string;
  verified: boolean;
  trustScore: number;
  stats: { lostPosted: number; foundPosted: number; recoveries: number };
  badges: Badge[];
  contact: { fullName: string; email: string; phone: string };
}

export interface Badge {
  id: string;
  emoji: string;
  label: string;
}

export interface ProfilePost {
  id: string;
  title: string;
  image: string;
  status: ItemStatus;
  location: string;
  postedAgo: string;
  date: string; // e.g. "Jan 12, 2026"
}
