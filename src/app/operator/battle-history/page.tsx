"use client";
import { API_BASE } from "@/lib/api";import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import TopBar from "@/components/TopBar";
import { getStoredUser, AuthUser } from "@/lib/auth";

interface Battle {
  id: number;
  battle_type: string;
  status: string;
  crew_a: number;
  crew_a_name: string;
  crew_b: number | null;
  crew_b_name: string | null;
  start_date: string;
  end_date: string;
}


export default function BattleHistoryPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [battles, setBattles] = useState<Battle[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [tab, setTab] = useState<"active" | "past">("active");

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored) { router.replace("/"); return; }
    if (stored.role !== "operator") { router.replace("/mypage"); return; }
    setUser(stored);

    // 내 크루가 참여한 대결만 가져오기 (crew_a 또는 crew_b)
    const crewId = stored.crew;
    Promise.all([
      fetch(`${API_BASE}/crews/battles/?crew_a=${crewId}&page_size=100`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`${API_BASE}/crews/battles/?crew_b=${crewId}&page_size=100`, { cache: "no-store" }).then((r) => r.json()),
    ]).then(([dataA, dataB]) => {
      const all = [...(dataA.results ?? []), ...(dataB.results ?? [])];
      // 중복 제거
      const unique = Array.from(new Map(all.map((b: Battle) => [b.id, b])).values());
      setBattles(unique);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [router]);

  if (!user) return null;

  const now = new Date();
  const activeBattles = battles.filter((b) => b.status === "active" || b.status === "pending" || new Date(b.end_date) >= now);
  const pastBattles = battles.filter((b) => b.status === "ended" || (b.status !== "active" && b.status !== "pending" && new Date(b.end_date) < now));
  const displayed = tab === "active" ? activeBattles : pastBattles;

  const statusLabel = (b: Battle) => {
    if (b.status === "active") return { text: "진행중", color: "bg-green-100 text-green-700" };
    if (b.status === "pending") return { text: "대기", color: "bg-yellow-100 text-yellow-700" };
    return { text: "종료", color: "bg-gray-100 text-gray-500" };
  };

  const typeLabel = (b: Battle) => b.battle_type === "internal" ? "🎲 크루 내 팀전" : "⚔️ 크루 간 대결";

  const daysLeft = (b: Battle) => {
    const diff = Math.ceil((new Date(b.end_date).getTime() - now.getTime()) / 86400000);
    return diff > 0 ? `D-${diff}` : "종료";
  };

  return (
    <AppShell>
      <TopBar title="📋 대결/팀전 이력" back />
      <div className="p-4 space-y-4">
        {/* Tabs */}
        <div className="flex gap-1">
          <button
            onClick={() => setTab("active")}
            className={`flex-1 text-center py-2 rounded-lg text-xs font-bold ${
              tab === "active" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-400"
            }`}
          >
            운영중 ({activeBattles.length})
          </button>
          <button
            onClick={() => setTab("past")}
            className={`flex-1 text-center py-2 rounded-lg text-xs font-bold ${
              tab === "past" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-400"
            }`}
          >
            지난 이력 ({pastBattles.length})
          </button>
        </div>

        {loading ? (
          <div className="text-center text-gray-400 text-sm py-8">불러오는 중...</div>
        ) : displayed.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center text-gray-400 text-sm shadow-sm">
            {tab === "active" ? "진행 중인 대결이 없습니다" : "지난 대결 이력이 없습니다"}
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map((b) => {
              const st = statusLabel(b);
              return (
                <div key={b.id} className="bg-white rounded-xl p-4 shadow-sm">
                  {/* Header */}
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-bold">{typeLabel(b)}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.color}`}>
                        {st.text}
                      </span>
                      {b.status !== "ended" && (
                        <span className="text-[10px] font-bold text-red-500">{daysLeft(b)}</span>
                      )}
                    </div>
                  </div>

                  {/* Teams */}
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex-1 text-center">
                      <div className="text-xs font-bold text-[var(--primary)]">{b.crew_a_name}</div>
                    </div>
                    {b.crew_b_name && (
                      <>
                        <div className="text-xs text-gray-300 font-bold">VS</div>
                        <div className="flex-1 text-center">
                          <div className="text-xs font-bold text-[var(--op)]">{b.crew_b_name}</div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Period */}
                  <div className="text-[10px] text-gray-400 text-center">
                    {b.start_date?.slice(0, 10)} ~ {b.end_date?.slice(0, 10)}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-3">
                    {b.battle_type === "internal" && b.status !== "ended" && (
                      <button
                        onClick={() => router.push(`/operator/teams?battle=${b.id}`)}
                        className="flex-1 bg-blue-50 text-blue-600 text-xs font-bold rounded-lg py-2"
                      >
                        팀 배정 관리 →
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        if (!confirm("이 대결을 삭제하시겠습니까? 팀 배정 데이터도 함께 삭제됩니다.")) return;
                        setDeleting(b.id);
                        try {
                          const res = await fetch(`${API_BASE}/crews/battles/${b.id}/`, { method: "DELETE" });
                          if (!res.ok && res.status !== 204) throw new Error("삭제 실패");
                          setBattles((prev) => prev.filter((x) => x.id !== b.id));
                        } catch (err: any) {
                          alert(`오류: ${err.message}`);
                        } finally {
                          setDeleting(null);
                        }
                      }}
                      disabled={deleting === b.id}
                      className="bg-red-50 text-red-500 text-xs font-bold rounded-lg py-2 px-4"
                    >
                      {deleting === b.id ? "삭제중..." : "삭제"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
