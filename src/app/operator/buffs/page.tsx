"use client";
import { API_BASE } from "@/lib/api";import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import TopBar from "@/components/TopBar";
import { getStoredUser, AuthUser } from "@/lib/auth";

interface Buff {
  id: number;
  name: string;
  multiplier: number;
  condition: string;
  is_active: boolean;
}


export default function OperatorBuffs() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [buffs, setBuffs] = useState<Buff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formMultiplier, setFormMultiplier] = useState("1.5");
  const [formCondition, setFormCondition] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchBuffs = () => {
    fetch(`${API_BASE}/running/buffs/`, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setBuffs(Array.isArray(data) ? data : data.results ?? []);
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
    fetchBuffs();
  }, [router]);

  const handleToggle = async (buff: Buff) => {
    setTogglingId(buff.id);
    try {
      const res = await fetch(`${API_BASE}/running/buffs/${buff.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !buff.is_active }),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      setBuffs((prev) =>
        prev.map((b) => (b.id === buff.id ? { ...b, is_active: !b.is_active } : b))
      );
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setTogglingId(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!formName.trim()) { setFormError("버프 이름을 입력하세요."); return; }
    const mult = parseFloat(formMultiplier);
    if (isNaN(mult) || mult <= 0) { setFormError("올바른 배수를 입력하세요."); return; }

    setFormLoading(true);
    try {
      const res = await fetch(`${API_BASE}/running/buffs/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          multiplier: mult,
          condition: formCondition.trim(),
          is_active: true,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(JSON.stringify(err));
      }
      const newBuff = await res.json();
      setBuffs((prev) => [newBuff, ...prev]);
      setFormName("");
      setFormMultiplier("1.5");
      setFormCondition("");
      setShowForm(false);
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (buff: Buff) => {
    if (!confirm(`"${buff.name}" 버프를 삭제하시겠습니까?`)) return;
    setDeletingId(buff.id);
    try {
      const res = await fetch(`${API_BASE}/running/buffs/${buff.id}/`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error(`API error: ${res.status}`);
      setBuffs((prev) => prev.filter((b) => b.id !== buff.id));
    } catch (err: any) {
      alert(`삭제 오류: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  if (!user) return null;

  return (
    <AppShell>
      <TopBar
        title="🔥 버프 설정"
        back
        right={
          <button
            onClick={() => setShowForm((v) => !v)}
            className="text-xs font-bold text-white opacity-80"
          >
            {showForm ? "✕ 닫기" : "+ 추가"}
          </button>
        }
      />
      <div className="p-4 space-y-4">
        {/* Header */}
        <div
          className="rounded-xl p-4 text-white shadow"
          style={{ background: "linear-gradient(135deg, #1565C0, #1976D2)" }}
        >
          <div className="font-bold text-base">버프 관리</div>
          <div className="text-xs opacity-70 mt-0.5">러닝 거리에 적용되는 버프를 설정하세요</div>
        </div>

        {/* Create form */}
        {showForm && (
          <form
            onSubmit={handleCreate}
            className="bg-white rounded-xl p-5 shadow-sm space-y-3"
          >
            <div className="text-sm font-bold text-blue-700 mb-1">새 버프 만들기</div>
            {formError && (
              <div className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{formError}</div>
            )}
            <div>
              <label className="text-xs text-gray-500 font-semibold">버프 이름</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="예: 새벽 러닝 버프"
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold">배수 (multiplier)</label>
              <input
                type="number"
                value={formMultiplier}
                onChange={(e) => setFormMultiplier(e.target.value)}
                placeholder="1.5"
                step="0.1"
                min="0.1"
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold">조건 (condition)</label>
              <input
                type="text"
                value={formCondition}
                onChange={(e) => setFormCondition(e.target.value)}
                placeholder="예: 오전 6시 이전 러닝"
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <button
              type="submit"
              disabled={formLoading}
              className="w-full py-3 rounded-xl font-bold text-sm text-white"
              style={{ background: "#1565C0" }}
            >
              {formLoading ? "저장 중..." : "버프 생성"}
            </button>
          </form>
        )}

        {/* Buff list */}
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
            {buffs.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">버프가 없습니다.</div>
            ) : (
              buffs.map((buff) => (
                <div
                  key={buff.id}
                  className="flex items-start gap-3 px-4 py-3 border-b border-gray-50 last:border-b-0"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{buff.name}</span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          buff.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-400"
                        }`}
                      >
                        {buff.is_active ? "활성" : "비활성"}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      <span className="font-semibold text-blue-600">x{buff.multiplier}</span>
                      {buff.condition && <span className="ml-1.5">— {buff.condition}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleDelete(buff)}
                      disabled={deletingId === buff.id}
                      className="text-xs text-red-400 hover:text-red-600 px-1"
                    >
                      {deletingId === buff.id ? "..." : "삭제"}
                    </button>
                    <button
                      onClick={() => handleToggle(buff)}
                      disabled={togglingId === buff.id}
                      className={`w-11 h-6 rounded-full transition-all relative ${
                        buff.is_active ? "bg-blue-600" : "bg-gray-200"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                          buff.is_active ? "left-5" : "left-0.5"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
