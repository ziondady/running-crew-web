"use client";
import { useState, useEffect, useCallback } from "react";
import AppShell from "@/components/AppShell";
import TopBar from "@/components/TopBar";
import CrewRanking from "@/components/CrewRanking";
import { getDailyRanking, getCrewRanking } from "@/lib/api";
import { getStoredUser, saveUser, AuthUser } from "@/lib/auth";
import { getUserProfile } from "@/lib/api";
import { fmtKm } from "@/lib/format";

type MainTab = "crewRank" | "distance";
type DistanceSubTab = "daily" | "monthly";

interface RankItem {
  id: number;
  username: string;
  km: number;
  rank: number;
  team?: { team_side: string; team_label: string; battle_name: string };
}

export default function RankingPage() {
  const [mainTab, setMainTab] = useState<MainTab>("crewRank");
  const [distanceSubTab, setDistanceSubTab] = useState<DistanceSubTab>("daily");

  const [me, setMe] = useState<AuthUser | null>(null);
  const [error, setError] = useState("");

  const [ranking, setRanking] = useState<RankItem[]>([]);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [teamTotals, setTeamTotals] = useState<Record<string, number> | null>(null);

  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(today.toISOString().slice(0, 10));
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);

  const fetchDistanceRanking = useCallback(async (
    subTab: DistanceSubTab,
    user: AuthUser,
    date?: string,
    year?: number,
    month?: number
  ) => {
    setRankingLoading(true);
    setError("");
    try {
      if (subTab === "daily") {
        const data = await getDailyRanking(user.crew ?? undefined, date);
        if (data.ranking) {
          setRanking(data.ranking);
          setTeamTotals(data.team_totals);
        } else {
          setRanking(Array.isArray(data) ? data : []);
          setTeamTotals(null);
        }
      } else if (subTab === "monthly" && user.crew) {
        const data = await getCrewRanking(user.crew, year, month);
        if (data.ranking) {
          setRanking(data.ranking.map((r: any) => ({ ...r, km: r.monthly_km, team: r.team })));
          setTeamTotals(data.team_totals);
        } else {
          const arr = Array.isArray(data) ? data : [];
          setRanking(arr.map((r: any) => ({ id: r.id, username: r.username, km: r.monthly_km, rank: r.rank })));
          setTeamTotals(null);
        }
      } else {
        setRanking([]);
        setTeamTotals(null);
      }
    } catch (e: any) {
      setRanking([]);
      setError(e.message);
    }
    setRankingLoading(false);
  }, []);

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored) return;
    getUserProfile(stored.id)
      .then((data) => {
        setMe(data);
        saveUser(data);
      })
      .catch(() => {
        setMe(stored);
      });
  }, []);

  const handleMainTabChange = (newTab: MainTab) => {
    setMainTab(newTab);
    if (newTab === "distance" && me) {
      fetchDistanceRanking(distanceSubTab, me, selectedDate, selectedYear, selectedMonth);
    }
  };

  const handleDistanceSubTabChange = (subTab: DistanceSubTab) => {
    setDistanceSubTab(subTab);
    if (me) {
      if (subTab === "daily") {
        fetchDistanceRanking("daily", me, selectedDate);
      } else {
        fetchDistanceRanking("monthly", me, undefined, selectedYear, selectedMonth);
      }
    }
  };

  const top3 = ranking.slice(0, 3);

  return (
    <AppShell>
      <TopBar title="🏆 랭킹" settingsButton />
      <div className="p-4">
        {/* Main Tabs */}
        <div className="flex gap-1 mb-4">
          {([
            ["crewRank", "크루 랭킹"],
            ["distance", "거리 랭킹"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => handleMainTabChange(key)}
              className={`flex-1 text-center py-2 rounded-lg text-xs font-bold ${
                mainTab === key ? "bg-[var(--primary)] text-white" : "bg-gray-200 text-gray-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ===== 크루 랭킹 탭 ===== */}
        {mainTab === "crewRank" && (
          <div className="space-y-3">
            <p className="text-xs font-bold text-gray-600">🏅 크루 통합 랭킹</p>
            <p className="text-[10px] text-gray-400">대항전 승리×1000 + 점령 구간×10 기준 · 크루 터치 시 점수 이력</p>
            <CrewRanking myCrewId={me?.crew} />
          </div>
        )}

        {/* ===== 거리 랭킹 탭 ===== */}
        {mainTab === "distance" && (
          <div>
            {/* Sub-tabs */}
            <div className="flex gap-1 mb-3">
              {([["daily", "일별"], ["monthly", "월별"]] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => handleDistanceSubTabChange(key)}
                  className={`flex-1 text-center py-2 rounded-lg text-xs font-bold ${
                    distanceSubTab === key ? "bg-[var(--primary)] text-white" : "bg-gray-200 text-gray-400"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Date picker — daily */}
            {distanceSubTab === "daily" && (
              <div className="flex items-center gap-2 mb-3">
                <button
                  onClick={() => {
                    const d = new Date(selectedDate);
                    d.setDate(d.getDate() - 1);
                    const newDate = d.toISOString().slice(0, 10);
                    setSelectedDate(newDate);
                    if (me) fetchDistanceRanking("daily", me, newDate);
                  }}
                  className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 font-bold text-sm flex items-center justify-center"
                >←</button>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    if (me) fetchDistanceRanking("daily", me, e.target.value);
                  }}
                  className="flex-1 text-center text-xs font-bold bg-white border border-gray-200 rounded-lg py-2 px-3"
                />
                <button
                  onClick={() => {
                    const d = new Date(selectedDate);
                    d.setDate(d.getDate() + 1);
                    if (d <= today) {
                      const newDate = d.toISOString().slice(0, 10);
                      setSelectedDate(newDate);
                      if (me) fetchDistanceRanking("daily", me, newDate);
                    }
                  }}
                  disabled={selectedDate === today.toISOString().slice(0, 10)}
                  className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 font-bold text-sm flex items-center justify-center disabled:opacity-30"
                >→</button>
              </div>
            )}

            {/* Date picker — monthly */}
            {distanceSubTab === "monthly" && (
              <div className="flex items-center gap-2 mb-3">
                <button
                  onClick={() => {
                    let y = selectedYear, m = selectedMonth - 1;
                    if (m < 1) { m = 12; y--; }
                    setSelectedYear(y); setSelectedMonth(m);
                    if (me) fetchDistanceRanking("monthly", me, undefined, y, m);
                  }}
                  className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 font-bold text-sm flex items-center justify-center"
                >←</button>
                <div className="flex-1 text-center text-xs font-bold bg-white border border-gray-200 rounded-lg py-2 px-3">
                  {selectedYear}년 {selectedMonth}월
                </div>
                <button
                  onClick={() => {
                    let y = selectedYear, m = selectedMonth + 1;
                    if (m > 12) { m = 1; y++; }
                    if (y < today.getFullYear() || (y === today.getFullYear() && m <= today.getMonth() + 1)) {
                      setSelectedYear(y); setSelectedMonth(m);
                      if (me) fetchDistanceRanking("monthly", me, undefined, y, m);
                    }
                  }}
                  disabled={selectedYear === today.getFullYear() && selectedMonth === today.getMonth() + 1}
                  className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 font-bold text-sm flex items-center justify-center disabled:opacity-30"
                >→</button>
              </div>
            )}

            {/* Crew name label */}
            {me?.crew_name && (
              <p className="text-xs text-gray-400 mb-3">{me.crew_name} · {distanceSubTab === "daily" ? "일별 순위" : "월별 순위"}</p>
            )}

            {/* Error */}
            {error && (
              <div className="bg-red-50 text-red-500 text-xs rounded-lg px-3 py-2 mb-3">{error}</div>
            )}

            {rankingLoading ? (
              <div className="text-center text-gray-400 text-sm py-8">로딩 중...</div>
            ) : !me?.crew ? (
              <div className="text-center text-gray-400 text-sm py-8">크루에 가입하면 순위가 표시됩니다</div>
            ) : ranking.length === 0 ? (
              <div className="text-center text-gray-400 text-sm py-8">아직 기록이 없습니다</div>
            ) : (
              <>
                {top3.length >= 3 && (
                  <div className="flex items-end justify-center gap-2 mb-4">
                    <div className="text-center w-[72px]">
                      <div className="text-2xl">🥈</div>
                      <div className="bg-gray-300 rounded-t-lg h-12 flex items-center justify-center">
                        <div className="text-[10px] font-bold text-gray-700 leading-tight">
                          {top3[1]?.username}<br />{fmtKm(top3[1]?.km)}km
                        </div>
                      </div>
                    </div>
                    <div className="text-center w-[80px]">
                      <div className="text-3xl">🥇</div>
                      <div className="bg-yellow-400 rounded-t-lg h-16 flex items-center justify-center">
                        <div className="text-[10px] font-bold text-gray-700 leading-tight">
                          {top3[0]?.username}<br />{fmtKm(top3[0]?.km)}km
                        </div>
                      </div>
                    </div>
                    <div className="text-center w-[72px]">
                      <div className="text-2xl">🥉</div>
                      <div className="rounded-t-lg h-9 flex items-center justify-center" style={{ backgroundColor: "#CD7F32" }}>
                        <div className="text-[10px] font-bold text-white leading-tight">
                          {top3[2]?.username}<br />{fmtKm(top3[2]?.km)}km
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Team totals */}
                {teamTotals && Object.keys(teamTotals).length > 0 && (
                  <div className="flex gap-2 mb-3">
                    {Object.entries(teamTotals).map(([label, km]) => (
                      <div key={label} className="flex-1 bg-white rounded-lg p-2 text-center shadow-sm border border-gray-100">
                        <div className="text-[10px] font-bold text-gray-500">{label}</div>
                        <div className="text-sm font-extrabold text-[var(--dark)]">{fmtKm(km)}km</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Full list */}
                <div className="space-y-1.5">
                  {ranking.map((r) => {
                    const isMe = me && r.id === me.id;
                    return (
                      <div key={r.id} className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm shadow-sm ${isMe ? "bg-orange-50 border border-orange-200" : "bg-white"}`}>
                        <span className="font-extrabold text-[var(--primary)] w-5">{r.rank}</span>
                        {r.team && (
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
                            r.team.team_side === "A" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-600"
                          }`}>
                            {r.team.team_label}
                          </span>
                        )}
                        <span className={`flex-1 font-semibold ${isMe ? "text-[var(--primary)]" : ""}`}>
                          {isMe ? `나 (${r.username})` : r.username}
                        </span>
                        <span className={`font-bold ${isMe ? "text-[var(--primary)]" : "text-[var(--dark)]"}`}>{fmtKm(r.km)}km</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
