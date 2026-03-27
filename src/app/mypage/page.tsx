"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import TopBar from "@/components/TopBar";
import { getUserProfile } from "@/lib/api";
import { getStoredUser, saveUser, clearUser, AuthUser } from "@/lib/auth";
import { fmtKm } from "@/lib/format";

export default function MyPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored) { router.replace("/"); return; }

    getUserProfile(stored.id)
      .then((data) => { setUser(data); setLoading(false); })
      .catch(() => { setUser(stored); setLoading(false); });
  }, [router]);

  const handleLogout = () => {
    clearUser();
    router.push("/");
  };

  const handleLeaveCrew = async () => {
    if (!user) return;
    if (!confirm("정말 크루를 탈퇴하시겠습니까?\n\n탈퇴 후 다시 가입하면 기존 러닝 기록은 유지됩니다.")) return;
    if (!confirm("크루를 탈퇴하면 팀전/대항전 참여가 중단됩니다.\n정말 탈퇴하시겠습니까?")) return;

    try {
      // user의 crew를 null로 설정
      const res = await fetch(`http://localhost:8000/api/accounts/users/${user.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crew: null, role: "member" }),
      });
      if (!res.ok) throw new Error("탈퇴 실패");
      const updated = await res.json();
      saveUser({ ...user, crew: null, crew_name: null, role: "member" });
      alert("크루에서 탈퇴했습니다.");
      router.push("/home");
    } catch {
      alert("크루 탈퇴에 실패했습니다.");
    }
  };

  if (loading || !user) return null;

  const isOperator = user.role === "operator";

  const menuItems = [
    ...(user.crew ? [{ icon: "🚪", label: "크루 탈퇴", action: true, danger: true, onClick: handleLeaveCrew }] : []),
    { icon: "🟢", label: "Strava 연결", tag: "미연결", tagColor: "gray" },
    { icon: "⌚", label: "Garmin 연결", tag: "미연결", tagColor: "gray" },
    { icon: "🔔", label: "알림 설정", action: true },
    { icon: "🔒", label: "계정 관리", action: true },
  ];

  const operatorMenuItems = [
    { icon: "📊", label: "운영자 대시보드", href: "/operator/dashboard" },
    { icon: "📷", label: "QR 생성 / 공유", href: "/operator/qr" },
    { icon: "👥", label: "멤버 관리", href: "/operator/members" },
    { icon: "🔥", label: "버프 설정", href: "/operator/buffs" },
    { icon: "⚔️", label: "크루 간 대결 생성", href: "/operator/battle-external" },
    { icon: "🎲", label: "크루 내 팀전 생성", href: "/operator/battle-internal" },
    { icon: "📋", label: "대결/팀전 이력", href: "/operator/battle-history" },
  ];

  return (
    <AppShell>
      <TopBar title="👤 마이페이지" />
      <div className="p-4 space-y-3">
        {/* Profile card */}
        <div className="bg-white rounded-xl p-5 shadow-sm text-center">
          <div
            className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-2xl"
            style={{ background: `linear-gradient(135deg, ${user.profile_color}, ${user.profile_color}88)` }}
          >
            🏃
          </div>
          <h2 className="font-extrabold text-lg">{user.username}</h2>
          <div className="flex items-center justify-center gap-2 mt-0.5">
            <span className="text-xs text-gray-400">{user.crew_name || "크루 미소속"}</span>
            {isOperator && (
              <span className="text-[10px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded">운영자</span>
            )}
            {!isOperator && <span className="text-xs text-gray-400">· 일반회원</span>}
          </div>

          <div className="flex justify-center gap-5 mt-4">
            <div className="text-center">
              <div className="font-extrabold text-base">{fmtKm(user.yearly_km)}km</div>
              <div className="text-[10px] text-gray-400">올해 누적</div>
            </div>
            <div className="w-px bg-gray-200" />
            <div className="text-center">
              <div className="font-extrabold text-base">{user.run_days}일</div>
              <div className="text-[10px] text-gray-400">러닝일</div>
            </div>
            <div className="w-px bg-gray-200" />
            <div className="text-center">
              <div className="font-extrabold text-base">{user.territory_count}개</div>
              <div className="text-[10px] text-gray-400">점령 구간</div>
            </div>
          </div>
        </div>

        {/* Menu */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-2 text-xs text-gray-400 font-bold border-b border-gray-50">
            내 설정
          </div>
          {menuItems.map((item: any, idx) => (
            <button
              key={idx}
              onClick={item.onClick}
              className={`w-full flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-b-0 ${item.danger ? "text-red-500" : ""}`}
            >
              <span>{item.icon}</span>
              <span className="flex-1 text-sm text-left">{item.label}</span>
              {item.tag && (
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    item.tagColor === "green"
                      ? "bg-green-50 text-green-600"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {item.tag}
                </span>
              )}
              {item.action && !item.danger && <span className="text-gray-300">›</span>}
            </button>
          ))}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-500"
          >
            <span>🚪</span>
            <span className="text-sm">로그아웃</span>
          </button>
        </div>

        {/* 운영자 메뉴 */}
        {isOperator && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-2 text-xs text-blue-600 font-bold border-b border-gray-50 flex items-center gap-1">
              <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded">OP</span>
              운영자 메뉴 ({user.crew_name})
            </div>
            {operatorMenuItems.map((item, idx) => (
              <button
                key={idx}
                onClick={() => router.push(item.href)}
                className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-b-0 text-left hover:bg-blue-50 transition-colors"
              >
                <span>{item.icon}</span>
                <span className="flex-1 text-sm">{item.label}</span>
                <span className="text-gray-300">›</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
