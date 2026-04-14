"use client";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import AppShell from "@/components/AppShell";
import TopBar from "@/components/TopBar";
import { getTerritories, getTerritoryRanking, getTerritoryLogs, getTerritoryCells } from "@/lib/api";
import { getStoredUser, AuthUser } from "@/lib/auth";

const TerritoryMap = dynamic(() => import("@/components/TerritoryMap"), { ssr: false });

interface TerritoryItem {
  id: number;
  user: number;
  username: string;
  user_color: string;
  crew_id: number | null;
  crew_name: string | null;
  durability: number;
  path_data: { lat: number; lng: number }[];
  last_run_at: string;
}

interface CellItem {
  id: number;
  cell_key: string;
  user: number;
  username: string;
  user_color: string;
  crew_id: number | null;
  crew_name: string | null;
  durability: number;
  bounds: { south: number; north: number; west: number; east: number };
}

interface RankItem {
  crew_id: number;
  crew_name: string;
  segments: number; // 호환: 셀 개수
  cells?: number;
  rank: number;
}

interface LogItem {
  id: number;
  username: string;
  action: string;
  durability: number;
  cell_count?: number;
  created_at: string;
}


export default function TerritoryPage() {
  const [tab, setTab] = useState<"map" | "detail" | "alert">("map");
  const [territories, setTerritories] = useState<TerritoryItem[]>([]);
  const [cells, setCells] = useState<CellItem[]>([]);
  const [myTerritories, setMyTerritories] = useState<TerritoryItem[]>([]);
  const [ranking, setRanking] = useState<RankItem[]>([]);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [me, setMe] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activityLogLimit, setActivityLogLimit] = useState(10);

  useEffect(() => {
    const stored = getStoredUser();
    if (stored) setMe(stored);

    Promise.all([
      getTerritories().catch(() => []),
      getTerritoryRanking().catch(() => []),
      getTerritoryLogs(stored?.id).catch(() => []),
      getTerritoryCells().catch(() => []),
    ]).then(([allT, rank, logData, cellData]) => {
      const tList = Array.isArray(allT) ? allT : allT.results ?? [];
      setTerritories(tList);
      setMyTerritories(tList.filter((t: TerritoryItem) => t.user === stored?.id));
      setRanking(Array.isArray(rank) ? rank : rank.results ?? []);
      setLogs(logData);
      setCells(Array.isArray(cellData) ? cellData : cellData.results ?? []);
      setLoading(false);
    });
  }, []);

  const mySegments = myTerritories.length;
  const myRankEntry = ranking.find((r) => r.crew_id === me?.crew);

  // 내구도 분포
  const durDist = [5, 4, 3, 2, 1].map((lv) => ({
    lv,
    count: myTerritories.filter((t) => t.durability === lv).length,
  }));
  const durColors: Record<number, string> = { 5: "#1B5E20", 4: "#2E7D32", 3: "#43A047", 2: "#66BB6A", 1: "#A5D6A7" };
  const now = Date.now();

  const actionLabels: Record<string, { label: string; color: string; border: string }> = {
    claim: { label: "🎉 신규 셀 점령!", color: "text-green-600", border: "border-green-500" },
    reinforce: { label: "🏰 셀 내구도 강화", color: "text-blue-600", border: "border-blue-500" },
    takeover: { label: "⚔️ 셀 탈환당함!", color: "text-red-500", border: "border-red-500" },
  };

  return (
    <AppShell>
      <TopBar title="🗺️ 점령전" settingsButton />
      <div className="p-3">
        <div className="flex gap-1 mb-3">
          {([["map", "전체 지도"], ["detail", "점령전 현황"], ["alert", "알림"]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 text-center py-2 rounded-lg text-xs font-bold ${
                tab === key ? "bg-green-600 text-white" : "bg-gray-200 text-gray-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading && <div className="text-center text-gray-400 text-sm py-8">로딩 중...</div>}

        {!loading && tab === "map" && (
          <>
            {/* Leaflet Map */}
            <TerritoryMap territories={territories} cells={cells} myUserId={me?.id} myCrewId={me?.crew} />

            {/* Legend */}
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
              {(() => {
                const crewSet = new Map<number, string>();
                territories.forEach(t => {
                  if (t.crew_id && t.crew_name && !crewSet.has(t.crew_id)) {
                    crewSet.set(t.crew_id, t.crew_name);
                  }
                });
                const COLORS = ["#FF5722","#1565C0","#2E7D32","#9C27B0","#F57C00","#00838F","#C62828","#4527A0"];
                const entries = [...crewSet.entries()];
                // Sort so my crew is first
                entries.sort((a, b) => (a[0] === me?.crew ? -1 : b[0] === me?.crew ? 1 : 0));
                let idx = 0;
                const colorMap: Record<number, string> = {};
                if (me?.crew) colorMap[me.crew] = COLORS[0];
                idx = 1;
                entries.forEach(([cid]) => {
                  if (!colorMap[cid]) { colorMap[cid] = COLORS[idx % COLORS.length]; idx++; }
                });
                return entries.map(([cid, name]) => (
                  <div key={cid} className="flex items-center gap-1 text-[10px] text-gray-500">
                    <div className="w-5 h-1 rounded" style={{ backgroundColor: colorMap[cid] }} />
                    {name}{cid === me?.crew ? " (나)" : ""}
                  </div>
                ));
              })()}
              <div className="flex items-center gap-1 text-[10px] text-gray-500">
                진한 색 = 높은 내구도
              </div>
            </div>

            {/* Stats */}
            <div className="flex gap-2 mt-3">
              <div className="flex-1 bg-orange-50 rounded-lg p-3 text-center">
                <div className="text-lg font-extrabold text-[var(--primary)]">{cells.filter(c => c.user === me?.id).length}개</div>
                <div className="text-[10px] text-gray-400">내 점령 셀</div>
              </div>
              <div className="flex-1 bg-green-50 rounded-lg p-3 text-center">
                <div className="text-lg font-extrabold text-green-600">{cells.length}개</div>
                <div className="text-[10px] text-gray-400">전체 점령 셀</div>
              </div>
              <div className="flex-1 bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-lg font-extrabold text-[var(--op)]">{myRankEntry?.rank || "-"}위</div>
                <div className="text-[10px] text-gray-400">전체 랭킹</div>
              </div>
            </div>
          </>
        )}

        {!loading && tab === "detail" && (
          <>
            {/* 점령전 현황 헤더 */}
            <div className="rounded-xl p-4 text-white mb-3" style={{ background: "linear-gradient(135deg, #2E7D32, #4CAF50)" }}>
              <div className="text-sm font-bold">{me?.crew_name || "내 크루"}</div>
              <div className="text-xs opacity-80 mt-1">달린 셀이 자동 점령됩니다</div>
              <div className="grid grid-cols-3 gap-2 mt-3">
                <div className="text-center">
                  <div className="text-xl font-extrabold">{cells.filter(c => c.user === me?.id).length}</div>
                  <div className="text-[9px] opacity-80">내 점령 셀</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-extrabold">{myRankEntry?.rank || "-"}</div>
                  <div className="text-[9px] opacity-80">전체 크루 순위</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-extrabold">{durDist.find((d) => d.lv === 5)?.count || 0}</div>
                  <div className="text-[9px] opacity-80">Lv.5 셀</div>
                </div>
              </div>
            </div>

            {/* 내구도 분포 — 쉬운 설명 추가 */}
            <div className="bg-white rounded-xl p-4 shadow-sm mb-3">
              <h3 className="text-sm font-bold text-green-700 mb-1">🏰 셀 내구도 분포</h3>
              <p className="text-[10px] text-gray-400 mb-3">내구도가 높을수록 다른 크루가 빼앗기 어렵습니다</p>
              {mySegments === 0 ? (
                <p className="text-xs text-gray-400 text-center py-2">크루원이 GPS로 달리면 점령이 시작됩니다</p>
              ) : (
                durDist.map((item) => (
                  <div key={item.lv} className="flex items-center gap-2 py-1">
                    <span className="text-xs font-bold w-8">Lv.{item.lv}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${mySegments > 0 ? (item.count / mySegments) * 100 : 0}%`, backgroundColor: durColors[item.lv] }} />
                    </div>
                    <span className="text-xs font-semibold w-10 text-right">{item.count}개</span>
                  </div>
                ))
              )}
            </div>

            {/* 점령 활동 이력 */}
            <div className="bg-white rounded-xl p-4 shadow-sm mb-3">
              <h3 className="text-sm font-bold text-gray-700 mb-1">📋 점령 활동 이력</h3>
              {logs.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-2">활동 이력이 없습니다</p>
              ) : (
                <>
                  <div className="space-y-2">
                    {logs.slice(0, activityLogLimit).map((log) => {
                      const style = actionLabels[log.action] || actionLabels.claim;
                      const timeAgo = Math.floor((now - new Date(log.created_at).getTime()) / 3600000);
                      return (
                        <div key={log.id} className={`rounded-lg p-3 border-l-4 ${style.border} bg-gray-50`}>
                          <div className="flex justify-between items-center">
                            <span className={`text-xs font-extrabold ${style.color}`}>{style.label}</span>
                            <span className="text-[10px] text-gray-400">{timeAgo < 1 ? "방금" : `${timeAgo}시간 전`}</span>
                          </div>
                          <p className="text-xs text-gray-600 mt-1">
                            <strong>{log.username}</strong> — Lv.{log.durability}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  {logs.length > activityLogLimit && (
                    <button
                      onClick={() => setActivityLogLimit((prev) => prev + 10)}
                      className="w-full mt-3 py-2 text-xs font-bold text-gray-500 bg-gray-100 rounded-lg active:scale-95 transition-transform"
                    >
                      더보기
                    </button>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {!loading && tab === "alert" && (
          <div className="space-y-2">
            {logs.length === 0 ? (
              <div className="text-center text-gray-400 text-sm py-8">알림이 없습니다</div>
            ) : (
              logs.map((log) => {
                const style = actionLabels[log.action] || actionLabels.claim;
                const timeAgo = Math.floor((now - new Date(log.created_at).getTime()) / 3600000);
                return (
                  <div key={log.id} className={`bg-white rounded-xl p-3 shadow-sm border-l-4 ${style.border}`}>
                    <div className="flex justify-between items-center">
                      <span className={`text-xs font-extrabold ${style.color}`}>{style.label}</span>
                      <span className="text-[10px] text-gray-400">{timeAgo < 1 ? "방금" : `${timeAgo}시간 전`}</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      <strong>{log.username}</strong> — Lv.{log.durability}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
