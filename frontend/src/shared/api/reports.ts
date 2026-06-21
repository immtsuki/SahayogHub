import type { FeedItem, CommunityMember, QuickStats } from '../../features/home/types';
import type { MatchItem } from '../../features/search/data';
import type { MapMarker, NearbyItem } from '../../features/maps/types';
import type { ProfilePost } from '../../features/profile/types';
import type { AiMatch, SubjectType, SubmittedReport } from '../types';
import { apiRequest } from './client';

export interface ApiReporter {
  id?: string;
  name: string;
  avatar: string;
  email?: string;
  phone?: string;
}

export interface ApiReport {
  id: string;
  report_type: 'lost' | 'found';
  subject_type: SubjectType;
  status: 'not_found' | 'found' | 'owner_not_found' | 'owner_found';
  item_status: 'LOST' | 'FOUND';
  title: string;
  description: string;
  category?: string;
  category_label: string;
  location: string;
  lat: number | null;
  lng: number | null;
  image: string;
  images: string[];
  displayImage?: string;
  displayImages?: string[];
  blurredImages?: string[];
  hasOriginalImages?: boolean;
  date: string;
  timeAgo: string;
  postedAgo: string;
  distance: string;
  matchPercent: number;
  match_percent: number;
  aiMatches?: AiMatch[];
  ai_matches?: AiMatch[];
  hasAiMatches?: boolean;
  aiStatus?: string;
  ai_status?: string;
  read: boolean;
  submittedAt?: string;
  reported_at?: string;
  user: ApiReporter;
  contact: {
    name: string;
    email?: string;
    phone?: string;
    avatar?: string;
  };
}

export interface ReportStatsResponse {
  quickStats: QuickStats;
  communityMembers: CommunityMember[];
}

export interface ReportQuery {
  q?: string;
  status?: string;
  type?: string;
  category?: string;
  location?: string;
  mine?: boolean;
  ids?: string[];
  recent?: boolean;
  page?: number;
  page_size?: number;
}

function queryString(params: ReportQuery = {}) {
  const query = new URLSearchParams();
  if (params.q) query.set('q', params.q);
  if (params.status) query.set('status', params.status);
  if (params.type) query.set('type', params.type);
  if (params.category) query.set('category', params.category);
  if (params.location) query.set('location', params.location);
  if (params.mine) query.set('mine', 'true');
  if (params.ids?.length) query.set('ids', params.ids.join(','));
  if (params.recent) query.set('recent', 'true');
  if (params.page) query.set('page', String(params.page));
  if (params.page_size) query.set('page_size', String(params.page_size));
  const text = query.toString();
  return text ? `?${text}` : '';
}

export async function fetchReports(params?: ReportQuery) {
  return apiRequest<ApiReport[]>(`/api/reports/${queryString(params)}`);
}

export async function fetchReportsWithTotal(params?: ReportQuery): Promise<{ reports: ApiReport[]; total: number }> {
  const url = `${(import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '')}/api/reports/${queryString(params)}`;
  const token = localStorage.getItem('sahayog-access-token');
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(url, { headers, credentials: 'include' });
  if (!response.ok) throw new Error(`Failed to fetch reports: ${response.status}`);

  const total = parseInt(response.headers.get('X-Total-Count') ?? '0', 10);
  const reports = await response.json() as ApiReport[];
  return { reports, total };
}

export async function fetchReportStats() {
  return apiRequest<ReportStatsResponse>('/api/reports/stats/');
}

export async function createReport(payload: unknown) {
  return apiRequest<ApiReport>('/api/reports/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateReport(id: string, payload: Partial<ApiReport>) {
  return apiRequest<ApiReport>(`/api/reports/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function toFeedItem(report: ApiReport): FeedItem {
  return {
    id: report.id,
    user: {
      id: report.user.id || report.id,
      name: report.user.name,
      avatar: report.user.avatar,
      email: report.user.email,
      phone: report.user.phone,
    },
    status: report.item_status,
    title: report.title,
    description: report.description,
    date: report.date,
    image: report.image,
    location: report.location,
    lat: report.lat ?? undefined,
    lng: report.lng ?? undefined,
    distance: report.distance,
    postedAgo: report.postedAgo,
  };
}

export function toMatchItem(report: ApiReport): MatchItem {
  return {
    id: report.id,
    image: report.image,
    matchPercent: report.matchPercent ?? report.match_percent ?? 0,
    title: report.title,
    distance: report.distance,
    date: report.date,
    status: report.item_status,
    location: report.location,
    lat: report.lat ?? undefined,
    lng: report.lng ?? undefined,
    description: report.description,
    postedAgo: report.postedAgo,
    user: report.user,
  };
}

export function toMapMarker(report: ApiReport): MapMarker {
  return {
    id: report.id,
    lat: report.lat ?? 40.78,
    lng: report.lng ?? -73.97,
    status: report.item_status,
    title: report.title,
    distance: report.distance,
    postedAgo: report.postedAgo,
    image: report.image,
    date: report.date,
    location: report.location,
    description: report.description,
    user: report.user,
  };
}

export function toNearbyItem(report: ApiReport): NearbyItem {
  return {
    id: report.id,
    title: report.title.length > 18 ? `${report.title.slice(0, 16)}...` : report.title,
    status: report.item_status,
    distance: report.distance,
    image: report.image,
  };
}

export function toSubmittedReport(report: ApiReport): SubmittedReport {
  return {
    id: report.id,
    category: report.report_type,
    subjectType: report.subject_type,
    status: report.status,
    title: report.title,
    description: report.description,
    category_label: report.category_label,
    location: report.location,
    lat: report.lat,
    lng: report.lng,
    contact: {
      name: report.contact?.name || report.user.name,
      email: report.contact?.email || report.user.email || '',
      phone: report.contact?.phone || report.user.phone,
      avatar: report.contact?.avatar || report.user.avatar,
    },
    images: report.images?.length ? report.images : report.image ? [report.image] : [],
    aiMatches: report.aiMatches || report.ai_matches || [],
    timeAgo: report.timeAgo,
    read: report.read,
    submittedAt: report.submittedAt || report.reported_at || new Date().toISOString(),
  };
}

export function toProfilePost(report: ApiReport): ProfilePost {
  return {
    id: report.id,
    title: report.title,
    image: report.image,
    status: report.item_status,
    location: report.location,
    postedAgo: report.postedAgo,
    date: report.date,
  };
}
