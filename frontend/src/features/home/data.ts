import type { FeedItem, QuickStats, CommunityMember } from './types';

export const feedItems: FeedItem[] = [
  {
    id: '1',
    user: {
      id: 'u1',
      name: 'Maya Chen',
      avatar: 'https://i.pravatar.cc/40?img=5',
      email: 'maya.chen@gmail.com',
      phone: '+977 9801112233',
    },
    status: 'LOST',
    title: 'Lost Black Backpack',
    description: 'Left my black Nike backpack near the central park entrance. Has a red keychain and laptop inside. Please contact if found.',
    date: 'Today, 8:40 AM',
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80',
    location: 'Downtown',
    lat: 40.785,
    lng: -73.968,
    distance: '1.2 mi',
    postedAgo: 'Today, 8:40 AM',
  },
  {
    id: '2',
    user: {
      id: 'u2',
      name: 'Jordan Lee',
      avatar: 'https://i.pravatar.cc/40?img=8',
      email: 'jordan.lee@gmail.com',
      phone: '+977 9802223344',
    },
    status: 'FOUND',
    title: 'Found Brown Leather Wallet',
    description: 'Found a brown leather wallet by the riverside trail. Contains some cards and cash. Reach out to claim it with identification.',
    date: 'Today, 9:15 AM',
    image: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=600&q=80',
    location: 'Riverside',
    lat: 40.772,
    lng: -73.974,
    distance: '0.8 mi',
    postedAgo: 'Today, 9:15 AM',
  },
  {
    id: '3',
    user: {
      id: 'u3',
      name: 'Daniel Reyes',
      avatar: 'https://i.pravatar.cc/40?img=12',
      email: 'daniel.reyes@gmail.com',
    },
    status: 'LOST',
    title: 'Lost House Keys',
    description: 'Lost a set of house keys somewhere around 5th Ave Station. Has a small blue bottle opener keychain attached. Very important.',
    date: 'Yesterday, 6:30 PM',
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80',
    location: '5th Ave Station',
    lat: 40.778,
    lng: -73.962,
    distance: '0.8 km',
    postedAgo: '1 hr ago',
  },
];

export const quickStats: QuickStats = {
  lost: 12,
  found: 8,
  recoveries: 6,
};

export const communityMembers: CommunityMember[] = [
  { id: 'c1', name: 'Ava Patel',     avatar: 'https://i.pravatar.cc/40?img=1', trustScore: 98, rank: 1 },
  { id: 'c2', name: 'Noah Kim',      avatar: 'https://i.pravatar.cc/40?img=2', trustScore: 95, rank: 2 },
  { id: 'c3', name: 'Sophia Garcia', avatar: 'https://i.pravatar.cc/40?img=3', trustScore: 93, rank: 3 },
];
