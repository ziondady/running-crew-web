// Mock data for the running crew app prototype

export interface User {
  id: string;
  name: string;
  crew: string | null;
  role: "member" | "operator";
  monthlyKm: number;
  yearlyKm: number;
  runDays: number;
  crewRank: number;
  stravaConnected: boolean;
  garminConnected: boolean;
}

export interface CrewMember {
  id: string;
  name: string;
  monthlyKm: number;
  rank: number;
}

export interface RunLog {
  id: string;
  date: string;
  distance: number;
  buffDistance: number;
  buffs: string[];
}

export interface Battle {
  id: string;
  type: "external" | "internal";
  teamA: { name: string; km: number };
  teamB: { name: string; km: number };
  daysLeft: number;
  status: "active" | "ended";
}

export const currentUser: User = {
  id: "u1",
  name: "홍길동",
  crew: "서울런닝클럽",
  role: "member",
  monthlyKm: 127.4,
  yearlyKm: 1204,
  runDays: 23,
  crewRank: 3,
  stravaConnected: true,
  garminConnected: false,
};

export const crewMembers: CrewMember[] = [
  { id: "m1", name: "김민준", monthlyKm: 214, rank: 1 },
  { id: "m2", name: "이서연", monthlyKm: 189, rank: 2 },
  { id: "u1", name: "홍길동", monthlyKm: 127.4, rank: 3 },
  { id: "m3", name: "박지훈", monthlyKm: 98, rank: 4 },
  { id: "m4", name: "최유진", monthlyKm: 85, rank: 5 },
  { id: "m5", name: "정다은", monthlyKm: 51, rank: 6 },
];

export const dailyRanking: CrewMember[] = [
  { id: "m1", name: "김민준", monthlyKm: 21.1, rank: 1 },
  { id: "m2", name: "이서연", monthlyKm: 15.0, rank: 2 },
  { id: "u1", name: "홍길동", monthlyKm: 15.0, rank: 3 },
  { id: "m3", name: "박지훈", monthlyKm: 10.2, rank: 4 },
  { id: "m4", name: "최유진", monthlyKm: 8.5, rank: 5 },
  { id: "m5", name: "정다은", monthlyKm: 5.1, rank: 6 },
];

export const battles: Battle[] = [
  {
    id: "b1",
    type: "external",
    teamA: { name: "서울런닝", km: 892 },
    teamB: { name: "한강크루", km: 834 },
    daysLeft: 3,
    status: "active",
  },
  {
    id: "b2",
    type: "internal",
    teamA: { name: "A팀 (나 포함)", km: 312 },
    teamB: { name: "B팀", km: 289 },
    daysLeft: 5,
    status: "active",
  },
];

export const recentLogs: RunLog[] = [
  { id: "r1", date: "2026.03.25", distance: 12.5, buffDistance: 15.0, buffs: ["새벽런 ×1.2"] },
  { id: "r2", date: "2026.03.24", distance: 8.0, buffDistance: 8.0, buffs: [] },
  { id: "r3", date: "2026.03.23", distance: 10.0, buffDistance: 13.0, buffs: ["장거리 ×1.3"] },
];

export const buffOptions = [
  { name: "새벽런", multiplier: 1.2, condition: "06시 이전" },
  { name: "야간런", multiplier: 1.2, condition: "22시 이후" },
  { name: "장거리", multiplier: 1.3, condition: "10km 이상" },
  { name: "하프", multiplier: 1.5, condition: "21km 이상" },
  { name: "풀마라톤", multiplier: 2.0, condition: "42km 이상" },
];
