export type NotifCategory = 'lost' | 'found';
export type NotifStatus =
  | 'found'          // lost item was found
  | 'not_found'      // lost item still not found
  | 'owner_found'    // found item's owner has been identified
  | 'owner_not_found'; // found item's owner still unknown

export interface Notification {
  id: string;
  category: NotifCategory;
  status: NotifStatus;
  title: string;
  description: string;
  image: string;
  location: string;
  timeAgo: string;
  read: boolean;
}

export const NOTIFICATIONS: Notification[] = [
  {
    id: 'n1',
    category: 'lost',
    status: 'found',
    title: 'Black Nike Backpack — Found!',
    description: 'Great news! Someone reported finding a backpack matching your lost item near Downtown. Check the details and confirm if it\'s yours.',
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=80&q=80',
    location: 'Downtown',
    timeAgo: '10 min ago',
    read: false,
  },
  {
    id: 'n2',
    category: 'found',
    status: 'owner_found',
    title: 'Brown Leather Wallet — Owner Found',
    description: 'The owner of the brown leather wallet you reported found has been identified and notified. They will reach out to you shortly to arrange pickup.',
    image: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=80&q=80',
    location: 'Riverside',
    timeAgo: '1 hr ago',
    read: false,
  },
  {
    id: 'n3',
    category: 'lost',
    status: 'not_found',
    title: 'Lost House Keys — Still Searching',
    description: 'Your report for lost house keys near 5th Ave Station is still active. No matches found yet. Consider expanding the search radius or adding more details.',
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=80&q=80',
    location: '5th Ave Station',
    timeAgo: '3 hr ago',
    read: true,
  },
  {
    id: 'n4',
    category: 'found',
    status: 'owner_not_found',
    title: 'White AirPods Case — Owner Unknown',
    description: 'The AirPods case you found at Central Park has been posted for 5 days with no owner claim yet. It will remain active for 30 days before being archived.',
    image: 'https://images.unsplash.com/photo-1606741965440-3f20f24d44c0?w=80&q=80',
    location: 'Central Park',
    timeAgo: '5 days ago',
    read: true,
  },
];
