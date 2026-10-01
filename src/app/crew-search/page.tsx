"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredUser, saveUser } from "@/lib/auth";
import { API_BASE, applyToCrew, discoverCrews, DiscoverCrew } from "@/lib/api";

export default function CrewSearchPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [crews, setCrews] = useState<DiscoverCrew[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [applyingId, setApplyingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const user = getStoredUser();
    if (!user) { router.replace("/"); return; }
    if (user.crew) { router.replace("/home"); return; }
    setUserId(user.id);
  }, [router]);

  // 입력이 멈춘 뒤에 검색해서 요청이 글자마다 나가지 않게 한다
  useEffect(() => {
    if (userId === null) return;
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      discoverCrews(query.trim(), userId)
        .then((list) => { if (!cancelled) { setCrews(list); setLoadError(false); } })
        .catch(() => { if (!cancelled) setLoadError(true); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, userId]);

  const handleApply = async (crew: DiscoverCrew) => {
    if (userId === null || applyingId !== null) return;
    if (!confirm(`'${crew.name}' 크루에 가입 신청할까요?\n신청하면 바로 가입돼요.`)) return;
    setApplyingId(crew.id);
    setMessage("");
    try {
      await applyToCrew(crew.id, userId);
      const profile = await fetch(`${API_BASE}/accounts/profile/${userId}/`, { cache: "no-store" }).then((r) => r.json());
      saveUser(profile);
      router.replace("/home");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "가입 신청에 실패했습니다.");
      setApplyingId(null);
    }
  };

  return (
    <div
      className="w-full min-h-screen flex flex-col px-5 pt-10 pb-8"
      style={{ background: "linear-gradient(160deg, #1A1A2E, #0D1B2A)" }}
    >
      <button onClick={() => router.back()} className="self-start text-gray-400 text-sm mb-4">
        ← 뒤로
      </button>
      <h2 className="text-white text-xl font-extrabold mb-1">크루 찾기</h2>
      <p className="text-gray-500 text-xs mb-4">공개된 크루에 가입 신청하면 바로 가입돼요</p>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="크루 이름이나 지역으로 검색"
        className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none mb-4"
        style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}
      />

      {message && <p className="text-red-400 text-xs mb-3" role="alert">{message}</p>}

      {loading && <p className="text-gray-500 text-sm text-center mt-8">불러오는 중...</p>}

      {!loading && loadError && (
        <p className="text-red-400 text-sm text-center mt-8">크루 목록을 불러오지 못했어요. 잠시 후 다시 시도해주세요.</p>
      )}

      {!loading && !loadError && crews.length === 0 && (
        <p className="text-gray-500 text-sm text-center mt-8 leading-relaxed">
          {query.trim()
            ? "검색 결과가 없어요."
            : "가입 신청을 받는 공개 크루가 아직 없어요."}
          <br />
          운영자에게 QR코드를 받아 가입할 수도 있어요.
        </p>
      )}

      {!loading && !loadError && (
        <ul className="flex flex-col gap-2">
          {crews.map((c) => (
            <li
              key={c.id}
              className="rounded-2xl p-4 flex items-center gap-3"
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}
            >
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm font-bold truncate">{c.name}</div>
                <div className="text-white/50 text-xs truncate">
                  멤버 {c.member_count}명{c.area ? ` · ${c.area}` : ""}
                </div>
                {c.description && <div className="text-white/40 text-xs truncate mt-0.5">{c.description}</div>}
              </div>
              <button
                onClick={() => handleApply(c)}
                disabled={applyingId !== null}
                className="shrink-0 rounded-xl px-4 py-2 text-xs font-bold text-white active:scale-95 transition-transform disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #7C3AED, #4F46E5)" }}
              >
                {applyingId === c.id ? "가입 중..." : "가입 신청"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
