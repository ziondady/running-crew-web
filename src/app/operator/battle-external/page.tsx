"use client";
import { API_BASE } from "@/lib/api";import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import TopBar from "@/components/TopBar";
import { getStoredUser, AuthUser } from "@/lib/auth";

interface Crew {
  id: number;
  name: string;
  area: string;
  member_count?: number;
}


export default function OperatorBattleExternal() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Crew[]>([]);
  const [searching, setSearching] = useState(false);

  // Auto match
  const [autoMatches, setAutoMatches] = useState<any[]>([]);
  const [autoLoading, setAutoLoading] = useState(false);

  // Form state
  const [battleName, setBattleName] = useState("");
  const [selectedCrew, setSelectedCrew] = useState<Crew | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored) { router.replace("/"); return; }
    if (stored.role !== "operator") { router.replace("/mypage"); return; }
    setUser(stored);

    // Set default dates
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    setStartDate(today.toISOString().split("T")[0]);
    setEndDate(nextWeek.toISOString().split("T")[0]);
    setLoading(false);
  }, [router]);

  const handleSearch = useCallback(async (q: string) => {
    if (!user) return;
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(
        `${API_BASE}/crews/crews/search/?q=${encodeURIComponent(q)}&exclude=${user.crew ?? ""}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      setSearchResults(Array.isArray(data) ? data : data.results ?? []);
    } catch (err: any) {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [user]);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  const handleAutoMatch = async () => {
    if (!user?.crew) return;
    setAutoLoading(true);
    try {
      const res = await fetch(`${API_BASE}/crews/crews/${user.crew}/auto-match/`, { cache: "no-store" });
      const data = await res.json();
      setAutoMatches(Array.isArray(data) ? data : []);
    } catch { setAutoMatches([]); }
    setAutoLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!selectedCrew) { setSubmitError("상대 크루를 선택해 주세요."); return; }
    if (!startDate || !endDate) { setSubmitError("대결 기간을 설정해 주세요."); return; }
    if (new Date(endDate) <= new Date(startDate)) {
      setSubmitError("종료일은 시작일보다 이후여야 합니다.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/crews/battles/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: battleName || `${user?.crew_name} vs ${selectedCrew.name}`,
          crew_a: user?.crew,
          crew_b: selectedCrew.id,
          battle_type: "external",
          start_date: startDate,
          end_date: endDate,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || JSON.stringify(err));
      }
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
        <TopBar title="⚔️ 크루 간 대결 생성" back />
        <div className="p-4">
          <div className="bg-white rounded-xl p-8 text-center shadow-sm space-y-3">
            <div className="text-4xl">🎉</div>
            <div className="text-lg font-extrabold text-blue-700">대결 생성 완료!</div>
            <div className="text-sm text-gray-500">상대 크루와의 대결이 시작됩니다.</div>
            <button
              onClick={() => router.push("/operator/dashboard")}
              className="mt-2 w-full py-3 rounded-xl font-bold text-sm text-white"
              style={{ background: "#1565C0" }}
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
      <TopBar title="⚔️ 크루 간 대결 생성" back />
      <div className="p-4 space-y-4">
        {/* Header */}
        <div
          className="rounded-xl p-4 text-white shadow"
          style={{ background: "linear-gradient(135deg, #1565C0, #1976D2)" }}
        >
          <div className="font-bold text-base">크루 간 대결</div>
          <div className="text-xs opacity-70 mt-0.5">{user.crew_name} vs 상대 크루</div>
          <div className="text-[10px] opacity-60 mt-1">대결 기간 중 크루 전체 누적 km로 자동 집계됩니다</div>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl p-8 text-center text-gray-400 text-sm shadow-sm">
            불러오는 중...
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

            {/* Battle name */}
            <div className="bg-white rounded-xl p-5 shadow-sm space-y-2">
              <div className="text-sm font-bold text-blue-700">대결 이름 (선택)</div>
              <input
                type="text"
                value={battleName}
                onChange={(e) => setBattleName(e.target.value)}
                placeholder={`${user.crew_name} vs 상대 크루`}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            {/* Crew search */}
            <div className="bg-white rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-bold text-blue-700">상대 크루</div>
                <button
                  type="button"
                  onClick={handleAutoMatch}
                  disabled={autoLoading}
                  className="text-xs font-bold text-white bg-[var(--primary)] px-3 py-1.5 rounded-lg active:scale-95 transition-transform"
                >
                  {autoLoading ? "매칭 중..." : "🎯 자동 매칭"}
                </button>
              </div>

              {/* 자동 매칭 결과 */}
              {autoMatches.length > 0 && !selectedCrew && (
                <div className="space-y-2">
                  <p className="text-[10px] text-gray-400">유사한 점수/인원 기준 추천 (대결 가능한 크루)</p>
                  {autoMatches.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { setSelectedCrew({ id: c.id, name: c.name, area: c.area, member_count: c.member_count } as Crew); setAutoMatches([]); }}
                      className="w-full flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2.5 text-left active:scale-[0.98] transition-transform"
                    >
                      <div className="flex-1">
                        <div className="text-sm font-semibold">{c.name}</div>
                        <div className="text-[10px] text-gray-400">{c.area}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-orange-500">{c.points}pt</div>
                        <div className="text-[10px] text-gray-400">{c.member_count}명</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Selected crew badge */}
              {selectedCrew && (
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-3">
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-blue-800">{selectedCrew.name}</div>
                    <div className="text-xs text-blue-400">{selectedCrew.area}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      {selectedCrew.member_count}명 · {(selectedCrew as any).points ?? 0}pt
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCrew(null);
                      setSearchQuery("");
                      setSearchResults([]);
                    }}
                    className="text-blue-400 hover:text-blue-600 text-sm font-bold"
                  >
                    ✕
                  </button>
                </div>
              )}

              {!selectedCrew && (
                <>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="크루 이름으로 검색..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />

                  {searching && (
                    <div className="text-xs text-gray-400 text-center py-2">검색 중...</div>
                  )}

                  {!searching && searchQuery.trim() && searchResults.length === 0 && (
                    <div className="text-xs text-gray-400 text-center py-2">검색 결과가 없습니다</div>
                  )}

                  {!searching && searchResults.length > 0 && (
                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                      {searchResults.map((crew) => (
                        <button
                          key={crew.id}
                          type="button"
                          onClick={() => {
                            setSelectedCrew(crew);
                            setSearchQuery("");
                            setSearchResults([]);
                          }}
                          className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-blue-300 hover:bg-blue-50 transition-all text-left"
                        >
                          <div className="flex-1">
                            <div className="text-sm font-semibold">{crew.name}</div>
                            <div className="text-xs text-gray-400">{crew.area}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-bold text-orange-500">{(crew as any).points ?? 0}pt</div>
                            <div className="text-[10px] text-gray-400">{crew.member_count ?? 0}명</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {!searchQuery.trim() && (
                    <div className="text-xs text-gray-400 text-center py-2">크루 이름을 입력해 검색하세요</div>
                  )}
                </>
              )}
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

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 rounded-xl font-extrabold text-base text-white shadow"
              style={{ background: "#1565C0" }}
            >
              {submitting ? "생성 중..." : "⚔️ 대결 시작하기"}
            </button>
          </form>
        )}
      </div>
    </AppShell>
  );
}
