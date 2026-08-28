import { clearUser } from './auth';

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

async function fetchAPI(path: string) {
  const res = await fetch(`${API_BASE}${path}`, { cache: 'no-store' });
  if (!res.ok) {
    const err = new Error(`API error: ${res.status}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
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
  try {
    return await fetchAPI(`/accounts/profile/${userId}/`);
  } catch (e) {
    // 저장된 계정이 서버에 없으면(계정 삭제, DB 초기화 등) 캐시된 신원을 폐기한다.
    // 인증이 없어 localStorage 의 id 가 곧 신원이므로, 남겨두면 재사용된 id 로
    // 다른 사람 계정에 접근하게 된다. 네트워크 오류나 5xx 는 로그아웃시키지 않는다.
    if ((e as { status?: number })?.status === 404 && typeof window !== 'undefined') {
      clearUser();
      window.location.replace('/');
    }
    throw e;
  }
}

export async function getNotifySettings(userId: number) {
  return fetchAPI(`/accounts/profile/${userId}/notify-settings/`);
}

export async function updateNotifySettings(userId: number, settings: Record<string, boolean>) {
  const res = await fetch(`${API_BASE}/accounts/profile/${userId}/notify-settings/`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
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

export async function deleteRunLog(logId: number, requesterId: number) {
  const res = await fetch(`${API_BASE}/running/logs/${logId}/?requester_id=${requesterId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `삭제 실패 (${res.status})`);
  }
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

export async function getTerritoryCells() {
  return fetchAPI('/territory/cells/');
}
