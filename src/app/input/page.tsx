"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import TopBar from "@/components/TopBar";
import { getBuffs, createRunLog } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { fmtKm } from "@/lib/format";

interface BuffItem {
  id: number;
  name: string;
  multiplier: number;
  condition: string;
}

export default function InputPage() {
  const router = useRouter();
  const [distance, setDistance] = useState("");
  const [selectedBuffs, setSelectedBuffs] = useState<number[]>([]);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [buffs, setBuffs] = useState<BuffItem[]>([]);
  const [useApi, setUseApi] = useState(true);
  const [crewName, setCrewName] = useState("크루 미소속");
  const [isOfflineMeetup, setIsOfflineMeetup] = useState(false);

  useEffect(() => {
    const stored = getStoredUser();
    if (stored?.crew_name) setCrewName(stored.crew_name);

    getBuffs()
      .then((data) => setBuffs(data))
      .catch(() => { setBuffs([]); setUseApi(false); });
  }, []);

  const distNum = parseFloat(distance) || 0;
  const totalMultiplier = selectedBuffs.reduce(
    (acc, idx) => acc * (buffs[idx]?.multiplier || 1),
    1
  );
  const buffedDistance = Math.round(distNum * totalMultiplier * 100) / 100;

  const toggleBuff = (idx: number) => {
    setSelectedBuffs((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  const handleSave = async () => {
    if (distNum <= 0) {
      setError("거리를 입력해주세요");
      return;
    }
    setError("");
    setSaving(true);

    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    try {
      const me = getStoredUser();
      if (!me) { setError("로그인이 필요합니다"); setSaving(false); return; }
      await createRunLog({
        user: me.id,
        date: dateStr,
        distance: Math.round(distNum * 100) / 100,
        buff_distance: Math.round(buffedDistance * 100) / 100,
        source: "manual",
        is_offline_meetup: isOfflineMeetup,
        buffs_applied: selectedBuffs.map((idx) => buffs[idx]?.id).filter(Boolean),
      });
      setSaved(true);
      setDistance("");
      setSelectedBuffs([]);
      setIsOfflineMeetup(false);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError("저장 실패: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const today = new Date();
  const dateDisplay = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")} (오늘)`;

  return (
    <AppShell>
      <TopBar title="➕ 거리 입력" settingsButton />
      <div className="p-4">
        {/* Tabs */}
        <div className="flex gap-1 mb-4">
          {[
            { label: "✏️ 수동", active: true },
            { label: "📍 GPS", href: "/gps" },
            { label: "📁 파일", href: "/upload" },
            { label: "🟢 Strava", disabled: true },
          ].map((tab, i) => (
            <button
              key={i}
              onClick={() => tab.href ? router.push(tab.href) : undefined}
              disabled={tab.disabled}
              className={`flex-1 text-center py-2 rounded-lg text-xs font-bold ${
                tab.active
                  ? "bg-[var(--primary)] text-white"
                  : tab.disabled
                    ? "bg-gray-100 text-gray-300"
                    : "bg-gray-200 text-gray-500"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* API status */}
        <div className={`rounded-lg px-3 py-1.5 text-xs font-bold text-center mb-3 ${
          useApi ? "bg-green-50 text-green-600" : "bg-yellow-50 text-yellow-600"
        }`}>
          {useApi ? "📝 수동입력은 점령전과 대항전에는 반영되지 않습니다" : "⚠️ API 미연결"}
        </div>

        {/* Date */}
        <div className="bg-white rounded-lg p-3 mb-3 border border-gray-100">
          <div className="text-xs text-gray-400 mb-1">날짜</div>
          <div className="text-sm font-semibold">{dateDisplay}</div>
        </div>

        {/* Distance input */}
        <div className="bg-white rounded-lg p-3 mb-3 border border-gray-100">
          <div className="text-xs text-gray-400 mb-1">달린 거리 (km)</div>
          <input
            type="number"
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
            placeholder="0.0"
            className="text-2xl font-extrabold text-[var(--primary)] outline-none w-full"
            step="0.01"
            min="0"
          />
        </div>

        {/* Buff selection */}
        <p className="text-xs font-bold text-gray-600 mb-2">🔥 버프 선택 (중복 가능)</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {buffs.map((buff, idx) => {
            const active = selectedBuffs.includes(idx);
            return (
              <button
                key={buff.id}
                onClick={() => toggleBuff(idx)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  active
                    ? "bg-orange-50 text-[var(--primary)] border-[var(--primary)]"
                    : "bg-gray-100 text-gray-400 border-transparent"
                }`}
              >
                {buff.name} x{buff.multiplier} {active && "✓"}
              </button>
            );
          })}
        </div>

        {/* Buffed distance */}
        {distNum > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-3">
            <div className="text-xs text-gray-400 mb-1">버프 적용 후 거리</div>
            <div className="text-xl font-extrabold text-[var(--primary)]">
              {fmtKm(buffedDistance)} km{" "}
              <span className="text-xs text-gray-400 font-normal">
                ({fmtKm(distNum)} x {totalMultiplier.toFixed(2)})
              </span>
            </div>
          </div>
        )}

        {/* 오프벙 참석 */}
        <button
          onClick={() => setIsOfflineMeetup(!isOfflineMeetup)}
          className={`w-full rounded-lg p-3 mb-3 border flex items-center gap-3 transition-all ${
            isOfflineMeetup ? "bg-green-50 border-green-300" : "bg-white border-gray-100"
          }`}
        >
          <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center text-sm ${
            isOfflineMeetup ? "bg-green-500 border-green-500 text-white" : "border-gray-300"
          }`}>
            {isOfflineMeetup && "✓"}
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold">🤝 오프벙 참석</div>
            <div className="text-[10px] text-gray-400">오프라인 모임에 참석했다면 체크하세요</div>
          </div>
        </button>

        {/* Crew */}
        <div className="bg-white rounded-lg p-3 mb-4 border border-gray-100">
          <div className="text-xs text-gray-400 mb-1">소속 크루</div>
          <div className="text-sm font-semibold">{crewName}</div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 text-red-600 text-xs font-bold rounded-lg px-3 py-2 mb-3">
            {error}
          </div>
        )}

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className={`w-full rounded-lg py-3 text-sm font-bold text-white active:scale-95 transition-all ${
            saved ? "bg-green-500" : saving ? "bg-gray-400" : "bg-[var(--primary)]"
          }`}
        >
          {saved ? "✅ 저장 완료! DB에 반영됨" : saving ? "저장 중..." : "저장하기"}
        </button>

        {saved && (
          <div className="text-center py-4" style={{ animation: 'cardSlideIn 0.4s ease-out' }}>
            <div className="inline-flex gap-1 mb-2">
              <span className="text-2xl" style={{ animation: 'confettiFall 2s ease-in-out infinite' }}>🎉</span>
              <span className="text-2xl" style={{ animation: 'confettiFall 2s ease-in-out infinite 0.3s' }}>🏃</span>
              <span className="text-2xl" style={{ animation: 'confettiFall 2s ease-in-out infinite 0.6s' }}>🎉</span>
            </div>
            <div className="text-2xl font-black text-[var(--primary)]" style={{ animation: 'kmPop 0.6s ease-out' }}>
              +{fmtKm(buffedDistance)} km
            </div>
            <div className="text-xs text-gray-400 mt-1">오늘도 힘차게 달렸어요!</div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
