"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import TopBar from "@/components/TopBar";
import { createCrew, getUserProfile } from "@/lib/api";
import { getStoredUser, saveUser } from "@/lib/auth";

export default function CreateCrewPage() {
  const router = useRouter();
  const [crewName, setCrewName] = useState("");
  const [desc, setDesc] = useState("");
  const [area, setArea] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!crewName) { setError("크루 이름을 입력해주세요"); return; }
    const me = getStoredUser();
    if (!me) { router.push("/"); return; }

    setLoading(true);
    setError("");
    try {
      await createCrew({
        name: crewName,
        description: desc,
        area,
        is_public: isPublic,
        owner: me.id,
      });
      // 프로필 새로고침 (크루 배정됨, role=operator)
      const updated = await getUserProfile(me.id);
      saveUser(updated);
      router.push("/home");
    } catch (e: any) {
      setError("크루 생성 실패");
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#F8F9FA]">
      <TopBar title="새 크루 만들기" back />
      <div className="p-4">
        <div
          className="rounded-xl p-4 mb-4 text-center text-white"
          style={{ background: "linear-gradient(135deg, #FF5722, #FF8A65)" }}
        >
          <p className="text-xs opacity-80 mb-1">크루를 개설하면</p>
          <p className="text-sm font-bold">자동으로 운영자 등급이 부여됩니다 🎖️</p>
        </div>

        <div className="bg-white rounded-lg p-3 mb-3 border border-gray-100">
          <label className="text-xs text-gray-400 block mb-1">크루 이름 *</label>
          <input
            type="text"
            value={crewName}
            onChange={(e) => setCrewName(e.target.value)}
            placeholder="서울런닝클럽"
            className="w-full text-sm font-semibold text-[var(--primary)] outline-none"
          />
        </div>

        <div className="bg-white rounded-lg p-3 mb-3 border border-gray-100">
          <label className="text-xs text-gray-400 block mb-1">크루 소개 (선택)</label>
          <input
            type="text"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="매주 토요일 한강에서 함께 달려요!"
            className="w-full text-sm text-gray-400 outline-none"
          />
        </div>

        <div className="bg-white rounded-lg p-3 mb-3 border border-gray-100">
          <label className="text-xs text-gray-400 block mb-1">활동 지역</label>
          <input
            type="text"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="서울 · 한강"
            className="w-full text-sm font-semibold outline-none"
          />
        </div>

        <div className="bg-white rounded-lg p-3 mb-3 border border-gray-100">
          <label className="text-xs text-gray-400 block mb-2">크루 공개 설정</label>
          <div className="flex gap-2">
            <button
              onClick={() => setIsPublic(true)}
              className={`flex-1 rounded-lg py-2 text-xs font-bold ${
                isPublic ? "bg-[var(--primary)] text-white" : "bg-gray-100 text-gray-400"
              }`}
            >
              🔓 공개
            </button>
            <button
              onClick={() => setIsPublic(false)}
              className={`flex-1 rounded-lg py-2 text-xs font-bold ${
                !isPublic ? "bg-[var(--primary)] text-white" : "bg-gray-100 text-gray-400"
              }`}
            >
              🔒 비공개
            </button>
          </div>
        </div>

        <div className="bg-green-50 rounded-lg p-3 mb-4 text-xs text-green-700 leading-relaxed">
          ✅ 개설 후 QR코드가 자동 생성됩니다<br />
          ✅ 멤버 초대 · 버프 관리 권한 부여
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-xs font-bold rounded-lg px-3 py-2 mb-3">
            {error}
          </div>
        )}

        <button
          onClick={handleCreate}
          disabled={loading}
          className="w-full bg-[var(--primary)] text-white rounded-lg py-3 text-sm font-bold active:scale-95 transition-transform disabled:opacity-50"
        >
          {loading ? "생성 중..." : "크루 개설하기"}
        </button>
      </div>
    </div>
  );
}
