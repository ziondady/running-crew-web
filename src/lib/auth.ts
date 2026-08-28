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
  is_superuser?: boolean;
}

// 저장 형식이나 신원 체계가 바뀌면 이 키의 버전을 올린다.
// 올리는 즉시 기존 설치본은 "저장된 유저 없음" 상태가 되어 재로그인하게 된다.
// v2: 운영 DB 재구축으로 user id 가 1 부터 재발급되어, 기기에 남은 옛 id 가
//     다른 사람의 계정을 가리키는 문제를 끊기 위해 변경 (2026-08-28)
const STORAGE_KEY = 'running_crew_user_v2';

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
