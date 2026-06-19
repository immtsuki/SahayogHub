export type ItemStatus = 'LOST' | 'FOUND';

export interface User {
  id: string;
  name: string;
  avatar: string;
  trustScore?: number;
}
