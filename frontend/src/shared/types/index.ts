export type ItemStatus = 'LOST' | 'FOUND';
export type ReportCategory = 'lost' | 'found';
export type ReportStatus = 'found' | 'not_found' | 'owner_found' | 'owner_not_found';
export type SubjectType = 'item' | 'human' | 'document';

export interface User {
  id: string;
  name: string;
  avatar: string;
  trustScore?: number;
  email?: string;
  phone?: string;
}

export interface SubmittedReport {
  id: string;
  category: ReportCategory;
  subjectType: SubjectType;
  status: ReportStatus;
  title: string;
  description: string;
  category_label: string;
  location: string;
  lat: number | null;
  lng: number | null;
  contact?: {
    name: string;
    email: string;
    phone?: string;
    avatar?: string;
  };
  images: string[];
  aiMatches?: AiMatch[];
  timeAgo: string;
  read: boolean;
  submittedAt: string;
}

export interface AiMatch {
  id: string;
  report_type: ReportCategory;
  status: ReportStatus;
  subject_type?: SubjectType;
  title: string;
  description: string;
  category_label: string;
  location: string;
  lat: number | null;
  lng: number | null;
  image: string;
  images: string[];
  matchPercent: number;
  date: string;
  postedAgo: string;
  user: User;
  contact?: {
    name: string;
    email?: string;
    phone?: string;
    avatar?: string;
  };
}
