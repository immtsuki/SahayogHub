import type { ProfileUser, ProfilePost } from './types';

export const profileUser: ProfileUser = {
  name: 'Jordan Blake',
  avatar: 'https://i.pravatar.cc/120?img=12',
  verified: true,
  trustScore: 4.8,
  stats: { lostPosted: 12, foundPosted: 8, recoveries: 6 },
  badges: [
    { id: 'b1', emoji: '🏅', label: 'Top Finder' },
    { id: 'b2', emoji: '🤝', label: 'Helper'     },
    { id: 'b3', emoji: '✅', label: 'Verified'   },
    { id: 'b4', emoji: '⭐', label: 'Trusted'    },
  ],
  contact: {
    fullName: 'Jordan Blake',
    email: 'jordan.blake@email.com',
    phone: '+977 9801234567',
  },
};

export const profilePosts: ProfilePost[] = [
  {
    id: 'p1',
    title: 'Black Nike Backpack',
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80',
    status: 'LOST',
    location: 'Downtown',
    postedAgo: '2d ago',
    date: 'Jan 12, 2026',
  },
  {
    id: 'p2',
    title: 'Silver Watch',
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80',
    status: 'FOUND',
    location: 'Main St',
    postedAgo: '4d ago',
    date: 'Jan 10, 2026',
  },
  {
    id: 'p3',
    title: 'iPhone 15 Pro',
    image: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=600&q=80',
    status: 'LOST',
    location: 'Cafe St',
    postedAgo: '6d ago',
    date: 'Jan 08, 2026',
  },
  {
    id: 'p4',
    title: 'Car Keys',
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80',
    status: 'FOUND',
    location: 'Park Ave',
    postedAgo: '1w ago',
    date: 'Jan 06, 2026',
  },
  {
    id: 'p5',
    title: 'Black Glasses',
    image: 'https://images.unsplash.com/photo-1591076482161-42ce6da69f67?w=600&q=80',
    status: 'LOST',
    location: 'Library',
    postedAgo: '2w ago',
    date: 'Jan 03, 2026',
  },
];

export const savedPosts: ProfilePost[] = [
  {
    id: 's1',
    title: 'Brown Leather Wallet',
    image: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=600&q=80',
    status: 'LOST',
    location: 'Riverside',
    postedAgo: '3d ago',
    date: 'Jan 09, 2026',
  },
  {
    id: 's2',
    title: 'White AirPods Case',
    image: 'https://images.unsplash.com/photo-1606741965440-3f20f24d44c0?w=600&q=80',
    status: 'LOST',
    location: 'Central Park',
    postedAgo: '5d ago',
    date: 'Jan 07, 2026',
  },
];
