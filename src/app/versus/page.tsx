"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import TopBar from "@/components/TopBar";
import BattleCard from "@/components/BattleCard";
import { getUserProfile, API_BASE } from "@/lib/api";
import { getStoredUser, saveUser, AuthUser } from "@/lib/auth";
import { fmtKm } from "@/lib/format";

type MainTab = "crewBattle" | "internal";

interface ActiveBattle {
  battle_id: number;
  battle_name: string;
  battle_type: string;
  my_team: string;
  team_a_label: string;
  team_b_label: string;
  team_a_km: number;
  team_b_km: number;
  days_left: number;
  start_date: string;
  end_date: string;
  crew_a_name: string | null;
  crew_b_name: string | null;
}

interface TeamDetail {
  battle: number;
  team_a: { id: number; username: string; profile_color: string }[];
  team_b: { id: number; username: string; profile_color: string }[];
}

interface PastBattle {
  id: number;
  name: string;
  battle_type: string;
  start_date: string;
  end_date: string;
  winner_crew: number | null;
  crew_a: number;
  crew_b: number;
  crew_a_name?: string;
  crew_b_name?: string;
  crew_a_km?: number;
  crew_b_km?: number;
}

interface CrewBattleHistory {
  battle_id: number;
  battle_name: string;
  battle_type: string;
  crew_a_name: string | null;
  crew_b_name: string | null;
  crew_a_km?: number;
  crew_b_km?: number;
  winner_name: string | null;
  result: "win" | "loss" | "draw";
  start_date: string;
  end_date: string;
}

export default function VersusPage() {
  const router = useRouter();
  const [mainTab, setMainTab] = useState<MainTab>("crewBattle");

  const [me, setMe] = useState<AuthUser | null>(null);

  // Battles state
  const [battles, setBattles] = useState<ActiveBattle[]>([]);
  const [teamDetails, setTeamDetails] = useState<Record<number, TeamDetail>>({});
  const [battlesLoading, setBattlesLoading] = useState(false);

  // Internal past battles
  const [pastInternalBattles, setPastInternalBattles] = useState<PastBattle[]>([]);
  const [pastInternalLoading, setPastInternalLoading] = useState(false);

  // Crew battle history
  const [crewBattleHistory, setCrewBattleHistory] = useState<CrewBattleHistory[]>([]);
  const [crewBattleHistoryLoading, setCrewBattleHistoryLoading] = useState(false);

  const fetchActiveBattles = useCallback(async (user: AuthUser) => {
    if (battles.length > 0) return;
    setBattlesLoading(true);
    try {
      const res = await fetch(`${API_BASE}/crews/battles/my-active/?user_id=${user.id}`, { cache: "no-store" });
      const data: ActiveBattle[] = await res.json();
      setBattles(data);
      const details: Record<number, TeamDetail> = {};
      for (const b of data) {
        if (b.battle_type === "internal") {
          try {
            const r = await fetch(`${API_BASE}/crews/battle-teams/by-battle/?battle=${b.battle_id}`, { cache: "no-store" });
            details[b.battle_id] = await r.json();
          } catch {}
        }
      }
      setTeamDetails(details);
    } catch {}
    setBattlesLoading(false);
  }, [battles.length]);

  const fetchPastInternalBattles = useCallback(async (user: AuthUser) => {
    if (!user.crew) return;
    setPastInternalLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/crews/battles/?crew_a=${user.crew}&battle_type=internal`,
        { cache: "no-store" }
      );
      const data = await res.json();
      const all: PastBattle[] = Array.isArray(data) ? data : data.results ?? [];
      const now = new Date().toISOString().slice(0, 10);
      setPastInternalBattles(all.filter((b) => b.end_date < now));
    } catch {}
    setPastInternalLoading(false);
  }, []);

  const fetchCrewBattleHistory = useCallback(async (user: AuthUser) => {
    if (!user.crew) return;
    setCrewBattleHistoryLoading(true);
    try {
      const res = await fetch(`${API_BASE}/crews/battles/crew-history/?crew_id=${user.crew}`, { cache: "no-store" });
      const data = await res.json();
      const all: CrewBattleHistory[] = Array.isArray(data) ? data : data.results ?? [];
      setCrewBattleHistory(all.slice(0, 10));
    } catch {
      setCrewBattleHistory([]);
    }
    setCrewBattleHistoryLoading(false);
  }, []);

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored) return;
    getUserProfile(stored.id)
      .then((data) => {
        setMe(data);
        saveUser(data);
        fetchActiveBattles(data);
        fetchCrewBattleHistory(data);
      })
      .catch(() => {
        setMe(stored);
        fetchActiveBattles(stored);
        fetchCrewBattleHistory(stored);
      });
  }, [fetchActiveBattles, fetchCrewBattleHistory]);

  const handleMainTabChange = (newTab: MainTab) => {
    setMainTab(newTab);
    if (newTab === "crewBattle" && me) {
      fetchActiveBattles(me);
      fetchCrewBattleHistory(me);
    } else if (newTab === "internal" && me) {
      fetchActiveBattles(me);
      fetchPastInternalBattles(me);
    }
  };

  return (
    <AppShell>
      <TopBar title="⚔️ 대항전" settingsButton />
      <div className="p-4">
        {/* Main Tabs */}
        <div className="flex gap-1 mb-4">
          {([
            ["crewBattle", "크루대결현황"],
            ["internal", "내부 팀전"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => handleMainTabChange(key)}
              className={`flex-1 text-center py-2 rounded-lg text-[10px] font-bold leading-tight ${
                mainTab === key ? "bg-[var(--primary)] text-white" : "bg-gray-200 text-gray-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ===== 크루대결현황 탭 ===== */}
        {mainTab === "crewBattle" && (
          <div className="space-y-4">
            {/* 운영자 + 대결 미진행 시 대결 찾기 버튼 */}
            {me?.role === "operator" && !battles.some((b) => b.battle_type === "external") && (
              <button
                onClick={() => router.push("/operator/battle-external")}
                className="w-full rounded-xl py-3 text-sm font-bold text-white active:scale-95 transition-transform"
                style={{ background: "linear-gradient(135deg, #FF5722, #FF8A65)" }}
              >
                ⚔️ 대결 크루 찾기
              </button>
            )}

            {/* Active external battles */}
            <p className="text-xs font-bold text-gray-600">⚔️ 진행 중인 크루대항전</p>
            {battlesLoading ? (
              <div className="text-center text-gray-400 text-sm py-4">불러오는 중...</div>
            ) : battles.filter((b) => b.battle_type === "external").length === 0 ? (
              <div className="bg-white rounded-xl p-4 shadow-sm text-center">
                <p className="text-gray-400 text-sm">진행 중인 크루 간 대결이 없습니다</p>
              </div>
            ) : (
              battles.filter((b) => b.battle_type === "external").map((b) => {
                const isTeamA = b.my_team === "A";
                const myTeamKm = isTeamA ? b.team_a_km : b.team_b_km;
                const otherTeamKm = isTeamA ? b.team_b_km : b.team_a_km;
                const myTeamLabel = isTeamA ? (b.crew_a_name || "A팀") : (b.crew_b_name || "B팀");
                const otherTeamLabel = isTeamA ? (b.crew_b_name || "B팀") : (b.crew_a_name || "A팀");

                return (
                  <BattleCard
                    key={b.battle_id}
                    battleName={b.battle_name}
                    battleType="external"
                    myTeamLabel={myTeamLabel}
                    otherTeamLabel={otherTeamLabel}
                    myTeamKm={myTeamKm}
                    otherTeamKm={otherTeamKm}
                    daysLeft={b.days_left}
                    startDate={b.start_date}
                    endDate={b.end_date}
                    isMyTeamA={isTeamA}
                  />
                );
              })
            )}

            {/* 우리 크루 대항전 이력 */}
            <p className="text-xs font-bold text-gray-600 mt-2">📋 우리 크루 대항전 이력</p>
            {crewBattleHistoryLoading ? (
              <div className="text-center text-gray-400 text-sm py-4">불러오는 중...</div>
            ) : crewBattleHistory.length === 0 ? (
              <div className="bg-white rounded-xl p-4 shadow-sm text-center">
                <p className="text-gray-400 text-sm">대항전 이력이 없습니다</p>
              </div>
            ) : (
              <div className="space-y-2">
                {crewBattleHistory.map((h) => (
                  <div key={h.battle_id} className="bg-white rounded-xl px-4 py-3 shadow-sm flex items-center gap-3">
                    <div className={`text-xs font-extrabold px-2 py-1 rounded-lg flex-shrink-0 ${
                      h.result === "win" ? "bg-blue-100 text-blue-700"
                      : h.result === "loss" ? "bg-red-100 text-red-500"
                      : "bg-gray-100 text-gray-500"
                    }`}>
                      {h.result === "win" ? "승" : h.result === "loss" ? "패" : "무"}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold">{h.crew_a_name} vs {h.crew_b_name}</div>
                      <div className="text-[10px] text-gray-400">{h.start_date} ~ {h.end_date}</div>
                      {(h.crew_a_km !== undefined && h.crew_b_km !== undefined) && (
                        <div className="text-[11px] font-bold text-gray-500 mt-0.5">
                          {h.crew_a_km}km vs {h.crew_b_km}km
                        </div>
                      )}
                    </div>
                    {h.winner_name && (
                      <div className="text-[10px] font-bold text-green-600">{h.winner_name} 승</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== 내부 팀전 탭 ===== */}
        {mainTab === "internal" && (
          <div className="space-y-4">
            {battlesLoading ? (
              <div className="text-center text-gray-400 text-sm py-8">불러오는 중...</div>
            ) : (
              <>
                <p className="text-xs font-bold text-gray-600">🎲 진행 중인 내부 팀전</p>
                {battles.filter((b) => b.battle_type === "internal").length === 0 ? (
                  <div className="bg-white rounded-xl p-4 shadow-sm text-center">
                    <p className="text-gray-400 text-sm">진행 중인 내부 팀전이 없습니다</p>
                  </div>
                ) : (
                  battles.filter((b) => b.battle_type === "internal").map((b) => {
                    const isTeamA = b.my_team === "A";
                    const detail = teamDetails[b.battle_id];
                    const tALabel = b.team_a_label || "A팀";
                    const tBLabel = b.team_b_label || "B팀";
                    const myTeamKm = isTeamA ? b.team_a_km : b.team_b_km;
                    const otherTeamKm = isTeamA ? b.team_b_km : b.team_a_km;
                    const myTeamLabel = isTeamA ? tALabel : tBLabel;
                    const otherTeamLabel = isTeamA ? tBLabel : tALabel;

                    return (
                      <div key={b.battle_id}>
                        <BattleCard
                          battleName={b.battle_name}
                          battleType="internal"
                          myTeamLabel={myTeamLabel}
                          otherTeamLabel={otherTeamLabel}
                          myTeamKm={myTeamKm}
                          otherTeamKm={otherTeamKm}
                          daysLeft={b.days_left}
                          startDate={b.start_date}
                          endDate={b.end_date}
                          isMyTeamA={isTeamA}
                        />
                        {detail && (
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <div className="bg-blue-50 rounded-lg p-2">
                              <div className="text-[10px] font-bold text-blue-700 mb-1">{tALabel} ({detail.team_a.length}명)</div>
                              {detail.team_a.map((m) => (
                                <div key={m.id} className="flex items-center gap-1 py-0.5">
                                  <div className="w-4 h-4 rounded-full text-[8px] font-bold text-white flex items-center justify-center flex-shrink-0" style={{ background: m.profile_color || "#1565C0" }}>
                                    {m.username.charAt(0)}
                                  </div>
                                  <span className={`text-[10px] ${m.id === me?.id ? "font-bold text-[var(--primary)]" : ""}`}>
                                    {m.id === me?.id ? `${m.username} (나)` : m.username}
                                  </span>
                                </div>
                              ))}
                            </div>
                            <div className="bg-orange-50 rounded-lg p-2">
                              <div className="text-[10px] font-bold text-orange-600 mb-1">{tBLabel} ({detail.team_b.length}명)</div>
                              {detail.team_b.map((m) => (
                                <div key={m.id} className="flex items-center gap-1 py-0.5">
                                  <div className="w-4 h-4 rounded-full text-[8px] font-bold text-white flex items-center justify-center flex-shrink-0" style={{ background: m.profile_color || "#FF5722" }}>
                                    {m.username.charAt(0)}
                                  </div>
                                  <span className={`text-[10px] ${m.id === me?.id ? "font-bold text-[var(--primary)]" : ""}`}>
                                    {m.id === me?.id ? `${m.username} (나)` : m.username}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}

                <p className="text-xs font-bold text-gray-600 mt-2">📋 지난 내부 팀전</p>
                {pastInternalLoading ? (
                  <div className="text-center text-gray-400 text-sm py-4">불러오는 중...</div>
                ) : pastInternalBattles.length === 0 ? (
                  <div className="bg-white rounded-xl p-4 shadow-sm text-center">
                    <p className="text-gray-400 text-sm">지난 내부 팀전이 없습니다</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pastInternalBattles.map((b) => {
                      const won = b.winner_crew === me?.crew;
                      const lost = b.winner_crew !== null && b.winner_crew !== me?.crew;
                      return (
                        <div key={b.id} className="bg-white rounded-xl px-4 py-3 shadow-sm flex items-center gap-3">
                          <div className={`text-xs font-extrabold px-2 py-1 rounded-lg ${won ? "bg-blue-100 text-blue-700" : lost ? "bg-red-100 text-red-500" : "bg-gray-100 text-gray-500"}`}>
                            {won ? "승" : lost ? "패" : "무"}
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-semibold">{b.name}</div>
                            <div className="text-[10px] text-gray-400">{b.start_date} ~ {b.end_date}</div>
                          </div>
                          {b.crew_a_km != null && b.crew_b_km != null && (
                            <div className="text-xs font-bold text-gray-500">
                              {fmtKm(b.crew_a_km)}km vs {fmtKm(b.crew_b_km)}km
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
