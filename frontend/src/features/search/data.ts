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
  description: string;
  postedAgo: string;
  user: { name: string; avatar: string };
}

export const MATCH_ITEMS: MatchItem[] = [
  {
    id: 'm1',
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80',
    matchPercent: 92,
    title: 'Black Nike Backpack',
    distance: '2.1 mi',
    date: 'Jan 12',
    status: 'LOST',
    location: 'Downtown',
    description: 'Black Nike branded backpack with multiple compartments and padded straps. Last seen near the central park entrance with a red keychain attached.',
    postedAgo: '2d ago',
    user: { name: 'Maya Chen', avatar: 'https://i.pravatar.cc/40?img=5' },
  },
  {
    id: 'm2',
    image: 'https://images.unsplash.com/photo-1523779917675-b6ed3a42a561?w=600&q=80',
    matchPercent: 87,
    title: 'Brown Leather Wallet',
    distance: '3.4 mi',
    date: 'Jan 10',
    status: 'FOUND',
    location: 'Riverside',
    description: 'Found a brown leather wallet by the riverside trail. Contains some cards and cash. Reach out to claim it with identification.',
    postedAgo: '4d ago',
    user: { name: 'Jordan Lee', avatar: 'https://i.pravatar.cc/40?img=8' },
  },
  {
    id: 'm3',
    image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&q=80',
    matchPercent: 74,
    title: 'Samsung Galaxy Phone',
    distance: '5.8 mi',
    date: 'Jan 08',
    status: 'LOST',
    location: '5th Ave Station',
    description: 'Lost a Samsung Galaxy S23 with a cracked bottom-left corner. Has a clear case with a small star sticker on the back. Very important data inside.',
    postedAgo: '6d ago',
    user: { name: 'Daniel Reyes', avatar: 'https://i.pravatar.cc/40?img=12' },
  },
  {
    id: 'm4',
    image: 'https://images.unsplash.com/photo-1574258495973-f010dfbb5371?w=600&q=80',
    matchPercent: 68,
    title: 'Round Frame Glasses',
    distance: '7.2 mi',
    date: 'Jan 06',
    status: 'FOUND',
    location: 'Central Park',
    description: 'Found a pair of round tortoiseshell glasses near the fountain area in Central Park. Prescription lenses, left them at the park security office.',
    postedAgo: '1w ago',
    user: { name: 'Ava Patel', avatar: 'https://i.pravatar.cc/40?img=1' },
  },
];

export type StatusFilter = 'Lost' | 'Found' | 'All' | 'Nearby' | 'Recent';
export const STATUS_FILTERS: StatusFilter[] = ['Lost', 'Found', 'All', 'Nearby', 'Recent'];
export const SORT_OPTIONS = ['Closest Match', 'Most Recent', 'Nearest'];
