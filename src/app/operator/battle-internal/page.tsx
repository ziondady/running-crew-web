"use client";
import { API_BASE } from "@/lib/api";import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import TopBar from "@/components/TopBar";
import { getStoredUser, AuthUser } from "@/lib/auth";

interface Member {
  id: number;
  username: string;
  profile_color: string;
  monthly_km: number;
}


type AssignMode = "random" | "manual";

export default function OperatorBattleInternal() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form
  const [battleName, setBattleName] = useState("");
  const [teamALabel, setTeamALabel] = useState("A팀");
  const [teamBLabel, setTeamBLabel] = useState("B팀");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [assignMode, setAssignMode] = useState<AssignMode>("random");
  const [teamA, setTeamA] = useState<Member[]>([]);
  const [teamB, setTeamB] = useState<Member[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored) { router.replace("/"); return; }
    if (stored.role !== "operator") { router.replace("/mypage"); return; }
    setUser(stored);

    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    setStartDate(today.toISOString().split("T")[0]);
    setEndDate(nextWeek.toISOString().split("T")[0]);

    if (!stored.crew) {
      setError("소속된 크루가 없습니다.");
      setLoading(false);
      return;
    }

    fetch(`${API_BASE}/crews/crews/${stored.crew}/members/`, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const list: Member[] = Array.isArray(data) ? data : data.results ?? [];
        setMembers(list);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [router]);

  const handleRandomAssign = () => {
    const shuffled = [...members].sort(() => Math.random() - 0.5);
    const half = Math.ceil(shuffled.length / 2);
    setTeamA(shuffled.slice(0, half));
    setTeamB(shuffled.slice(half));
  };

  const moveToTeam = (member: Member, toTeam: "A" | "B") => {
    if (toTeam === "A") {
      setTeamB((prev) => prev.filter((m) => m.id !== member.id));
      setTeamA((prev) => [...prev.filter((m) => m.id !== member.id), member]);
    } else {
      setTeamA((prev) => prev.filter((m) => m.id !== member.id));
      setTeamB((prev) => [...prev.filter((m) => m.id !== member.id), member]);
    }
  };

  const getUnassigned = () => {
    const assignedIds = new Set([...teamA, ...teamB].map((m) => m.id));
    return members.filter((m) => !assignedIds.has(m.id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!startDate || !endDate) { setSubmitError("대결 기간을 설정해 주세요."); return; }
    if (new Date(endDate) <= new Date(startDate)) {
      setSubmitError("종료일은 시작일보다 이후여야 합니다.");
      return;
    }

    let finalTeamA = teamA;
    let finalTeamB = teamB;

    if (assignMode === "random") {
      const shuffled = [...members].sort(() => Math.random() - 0.5);
      const half = Math.ceil(shuffled.length / 2);
      finalTeamA = shuffled.slice(0, half);
      finalTeamB = shuffled.slice(half);
    } else {
      if (finalTeamA.length === 0 || finalTeamB.length === 0) {
        setSubmitError("A팀과 B팀에 각각 최소 1명씩 배정해 주세요.");
        return;
      }
    }

    setSubmitting(true);
    try {
      // Create battle
      const battleRes = await fetch(`${API_BASE}/crews/battles/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: battleName || `${user?.crew_name} 팀전`,
          team_a_label: teamALabel || "A팀",
          team_b_label: teamBLabel || "B팀",
          crew_a: user?.crew,
          battle_type: "internal",
          start_date: startDate,
          end_date: endDate,
        }),
      });
      if (!battleRes.ok) {
        const err = await battleRes.json().catch(() => ({}));
        throw new Error(JSON.stringify(err));
      }
      const battle = await battleRes.json();

      // Create teams via bulk-assign
      const teamRes = await fetch(`${API_BASE}/crews/battle-teams/bulk-assign/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          battle: battle.id,
          team_a: finalTeamA.map((m) => m.id),
          team_b: finalTeamB.map((m) => m.id),
        }),
      });
      if (!teamRes.ok) throw new Error("팀 배정 실패");

      setSuccess(true);
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  if (success) {
    return (
      <AppShell>
        <TopBar title="🎲 크루 내 팀전 생성" back />
        <div className="p-4">
          <div className="bg-white rounded-xl p-8 text-center shadow-sm space-y-3">
            <div className="text-4xl">🎉</div>
            <div className="text-lg font-extrabold text-blue-700">팀전 생성 완료!</div>
            <div className="text-sm text-gray-500">크루 내 팀전이 시작됩니다.</div>
            <button
              onClick={() => router.push("/operator/teams")}
              className="mt-2 w-full py-3 rounded-xl font-bold text-sm text-white"
              style={{ background: "#1565C0" }}
            >
              팀 배정 보기
            </button>
            <button
              onClick={() => router.push("/operator/dashboard")}
              className="w-full py-3 rounded-xl font-bold text-sm border border-gray-200 text-gray-600"
            >
              대시보드로 이동
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <TopBar title="🎲 크루 내 팀전 생성" back />
      <div className="p-4 space-y-4">
        {/* Header */}
        <div
          className="rounded-xl p-4 text-white shadow"
          style={{ background: "linear-gradient(135deg, #1565C0, #1976D2)" }}
        >
          <div className="font-bold text-base">크루 내 팀전</div>
          <div className="text-xs opacity-70 mt-0.5">{user.crew_name} 내부 팀전</div>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl p-8 text-center text-gray-400 text-sm shadow-sm">
            멤버 불러오는 중...
          </div>
        ) : error ? (
          <div className="bg-red-50 rounded-xl p-6 text-center text-red-500 text-sm shadow-sm">
            {error}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {submitError && (
              <div className="bg-red-50 rounded-xl px-4 py-3 text-sm text-red-500">
                {submitError}
              </div>
            )}

            {/* 팀전 이름 */}
            <div className="bg-white rounded-xl p-5 shadow-sm space-y-3">
              <div className="text-sm font-bold text-blue-700">팀전 이름</div>
              <input
                type="text"
                value={battleName}
                onChange={(e) => setBattleName(e.target.value)}
                placeholder="예: 3월 마지막주 팀전"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            {/* 팀 이름 */}
            <div className="bg-white rounded-xl p-5 shadow-sm space-y-3">
              <div className="text-sm font-bold text-blue-700">팀 이름</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">A팀 이름</label>
                  <input
                    type="text"
                    value={teamALabel}
                    onChange={(e) => setTeamALabel(e.target.value)}
                    placeholder="A팀"
                    className="mt-1 w-full border border-blue-200 rounded-xl px-3 py-2 text-sm bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">B팀 이름</label>
                  <input
                    type="text"
                    value={teamBLabel}
                    onChange={(e) => setTeamBLabel(e.target.value)}
                    placeholder="B팀"
                    className="mt-1 w-full border border-orange-200 rounded-xl px-3 py-2 text-sm bg-orange-50 focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              </div>
            </div>

            {/* Duration */}
            <div className="bg-white rounded-xl p-5 shadow-sm space-y-3">
              <div className="text-sm font-bold text-blue-700">대결 기간</div>
              <div>
                <label className="text-xs text-gray-500 font-semibold">시작일</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-semibold">종료일</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>

            {/* Team assignment mode */}
            <div className="bg-white rounded-xl p-5 shadow-sm space-y-3">
              <div className="text-sm font-bold text-blue-700">팀 배정 방식</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAssignMode("random")}
                  className={`py-3 rounded-xl text-sm font-bold border-2 transition-all ${
                    assignMode === "random"
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-100 text-gray-500"
                  }`}
                >
                  🎲 랜덤 배정
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAssignMode("manual");
                    setTeamA([]);
                    setTeamB([]);
                  }}
                  className={`py-3 rounded-xl text-sm font-bold border-2 transition-all ${
                    assignMode === "manual"
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-100 text-gray-500"
                  }`}
                >
                  ✍️ 직접 배정
                </button>
              </div>
            </div>

            {/* Manual assignment */}
            {assignMode === "manual" && (
              <div className="space-y-3">
                {/* Unassigned */}
                {getUnassigned().length > 0 && (
                  <div className="bg-white rounded-xl p-4 shadow-sm">
                    <div className="text-xs font-bold text-gray-500 mb-2">미배정 멤버</div>
                    <div className="space-y-1.5">
                      {getUnassigned().map((m) => (
                        <div key={m.id} className="flex items-center gap-2">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                            style={{ background: m.profile_color || "#9E9E9E" }}
                          >
                            {m.username.charAt(0).toUpperCase()}
                          </div>
                          <span className="flex-1 text-sm">{m.username}</span>
                          <button
                            type="button"
                            onClick={() => moveToTeam(m, "A")}
                            className="text-[11px] font-bold px-2 py-1 rounded-lg bg-blue-50 text-blue-700"
                          >
                            A팀
                          </button>
                          <button
                            type="button"
                            onClick={() => moveToTeam(m, "B")}
                            className="text-[11px] font-bold px-2 py-1 rounded-lg bg-orange-50 text-orange-600"
                          >
                            B팀
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Teams */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 rounded-xl p-3">
                    <div className="text-xs font-bold text-blue-700 mb-2">A팀 ({teamA.length}명)</div>
                    {teamA.length === 0 ? (
                      <div className="text-xs text-blue-300 text-center py-2">비어있음</div>
                    ) : (
                      teamA.map((m) => (
                        <div key={m.id} className="flex items-center gap-1.5 mb-1.5">
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                            style={{ background: m.profile_color || "#1565C0" }}
                          >
                            {m.username.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-xs flex-1 truncate">{m.username}</span>
                          <button
                            type="button"
                            onClick={() => moveToTeam(m, "B")}
                            className="text-[10px] text-gray-400"
                          >
                            →
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="bg-orange-50 rounded-xl p-3">
                    <div className="text-xs font-bold text-orange-600 mb-2">B팀 ({teamB.length}명)</div>
                    {teamB.length === 0 ? (
                      <div className="text-xs text-orange-300 text-center py-2">비어있음</div>
                    ) : (
                      teamB.map((m) => (
                        <div key={m.id} className="flex items-center gap-1.5 mb-1.5">
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                            style={{ background: m.profile_color || "#FF5722" }}
                          >
                            {m.username.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-xs flex-1 truncate">{m.username}</span>
                          <button
                            type="button"
                            onClick={() => moveToTeam(m, "A")}
                            className="text-[10px] text-gray-400"
                          >
                            ←
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Random preview */}
            {assignMode === "random" && (
              <div className="bg-white rounded-xl p-4 shadow-sm space-y-2">
                <div className="text-sm font-bold text-blue-700">팀 미리보기</div>
                <div className="text-xs text-gray-400">
                  {members.length}명을 랜덤으로 두 팀으로 나눕니다.
                </div>
                <button
                  type="button"
                  onClick={handleRandomAssign}
                  className="w-full py-2.5 rounded-xl text-sm font-bold border-2 border-dashed border-blue-200 text-blue-600"
                >
                  🔀 미리 섞어보기
                </button>
                {(teamA.length > 0 || teamB.length > 0) && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="bg-blue-50 rounded-xl p-2">
                      <div className="text-[10px] font-bold text-blue-700 mb-1">A팀</div>
                      {teamA.map((m) => (
                        <div key={m.id} className="text-xs text-gray-600 truncate">{m.username}</div>
                      ))}
                    </div>
                    <div className="bg-orange-50 rounded-xl p-2">
                      <div className="text-[10px] font-bold text-orange-600 mb-1">B팀</div>
                      {teamB.map((m) => (
                        <div key={m.id} className="text-xs text-gray-600 truncate">{m.username}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 rounded-xl font-extrabold text-base text-white shadow"
              style={{ background: "#1565C0" }}
            >
              {submitting ? "생성 중..." : "🎲 팀전 시작하기"}
            </button>
          </form>
        )}
      </div>
    </AppShell>
  );
}
