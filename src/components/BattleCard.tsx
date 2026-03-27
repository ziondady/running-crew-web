"use client";
import { fmtKm } from "@/lib/format";

interface BattleCardProps {
  battleName?: string;
  battleType: "external" | "internal";
  myTeamLabel: string;
  otherTeamLabel: string;
  myTeamKm: number;
  otherTeamKm: number;
  daysLeft: number;
  startDate: string;
  endDate: string;
  isMyTeamA: boolean;
}

export default function BattleCard({
  battleName, battleType, myTeamLabel, otherTeamLabel,
  myTeamKm, otherTeamKm, daysLeft, startDate, endDate, isMyTeamA,
}: BattleCardProps) {
  const total = myTeamKm + otherTeamKm;
  const myPercent = total > 0 ? (myTeamKm / total) * 100 : 50;
  const diff = myTeamKm - otherTeamKm;
  const isExternal = battleType === "external";
  const borderColor = isExternal ? "#FF5722" : "#1565C0";
  const gradientColor = isExternal
    ? "linear-gradient(90deg, #FF5722, #FF8A65)"
    : "linear-gradient(90deg, #1565C0, #42A5F5)";

  return (
    <div
      className="bg-white rounded-2xl p-5 shadow-sm relative overflow-hidden"
      style={{
        border: `2px solid ${borderColor}`,
        boxShadow: `0 4px 20px ${isExternal ? 'rgba(255,87,34,0.15)' : 'rgba(21,101,192,0.12)'}`,
        animation: 'cardSlideIn 0.6s ease-out',
      }}
    >
      {/* Battle name */}
      {battleName && (
        <div className="text-xs text-gray-500 font-semibold">{battleName}</div>
      )}

      {/* Type + badge + D-day */}
      <div className="flex items-center gap-2 mt-1 mb-3">
        <span className="text-sm font-extrabold">
          {isExternal ? "⚔️ 타크루 대결" : "🎲 크루 내 팀전"}
        </span>
        {!isExternal && (
          <span
            className="text-[10px] font-bold text-white px-2 py-0.5 rounded-full"
            style={{ background: '#1565C0', animation: 'kmPop 0.5s ease-out 0.8s both' }}
          >
            나는 {myTeamLabel}
          </span>
        )}
        <span
          className="ml-auto text-xs font-extrabold"
          style={{ color: '#FF1744', animation: 'dDayPulse 2s ease-in-out infinite' }}
        >
          D-{daysLeft}
        </span>
      </div>

      {/* Teams */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 text-center">
          <div className={`text-xs font-extrabold ${isMyTeamA ? (isExternal ? 'text-[#FF5722]' : 'text-[#1565C0]') : 'text-[#1565C0]'}`}>
            {myTeamLabel} {isExternal ? '' : '(나)'}
          </div>
          <div className="text-2xl font-black text-[#1A1A2E]" style={{ animation: 'kmPop 1s ease-out 0.5s both' }}>
            {fmtKm(myTeamKm)}<span className="text-sm font-semibold text-gray-400">km</span>
          </div>
        </div>
        <div className="text-base font-black text-gray-300" style={{ animation: 'vsBounce 2s ease-in-out infinite' }}>
          VS
        </div>
        <div className="flex-1 text-center">
          <div className={`text-xs font-extrabold ${!isMyTeamA ? (isExternal ? 'text-[#FF5722]' : 'text-[#1565C0]') : 'text-[#1565C0]'}`}>
            {otherTeamLabel}
          </div>
          <div className="text-2xl font-black text-[#1A1A2E]" style={{ animation: 'kmPop 1s ease-out 0.7s both' }}>
            {fmtKm(otherTeamKm)}<span className="text-sm font-semibold text-gray-400">km</span>
          </div>
        </div>
      </div>

      {/* Progress bar with runners */}
      <div className="relative mb-2">
        {/* Fire particles on the leading side */}
        {diff > 0 && (
          <div className="absolute z-10" style={{ left: `${Math.min(myPercent, 95)}%`, top: '-18px' }}>
            <span className="absolute text-[10px]" style={{ animation: 'fireFloat 1.5s ease-out infinite' }}>🔥</span>
            <span className="absolute text-[10px] left-2" style={{ animation: 'fireFloat 1.5s ease-out infinite 0.5s' }}>✨</span>
          </div>
        )}

        {/* Runner A (my team) */}
        <div
          className="absolute z-10 text-lg"
          style={{
            left: `${Math.min(Math.max(myPercent - 3, 0), 92)}%`,
            top: '-24px',
            animation: 'runnerBounce 0.4s ease-in-out infinite alternate',
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))',
          }}
        >
          🏃‍♂️
        </div>

        {/* Runner B (other team) */}
        <div
          className="absolute z-10 text-lg"
          style={{
            left: `${Math.min(Math.max(100 - myPercent - 3, 0), 92)}%`,
            top: '-24px',
            animation: 'runnerBounce 0.4s ease-in-out infinite alternate',
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))',
            transform: 'scaleX(-1)',
          }}
        >
          🏃
        </div>

        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full relative"
            style={{
              width: `${myPercent}%`,
              background: gradientColor,
              animation: 'progressGrow 1.8s cubic-bezier(0.4, 0, 0.2, 1) 0.3s both',
            }}
          >
            {/* Shimmer */}
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                animation: 'shimmer 2s ease-in-out infinite',
              }}
            />
          </div>
        </div>
      </div>

      <p className="text-[10px] text-gray-400 text-center">
        {diff > 0
          ? <><strong className={isExternal ? 'text-[#FF5722]' : 'text-[#1565C0]'}>{myTeamLabel}</strong> +{fmtKm(diff)}km 리드! 🔥</>
          : diff < 0
            ? <><strong className="text-gray-600">{otherTeamLabel}</strong> +{fmtKm(Math.abs(diff))}km 앞서는 중</>
            : '동점'
        }
      </p>
      <p className="text-[9px] text-gray-300 text-center mt-0.5">{startDate} ~ {endDate}</p>
    </div>
  );
}
