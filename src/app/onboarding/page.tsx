"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredUser, saveUser } from "@/lib/auth";
import { API_BASE } from "@/lib/api";

export default function OnboardingPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const user = getStoredUser();
    if (!user) { router.replace("/"); return; }
    if (user.crew) { router.replace("/home"); return; }
    setUsername(user.username);
  }, [router]);

  const handleSoloCrew = async () => {
    const user = getStoredUser();
    if (!user) return;
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/crews/solo/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      });
      if (!res.ok) throw new Error('크루 생성 실패');
      const data = await res.json();

      // Update stored user with new crew info
      const updatedUser = { ...user, crew: data.id, crew_name: data.name };
      saveUser(updatedUser);

      router.replace('/home');
    } catch (err) {
      alert('크루 생성에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="w-full min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: "linear-gradient(160deg, #1A1A2E, #0D1B2A)" }}
    >
      <div className="text-5xl mb-3">🏃</div>
      <h2 className="text-white text-xl font-extrabold mb-1">환영해요!</h2>
      <p className="text-gray-400 text-sm mb-1">{username}님</p>
      <p className="text-gray-500 text-xs mb-8 text-center">
        크루를 만들거나 QR로 가입하세요
      </p>

      <button
        onClick={handleSoloCrew}
        disabled={creating}
        className="w-full rounded-2xl p-5 mb-2 text-left active:scale-95 transition-transform disabled:opacity-50"
        style={{ background: "linear-gradient(135deg, #7C3AED, #4F46E5)" }}
      >
        <div className="text-white text-base font-extrabold mb-1">⚡ 나만의 크루 만들기</div>
        <div className="text-white/80 text-xs leading-relaxed">
          {creating ? '크루 생성 중...' : '1인 크루도 점령전에 바로 참여할 수 있어요!'}
        </div>
      </button>

      <button
        onClick={() => router.push("/home")}
        className="w-full rounded-2xl p-4 text-left active:scale-95 transition-transform mt-2"
        style={{
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.15)",
        }}
      >
        <div className="text-white text-sm font-bold mb-0.5">📷 QR로 크루 가입</div>
        <div className="text-white/50 text-xs">운영자에게 QR코드를 받아 스캔하세요</div>
      </button>
    </div>
  );
}
