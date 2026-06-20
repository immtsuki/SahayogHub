export type NotifCategory = 'lost' | 'found';
export type NotifStatus =
  | 'found'
  | 'not_found'
  | 'owner_found'
  | 'owner_not_found';

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
