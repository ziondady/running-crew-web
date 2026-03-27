"use client";
import { API_BASE } from "@/lib/api";import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import TopBar from "@/components/TopBar";
import { getStoredUser, AuthUser } from "@/lib/auth";
import { fmtKm } from "@/lib/format";

interface Member {
  id: number;
  username: string;
  email: string;
  role: string;
  monthly_km: number;
  profile_color: string;
}


const ROLES = [
  { value: "member", label: "일반 멤버" },
  { value: "operator", label: "운영자" },
];

export default function OperatorMembers() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [confirmKick, setConfirmKick] = useState<Member | null>(null);
  const [roleTarget, setRoleTarget] = useState<Member | null>(null);
  const [newRole, setNewRole] = useState("member");

  const fetchMembers = (crewId: number) => {
    fetch(`${API_BASE}/crews/crews/${crewId}/members/`, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setMembers(Array.isArray(data) ? data : data.results ?? []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored) { router.replace("/"); return; }
    if (stored.role !== "operator") { router.replace("/mypage"); return; }
    setUser(stored);

    if (!stored.crew) {
      setError("소속된 크루가 없습니다.");
      setLoading(false);
      return;
    }

    fetchMembers(stored.crew);
  }, [router]);

  const handleKick = async (member: Member) => {
    if (!user?.crew) return;
    setActionLoading(member.id);
    try {
      const res = await fetch(`${API_BASE}/crews/crews/${user.crew}/kick/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: member.id }),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setActionLoading(null);
      setConfirmKick(null);
    }
  };

  const handleChangeRole = async () => {
    if (!user?.crew || !roleTarget) return;
    setActionLoading(roleTarget.id);
    try {
      const res = await fetch(`${API_BASE}/crews/crews/${user.crew}/change-role/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: roleTarget.id, role: newRole }),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      setMembers((prev) =>
        prev.map((m) => (m.id === roleTarget.id ? { ...m, role: newRole } : m))
      );
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setActionLoading(null);
      setRoleTarget(null);
    }
  };

  if (!user) return null;

  return (
    <AppShell>
      <TopBar title="👥 멤버 관리" back />
      <div className="p-4 space-y-4">
        {/* Header */}
        <div
          className="rounded-xl p-4 text-white shadow"
          style={{ background: "linear-gradient(135deg, #1565C0, #1976D2)" }}
        >
          <div className="font-bold text-base">{user.crew_name}</div>
          <div className="text-xs opacity-70 mt-0.5">총 {members.length}명</div>
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
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {members.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">멤버가 없습니다.</div>
            ) : (
              members.map((member, idx) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-b-0"
                >
                  {/* Avatar */}
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                    style={{ background: member.profile_color || "#1565C0" }}
                  >
                    {member.username.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{member.username}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          member.role === "operator"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {member.role === "operator" ? "운영자" : "멤버"}
                      </span>
                      <span className="text-[11px] text-gray-400">{fmtKm(member.monthly_km)}km/월</span>
                    </div>
                  </div>

                  {/* Actions */}
                  {member.id !== user.id && (
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => {
                          setRoleTarget(member);
                          setNewRole(member.role === "operator" ? "member" : "operator");
                        }}
                        className="text-[11px] font-bold px-2 py-1 rounded-lg border border-blue-200 text-blue-700"
                      >
                        역할
                      </button>
                      <button
                        onClick={() => setConfirmKick(member)}
                        className="text-[11px] font-bold px-2 py-1 rounded-lg border border-red-200 text-red-500"
                        disabled={actionLoading === member.id}
                      >
                        {actionLoading === member.id ? "..." : "강퇴"}
                      </button>
                    </div>
                  )}
                  {member.id === user.id && (
                    <span className="text-[10px] text-gray-300">나</span>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Kick confirm modal */}
      {confirmKick && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-6">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="text-base font-bold mb-2">멤버 강퇴</div>
            <div className="text-sm text-gray-600 mb-5">
              <span className="font-semibold">{confirmKick.username}</span>님을 크루에서 강퇴하시겠습니까?
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmKick(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600"
              >
                취소
              </button>
              <button
                onClick={() => handleKick(confirmKick)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: "#E53935" }}
                disabled={actionLoading === confirmKick.id}
              >
                {actionLoading === confirmKick.id ? "처리 중..." : "강퇴"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role change modal */}
      {roleTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-6">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="text-base font-bold mb-2">역할 변경</div>
            <div className="text-sm text-gray-500 mb-3">
              {roleTarget.username}님의 역할을 변경합니다
            </div>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-5 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={() => setRoleTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600"
              >
                취소
              </button>
              <button
                onClick={handleChangeRole}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: "#1565C0" }}
                disabled={actionLoading === roleTarget.id}
              >
                {actionLoading === roleTarget.id ? "처리 중..." : "변경"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
