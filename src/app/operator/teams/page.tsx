"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import TopBar from "@/components/TopBar";
import { getStoredUser, AuthUser } from "@/lib/auth";

interface Member {
  id: number;
  username: string;
  profile_color: string;
}

interface Battle {
  id: number;
  battle_type: string;
  start_date: string;
  end_date: string;
  crew_a_name?: string;
}

const API_BASE = "http://localhost:8000/api";

export default function OperatorTeamsPage() {
  return (
    <Suspense fallback={<div className="text-center py-8 text-gray-400">로딩 중...</div>}>
      <OperatorTeams />
    </Suspense>
  );
}

function OperatorTeams() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const battleIdParam = searchParams.get("battle");

  const [user, setUser] = useState<AuthUser | null>(null);
  const [battles, setBattles] = useState<Battle[]>([]);
  const [selectedBattle, setSelectedBattle] = useState(battleIdParam || "");
  const [teamA, setTeamA] = useState<Member[]>([]);
  const [teamB, setTeamB] = useState<Member[]>([]);
  const [unassigned, setUnassigned] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [battlesLoading, setBattlesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored) { router.replace("/"); return; }
    if (stored.role !== "operator") { router.replace("/mypage"); return; }
    setUser(stored);

    fetch(`${API_BASE}/crews/battles/`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        const list: Battle[] = (data.results ?? []).filter((b: Battle) => b.battle_type === "internal");
        setBattles(list);
        setBattlesLoading(false);
        if (!selectedBattle && list.length > 0) setSelectedBattle(String(list[0].id));
      })
      .catch((err) => { setBattlesLoading(false); setError(err.message); });
  }, [router]);

  useEffect(() => {
    if (!selectedBattle || !user?.crew) return;
    setLoading(true);
    setError(null);

    // 팀 배정 + 크루 멤버 동시 조회
    Promise.all([
      fetch(`${API_BASE}/crews/battle-teams/by-battle/?battle=${selectedBattle}`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`${API_BASE}/crews/crews/${user.crew}/members/`, { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([teamData, membersData]) => {
        const aMembers: Member[] = teamData.team_a || [];
        const bMembers: Member[] = teamData.team_b || [];
        setTeamA(aMembers);
        setTeamB(bMembers);

        // 배정된 유저 ID 목록
        const assignedIds = new Set([...aMembers.map((m: Member) => m.id), ...bMembers.map((m: Member) => m.id)]);

        // 미배정 크루원
        const allMembers: Member[] = (Array.isArray(membersData) ? membersData : membersData.results ?? [])
          .map((m: any) => ({ id: m.id, username: m.username, profile_color: m.profile_color }));
        setUnassigned(allMembers.filter((m) => !assignedIds.has(m.id)));

        setLoading(false);
        setSaved(false);
      })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [selectedBattle, user]);

  const moveToA = (member: Member, from: "B" | "unassigned") => {
    if (from === "B") setTeamB((prev) => prev.filter((m) => m.id !== member.id));
    else setUnassigned((prev) => prev.filter((m) => m.id !== member.id));
    setTeamA((prev) => [...prev, member]);
    setSaved(false);
  };

  const moveToB = (member: Member, from: "A" | "unassigned") => {
    if (from === "A") setTeamA((prev) => prev.filter((m) => m.id !== member.id));
    else setUnassigned((prev) => prev.filter((m) => m.id !== member.id));
    setTeamB((prev) => [...prev, member]);
    setSaved(false);
  };

  const moveToUnassigned = (member: Member, from: "A" | "B") => {
    if (from === "A") setTeamA((prev) => prev.filter((m) => m.id !== member.id));
    else setTeamB((prev) => prev.filter((m) => m.id !== member.id));
    setUnassigned((prev) => [...prev, member]);
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/crews/battle-teams/bulk-assign/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          battle: parseInt(selectedBattle),
          team_a: teamA.map((m) => m.id),
          team_b: teamB.map((m) => m.id),
        }),
      });
      if (!res.ok) throw new Error("저장 실패");
      setSaved(true);
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  const hasAny = teamA.length > 0 || teamB.length > 0 || unassigned.length > 0;

  const MemberCard = ({ member, actions }: { member: Member; actions: React.ReactNode }) => (
    <div className="mb-2 bg-white rounded-lg p-2">
      <div className="flex items-center gap-1.5 mb-1">
        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
          style={{ background: member.profile_color || "#999" }}>
          {member.username.charAt(0)}
        </div>
        <span className="text-xs flex-1 truncate font-medium">{member.username}</span>
      </div>
      <div className="flex gap-1">{actions}</div>
    </div>
  );

  return (
    <AppShell>
      <TopBar title="🏳️ 팀 배정 관리" back />
      <div className="p-4 space-y-4">
        <div className="rounded-xl p-4 text-white shadow" style={{ background: "linear-gradient(135deg, #1565C0, #1976D2)" }}>
          <div className="font-bold text-base">팀 배정 관리</div>
          <div className="text-xs opacity-70 mt-0.5">멤버를 A/B팀으로 배정하세요. 신규 합류자도 여기서 배정 가능합니다.</div>
        </div>

        {/* Battle selector */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <label className="text-xs text-gray-500 font-semibold">대결 선택</label>
          {battlesLoading ? (
            <div className="mt-2 text-sm text-gray-400">불러오는 중...</div>
          ) : battles.length === 0 ? (
            <div className="mt-2 text-sm text-gray-400">진행 중인 팀전이 없습니다.</div>
          ) : (
            <select
              value={selectedBattle}
              onChange={(e) => setSelectedBattle(e.target.value)}
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {battles.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.crew_a_name || `대결 #${b.id}`} — {b.start_date?.slice(0, 10)} ~ {b.end_date?.slice(0, 10)}
                </option>
              ))}
            </select>
          )}
        </div>

        {loading && <div className="bg-white rounded-xl p-8 text-center text-gray-400 text-sm shadow-sm">불러오는 중...</div>}
        {error && <div className="bg-red-50 rounded-xl p-6 text-center text-red-500 text-sm shadow-sm">{error}</div>}

        {!loading && !error && hasAny && (
          <>
            {/* 미배정 멤버 */}
            {unassigned.length > 0 && (
              <div className="bg-yellow-50 rounded-xl p-3 border border-yellow-200">
                <div className="text-xs font-bold text-yellow-700 mb-2">
                  ⚠️ 미배정 ({unassigned.length}명)
                </div>
                {unassigned.map((m) => (
                  <MemberCard key={m.id} member={m} actions={
                    <>
                      <button onClick={() => moveToA(m, "unassigned")} className="flex-1 text-[10px] font-bold py-1 rounded bg-blue-50 text-blue-700">
                        A팀
                      </button>
                      <button onClick={() => moveToB(m, "unassigned")} className="flex-1 text-[10px] font-bold py-1 rounded bg-orange-50 text-orange-600">
                        B팀
                      </button>
                    </>
                  } />
                ))}
              </div>
            )}

            {/* A/B 팀 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 rounded-xl p-3">
                <div className="text-xs font-bold text-blue-700 mb-2">A팀 ({teamA.length}명)</div>
                {teamA.length === 0 ? (
                  <div className="text-xs text-blue-300 text-center py-3">비어있음</div>
                ) : (
                  teamA.map((m) => (
                    <MemberCard key={m.id} member={m} actions={
                      <>
                        <button onClick={() => moveToB(m, "A")} className="flex-1 text-[10px] font-bold py-1 rounded bg-orange-50 text-orange-600">
                          →B
                        </button>
                        <button onClick={() => moveToUnassigned(m, "A")} className="flex-1 text-[10px] font-bold py-1 rounded bg-gray-100 text-gray-500">
                          해제
                        </button>
                      </>
                    } />
                  ))
                )}
              </div>

              <div className="bg-orange-50 rounded-xl p-3">
                <div className="text-xs font-bold text-orange-600 mb-2">B팀 ({teamB.length}명)</div>
                {teamB.length === 0 ? (
                  <div className="text-xs text-orange-300 text-center py-3">비어있음</div>
                ) : (
                  teamB.map((m) => (
                    <MemberCard key={m.id} member={m} actions={
                      <>
                        <button onClick={() => moveToA(m, "B")} className="flex-1 text-[10px] font-bold py-1 rounded bg-blue-50 text-blue-700">
                          ←A
                        </button>
                        <button onClick={() => moveToUnassigned(m, "B")} className="flex-1 text-[10px] font-bold py-1 rounded bg-gray-100 text-gray-500">
                          해제
                        </button>
                      </>
                    } />
                  ))
                )}
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3 rounded-xl font-bold text-sm text-white shadow"
              style={{ background: saved ? "#43A047" : "#1565C0" }}
            >
              {saving ? "저장 중..." : saved ? "✓ 저장 완료" : `팀 배정 저장 (미배정 ${unassigned.length}명)`}
            </button>
          </>
        )}

        {!loading && !error && !hasAny && selectedBattle && (
          <div className="bg-white rounded-xl p-8 text-center text-gray-400 text-sm shadow-sm">
            크루에 멤버가 없습니다.
          </div>
        )}
      </div>
    </AppShell>
  );
}
