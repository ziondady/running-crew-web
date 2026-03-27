"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getStoredUser, saveUser, AuthUser } from "@/lib/auth";

const API_BASE = "http://localhost:8000/api";

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">로딩 중...</div>}>
      <JoinContent />
    </Suspense>
  );
}

function JoinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "confirm" | "joining" | "success" | "error">("loading");
  const [crew, setCrew] = useState<{ id: number; name: string; area: string; member_count: number } | null>(null);
  const [error, setError] = useState("");
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    if (!token) {
      setError("초대 토큰이 없습니다");
      setStatus("error");
      return;
    }

    const stored = getStoredUser();
    if (!stored) {
      // 토큰을 localStorage에 저장 후 로그인 페이지로
      localStorage.setItem("pending_crew_token", token);
      router.push("/");
      return;
    }
    setUser(stored);

    // 토큰으로 크루 찾기
    fetch(`${API_BASE}/crews/crews/?search=${token}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        const crews = data.results || [];
        const found = crews.find((c: any) => c.qr_token === token);
        if (found) {
          setCrew({ id: found.id, name: found.name, area: found.area, member_count: found.member_count });
          setStatus("confirm");
        } else {
          setError("유효하지 않은 초대 링크입니다");
          setStatus("error");
        }
      })
      .catch(() => {
        // search 미지원 시 전체 조회 후 필터
        fetch(`${API_BASE}/crews/crews/`, { cache: "no-store" })
          .then((r) => r.json())
          .then((data) => {
            const crews = data.results || [];
            const found = crews.find((c: any) => c.qr_token === token);
            if (found) {
              setCrew({ id: found.id, name: found.name, area: found.area, member_count: found.member_count });
              setStatus("confirm");
            } else {
              setError("유효하지 않은 초대 링크입니다");
              setStatus("error");
            }
          })
          .catch(() => { setError("서버 연결 실패"); setStatus("error"); });
      });
  }, [token, router]);

  const handleJoin = async () => {
    if (!crew || !user) return;
    setStatus("joining");

    try {
      const res = await fetch(`${API_BASE}/crews/crews/${crew.id}/join/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id }),
      });
      if (!res.ok) throw new Error("가입 실패");

      // 프로필 갱신
      const profile = await fetch(`${API_BASE}/accounts/profile/${user.id}/`).then((r) => r.json());
      saveUser(profile);
      localStorage.removeItem("pending_crew_token");
      setStatus("success");
    } catch (e: any) {
      setError(e.message);
      setStatus("error");
    }
  };

  return (
    <div
      className="w-full min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: "linear-gradient(160deg, #1A1A2E, #0D1B2A)" }}
    >
      {status === "loading" && (
        <div className="text-gray-400 text-sm">크루 정보 확인 중...</div>
      )}

      {status === "confirm" && crew && (
        <div className="w-full text-center space-y-5">
          <div className="text-5xl">🏃</div>
          <h1 className="text-white text-xl font-extrabold">{crew.name}</h1>
          {crew.area && <p className="text-gray-400 text-sm">{crew.area}</p>}
          <p className="text-gray-500 text-xs">멤버 {crew.member_count}명</p>

          <div className="bg-white/10 rounded-xl p-4 text-left">
            <p className="text-white text-sm">
              <strong>{user?.username}</strong>님, 이 크루에 가입하시겠습니까?
            </p>
          </div>

          <button
            onClick={handleJoin}
            className="w-full bg-[var(--primary)] text-white rounded-xl py-3 text-sm font-bold active:scale-95 transition-transform"
          >
            크루 가입하기
          </button>
          <button
            onClick={() => router.push("/home")}
            className="w-full text-gray-500 text-xs py-2"
          >
            취소
          </button>
        </div>
      )}

      {status === "joining" && (
        <div className="text-gray-400 text-sm">가입 처리 중...</div>
      )}

      {status === "success" && (
        <div className="w-full text-center space-y-5">
          <div className="text-5xl">🎉</div>
          <h1 className="text-white text-xl font-extrabold">가입 완료!</h1>
          <p className="text-gray-400 text-sm">{crew?.name} 크루에 가입되었습니다</p>
          <button
            onClick={() => router.push("/home")}
            className="w-full bg-[var(--primary)] text-white rounded-xl py-3 text-sm font-bold active:scale-95 transition-transform"
          >
            홈으로 이동
          </button>
        </div>
      )}

      {status === "error" && (
        <div className="w-full text-center space-y-5">
          <div className="text-5xl">😥</div>
          <h1 className="text-white text-xl font-extrabold">오류</h1>
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={() => router.push("/home")}
            className="w-full bg-white/10 text-white rounded-xl py-3 text-sm font-bold"
          >
            홈으로 돌아가기
          </button>
        </div>
      )}
    </div>
  );
}
