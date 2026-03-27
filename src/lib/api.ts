export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

async function fetchAPI(path: string) {
  const res = await fetch(`${API_BASE}${path}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function postAPI(path: string, data: any) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(JSON.stringify(err));
  }
  return res.json();
}

// RunLog 저장
export async function createRunLog(data: {
  user: number;
  date: string;
  distance: number;
  buff_distance: number;
  source: string;
  is_offline_meetup?: boolean;
  buffs_applied?: number[];
}) {
  return postAPI('/running/logs/', data);
}

// Auth
export async function register(data: { username: string; nickname: string; email: string; password: string }) {
  return postAPI('/accounts/register/', data);
}

export async function login(data: { username: string; password: string }) {
  return postAPI('/accounts/login/', data);
}

export async function getUserProfile(userId: number) {
  return fetchAPI(`/accounts/profile/${userId}/`);
}

export async function updateNickname(userId: number, nickname: string) {
  const res = await fetch(`${API_BASE}/accounts/profile/${userId}/nickname/`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// Accounts
export async function getUsers() {
  const data = await fetchAPI('/accounts/users/');
  return data.results;
}

export async function getUser(id: number) {
  return fetchAPI(`/accounts/users/${id}/`);
}

// Crew 생성
export async function createCrew(data: { name: string; description: string; area: string; is_public: boolean; owner: number }) {
  return postAPI('/crews/crews/', data);
}

// Crew 가입
export async function joinCrew(crewId: number) {
  return postAPI(`/crews/crews/${crewId}/join/`, {});
}

// Crews
export async function getCrews() {
  const data = await fetchAPI('/crews/crews/');
  return data.results;
}

export async function getCrewRanking(crewId: number, year?: number, month?: number) {
  const params = new URLSearchParams();
  if (year) params.set('year', String(year));
  if (month) params.set('month', String(month));
  const query = params.toString() ? `?${params}` : '';
  return fetchAPI(`/crews/crews/${crewId}/ranking/${query}`);
}

// Running
export async function getRunLogs(userId?: number) {
  const query = userId ? `?user=${userId}` : '';
  const data = await fetchAPI(`/running/logs/${query}`);
  return data.results;
}

export async function getBuffs() {
  const data = await fetchAPI('/running/buffs/');
  return data.results;
}

export async function getDailyRanking(crewId?: number, date?: string) {
  const params = new URLSearchParams();
  if (crewId) params.set('crew', String(crewId));
  if (date) params.set('date', date);
  const query = params.toString() ? `?${params}` : '';
  return fetchAPI(`/running/logs/daily_ranking/${query}`);
}

export async function getUserDailyLogs(userId: number, date: string) {
  return fetchAPI(`/running/logs/user-daily-logs/?user_id=${userId}&date=${date}`);
}

export async function getUserMonthlyLogs(userId: number, year: number, month: number) {
  return fetchAPI(`/running/logs/user-daily-logs/?user_id=${userId}&year=${year}&month=${month}`);
}

// Territory
export async function getTerritories(userId?: number) {
  const query = userId ? `?user=${userId}` : '?all=true';
  const data = await fetchAPI(`/territory/territories/${query}`);
  return Array.isArray(data) ? data : data.results;
}

export async function getTerritoryRanking() {
  return fetchAPI('/territory/territories/ranking/');
}

export async function getTerritoryLogs(userId?: number) {
  const query = userId ? `?user=${userId}` : '';
  const data = await fetchAPI(`/territory/territory-logs/${query}`);
  return data.results;
}
