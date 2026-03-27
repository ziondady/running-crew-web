"use client";
import { API_BASE } from "@/lib/api";import { useEffect, useState } from "react";

interface CrewRankItem {
  id: number;
  name: string;
  wins: number;
  losses: number;
  battle_points: number;
  territory_segments: number;
  territory_points: number;
  total_points: number;
}

interface ScoreLog {
  type: string;
  label: string;
  points: number;
  date: string;
}


export default function CrewRanking({ myCrewId }: { myCrewId?: number | null }) {
  const [ranking, setRanking] = useState<CrewRankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [scoreLogs, setScoreLogs] = useState<Record<number, ScoreLog[]>>({});
  const [logLoading, setLogLoading] = useState<Record<number, boolean>>({});

  useEffect(() => {
    fetch(`${API_BASE}/crews/battles/crew-ranking/`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => { setRanking(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleExpand = (crewId: number) => {
    if (expandedId === crewId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(crewId);
    if (!scoreLogs[crewId]) {
      setLogLoading((p) => ({ ...p, [crewId]: true }));
      fetch(`${API_BASE}/crews/battles/crew-score-log/?crew_id=${crewId}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((data) => {
          setScoreLogs((p) => ({ ...p, [crewId]: Array.isArray(data) ? data : [] }));
          setLogLoading((p) => ({ ...p, [crewId]: false }));
        })
        .catch(() => {
          setScoreLogs((p) => ({ ...p, [crewId]: [] }));
          setLogLoading((p) => ({ ...p, [crewId]: false }));
        });
    }
  };

  if (loading) return <div className="text-center text-gray-400 text-sm py-8">로딩 중...</div>;
  if (ranking.length === 0) return <div className="bg-white rounded-xl p-4 shadow-sm text-center text-gray-400 text-sm">크루 랭킹 정보가 없습니다</div>;

  const typeStyle: Record<string, { color: string; icon: string }> = {
    battle_win: { color: "text-blue-600", icon: "⚔️" },
    battle_loss: { color: "text-red-400", icon: "💔" },
    territory_claim: { color: "text-green-600", icon: "🗺️" },
    territory_reinforce: { color: "text-blue-500", icon: "🏰" },
    territory_takeover: { color: "text-orange-500", icon: "⚔️" },
    territory_decay: { color: "text-gray-400", icon: "📉" },
  };

  return (
    <div className="space-y-2">
      {ranking.map((crew, idx) => {
        const isMyCrew = myCrewId === crew.id;
        const isExpanded = expandedId === crew.id;
        const logs = scoreLogs[crew.id];
        const isLogLoading = logLoading[crew.id];
        const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : "";

        return (
          <div key={crew.id} className={`bg-white rounded-xl shadow-sm overflow-hidden ${isMyCrew ? "border-2 border-orange-200" : ""}`}>
            <button
              onClick={() => handleExpand(crew.id)}
              className="w-full flex items-center gap-2 px-4 py-3 text-left"
            >
              <span className="text-sm font-extrabold text-[var(--primary)] w-5 flex-shrink-0">
                {medal || idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-semibold truncate ${isMyCrew ? "text-[var(--primary)]" : ""}`}>
                  {isMyCrew ? `${crew.name} (내 크루)` : crew.name}
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">
                  <span className="text-blue-600">{crew.wins}승</span>
                  {" / "}
                  <span className="text-red-400">{crew.losses}패</span>
                  {" · "}
                  <span className="text-green-600">{crew.territory_segments}구간</span>
                </div>
              </div>
              <span className="text-sm font-extrabold text-orange-500">{crew.total_points}pt</span>
              <span className="text-gray-300 text-xs">{isExpanded ? "▲" : "▼"}</span>
            </button>

            {isExpanded && (
              <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
                {/* 점수 구성 */}
                <div className="flex gap-2 mb-3">
                  <div className="flex-1 bg-white rounded-lg p-2 text-center">
                    <div className="text-xs font-bold text-blue-600">{crew.battle_points}</div>
                    <div className="text-[9px] text-gray-400">대항전</div>
                  </div>
                  <div className="flex-1 bg-white rounded-lg p-2 text-center">
                    <div className="text-xs font-bold text-green-600">{crew.territory_points}</div>
                    <div className="text-[9px] text-gray-400">점령전</div>
                  </div>
                  <div className="flex-1 bg-white rounded-lg p-2 text-center">
                    <div className="text-xs font-bold text-orange-500">{crew.total_points}</div>
                    <div className="text-[9px] text-gray-400">합계</div>
                  </div>
                </div>

                {/* 최근 점수 이력 */}
                <div className="text-[10px] font-bold text-gray-500 mb-2">최근 점수 이력</div>
                {isLogLoading ? (
                  <div className="text-center text-gray-400 text-xs py-2">로딩 중...</div>
                ) : !logs || logs.length === 0 ? (
                  <div className="text-center text-gray-400 text-xs py-2">이력 없음</div>
                ) : (
                  <div className="space-y-1">
                    {logs.map((log, i) => {
                      const style = typeStyle[log.type] || { color: "text-gray-500", icon: "📌" };
                      return (
                        <div key={i} className="flex items-center gap-2 bg-white rounded-lg px-2 py-1.5">
                          <span className="text-xs">{style.icon}</span>
                          <span className={`flex-1 text-[10px] ${style.color}`}>{log.label}</span>
                          {log.points > 0 && (
                            <span className="text-[10px] font-bold text-orange-500">+{log.points}pt</span>
                          )}
                          <span className="text-[9px] text-gray-300">{log.date}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
