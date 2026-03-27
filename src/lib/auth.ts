export interface AuthUser {
  id: number;
  username: string;
  nickname: string;
  display_name: string;
  email: string;
  role: string;
  crew: number | null;
  crew_name: string | null;
  profile_color: string;
  yearly_km: number;
  monthly_km: number;
  run_days: number;
  monthly_meetup: number;
  territory_count: number;
}

const STORAGE_KEY = 'running_crew_user';

export function saveUser(user: AuthUser) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  }
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return null;
  try { return JSON.parse(data); } catch { return null; }
}

export function clearUser() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
}
