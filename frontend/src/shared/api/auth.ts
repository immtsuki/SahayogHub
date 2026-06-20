import { apiRequest, setAccessToken } from './client';

export interface ApiUser {
  id: number | string;
  email: string;
  full_name: string;
  phone?: string | null;
  district?: string | null;
  profile_photo?: string | null;
  date_joined?: string;
}

interface AuthResponse {
  access: string;
  user: ApiUser;
}

export async function loginUser(email: string, password: string) {
  const data = await apiRequest<AuthResponse>('/api/auth/login/', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setAccessToken(data.access);
  return data.user;
}

export async function registerUser(payload: {
  email: string;
  fullName: string;
  phone?: string;
  district?: string;
  password: string;
  password2: string;
}) {
  const data = await apiRequest<AuthResponse>('/api/auth/signup/', {
    method: 'POST',
    body: JSON.stringify({
      email: payload.email,
      full_name: payload.fullName,
      phone: payload.phone || '',
      district: payload.district || '',
      password: payload.password,
      password2: payload.password2,
    }),
  });
  setAccessToken(data.access);
  return data.user;
}

export async function fetchCurrentUser() {
  return apiRequest<ApiUser>('/api/auth/me/');
}

export async function logoutUser() {
  try {
    await apiRequest('/api/auth/logout/', { method: 'POST' });
  } finally {
    setAccessToken(null);
  }
}
