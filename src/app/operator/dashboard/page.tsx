"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import TopBar from "@/components/TopBar";
import { getStoredUser, AuthUser } from "@/lib/auth";
import { fmtKm } from "@/lib/format";

interface MemberStat {
  id: number;
  username: string;
  profile_color: string;
  role: string;
  monthly_km: number;
  monthly_meetup: number;
}

interface CrewStats {
  crew_id: number;
  crew_name: string;
  member_count: number;
  total_km_this_month: number;
  active_battles: number;
  members: MemberStat[];
}

type SortKey = "monthly_km" | "monthly_meetup" | "username";
type SortDir = "asc" | "desc";

const API_BASE = "http://localhost:8000/api";

export default function OperatorDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [stats, setStats] = useState<CrewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("monthly_km");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored) { router.replace("/"); return; }
    if (stored.role !== "operator") { router.replace("/mypage"); return; }
    setUser(stored);

    if (!stored.crew) { setLoading(false); return; }

    fetch(`${API_BASE}/crews/crews/${stored.crew}/stats/`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => { setStats(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [router]);

  if (!user) return null;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sortedMembers = [...(stats?.members || [])].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "username") {
      cmp = a.username.localeCompare(b.username);
    } else {
      cmp = (a[sortKey] || 0) - (b[sortKey] || 0);
    }
    return sortDir === "desc" ? -cmp : cmp;
  });

  const arrow = (key: SortKey) => sortKey === key ? (sortDir === "desc" ? " ▼" : " ▲") : "";

  const now = new Date();
  const monthLabel = `${now.getFullYear()}년 ${now.getMonth() + 1}월`;

  return (
    <AppShell>
      <TopBar title="📊 운영자 대시보드" back />
      <div className="p-4 space-y-4">
        {loading ? (
          <div className="text-center text-gray-400 text-sm py-8">불러오는 중...</div>
        ) : !stats ? (
          <div className="text-center text-gray-400 text-sm py-8">크루 데이터를 불러올 수 없습니다</div>
        ) : (
          <>
            {/* 크루 요약 */}
            <div className="rounded-xl p-4 text-white shadow" style={{ background: "linear-gradient(135deg, #1565C0, #1976D2)" }}>
              <div className="font-bold text-lg">{stats.crew_name}</div>
              <div className="flex gap-4 mt-3">
                <div className="text-center">
                  <div className="text-xl font-extrabold">{stats.member_count}</div>
                  <div className="text-[10px] opacity-70">멤버</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-extrabold">{fmtKm(stats.total_km_this_month)}km</div>
                  <div className="text-[10px] opacity-70">{monthLabel} 합계</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-extrabold">{stats.active_battles}</div>
                  <div className="text-[10px] opacity-70">진행중 대결</div>
                </div>
              </div>
            </div>

            {/* 정렬 버튼 */}
            <div className="flex gap-1">
              <button
                onClick={() => handleSort("monthly_km")}
                className={`flex-1 text-center py-2 rounded-lg text-xs font-bold ${sortKey === "monthly_km" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-400"}`}
              >
                거리순{arrow("monthly_km")}
              </button>
              <button
                onClick={() => handleSort("monthly_meetup")}
                className={`flex-1 text-center py-2 rounded-lg text-xs font-bold ${sortKey === "monthly_meetup" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-400"}`}
              >
                오프벙순{arrow("monthly_meetup")}
              </button>
              <button
                onClick={() => handleSort("username")}
                className={`flex-1 text-center py-2 rounded-lg text-xs font-bold ${sortKey === "username" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-400"}`}
              >
                이름순{arrow("username")}
              </button>
            </div>

            {/* 멤버 테이블 */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="flex items-center px-4 py-2 bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-500">
                <span className="w-6">#</span>
                <span className="flex-1">이름</span>
                <span className="w-16 text-right">월 거리</span>
                <span className="w-14 text-right">오프벙</span>
              </div>

              {sortedMembers.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">크루원이 없습니다</div>
              ) : (
                sortedMembers.map((m, idx) => (
                  <div key={m.id} className="flex items-center px-4 py-3 border-b border-gray-50 last:border-b-0">
                    <span className="w-6 text-xs font-bold text-gray-400">{idx + 1}</span>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                        style={{ background: m.profile_color || "#999" }}
                      >
                        {m.username.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{m.username}</div>
                        {m.role === "operator" && (
                          <span className="text-[8px] font-bold bg-blue-100 text-blue-600 px-1 rounded">운영자</span>
                        )}
                      </div>
                    </div>
                    <span className="w-16 text-right text-sm font-bold text-[var(--dark)]">
                      {fmtKm(m.monthly_km)}km
                    </span>
                    <span className="w-14 text-right text-sm font-bold text-green-600">
                      {m.monthly_meetup}회
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* 합계 */}
            <div className="bg-gray-50 rounded-xl p-3 flex items-center text-xs text-gray-500">
              <span className="flex-1 font-bold">합계 ({sortedMembers.length}명)</span>
              <span className="w-16 text-right font-bold">{fmtKm(stats.total_km_this_month)}km</span>
              <span className="w-14 text-right font-bold text-green-600">
                {sortedMembers.reduce((a, m) => a + m.monthly_meetup, 0)}회
              </span>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
