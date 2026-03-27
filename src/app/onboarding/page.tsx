"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredUser } from "@/lib/auth";

export default function OnboardingPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");

  useEffect(() => {
    const user = getStoredUser();
    if (!user) { router.replace("/"); return; }
    if (user.crew) { router.replace("/home"); return; }
    setUsername(user.username);
  }, [router]);

  return (
    <div
      className="w-full min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: "linear-gradient(160deg, #1A1A2E, #0D1B2A)" }}
    >
      <div className="text-5xl mb-3">🏃</div>
      <h2 className="text-white text-xl font-extrabold mb-1">환영해요!</h2>
      <p className="text-gray-400 text-sm mb-1">{username}님</p>
      <p className="text-gray-500 text-xs mb-8 text-center">
        크루에 참여하거나 새 크루를 만들어보세요
      </p>

      <button
        onClick={() => router.push("/create-crew")}
        className="w-full rounded-2xl p-5 mb-3 text-left active:scale-95 transition-transform"
        style={{ background: "linear-gradient(135deg, #FF5722, #FF8A65)" }}
      >
        <div className="text-white text-base font-extrabold mb-1">🏃 새 크루 만들기</div>
        <div className="text-white/80 text-xs leading-relaxed">
          내가 운영자가 되어 크루를 개설합니다<br />
          개설 후 QR로 멤버를 초대할 수 있어요
        </div>
      </button>

      <button
        onClick={() => router.push("/home")}
        className="w-full rounded-2xl p-5 text-left active:scale-95 transition-transform"
        style={{
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.15)",
        }}
      >
        <div className="text-white text-base font-extrabold mb-1">📷 QR로 크루 가입</div>
        <div className="text-white/50 text-xs">운영자에게 QR코드를 받아 스캔하세요</div>
      </button>

      <button
        onClick={() => router.push("/home")}
        className="text-gray-500 text-xs mt-6 underline"
      >
        나중에 설정할 수도 있어요
      </button>
    </div>
  );
}
