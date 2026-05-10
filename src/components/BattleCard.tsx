"use client";
import { fmtKm, fmtLocalDate } from "@/lib/format";

interface WeekResult {
  week_num: number;
  start: string;
  end: string;
  team_a_km: number;
  team_b_km: number;
  winner_side: "A" | "B" | null;
  is_current?: boolean;
}

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
  // 내부 팀전 전용 (optional)
  teamAWins?: number;
  teamBWins?: number;
  weeks?: WeekResult[];
  currentWeekNum?: number | null;
  currentWeekTeamAKm?: number;
  currentWeekTeamBKm?: number;
}

export default function BattleCard({
  battleName, battleType, myTeamLabel, otherTeamLabel,
  myTeamKm, otherTeamKm, daysLeft, startDate, endDate, isMyTeamA,
  teamAWins, teamBWins, weeks, currentWeekNum,
  currentWeekTeamAKm, currentWeekTeamBKm,
}: BattleCardProps) {
  const isExternal = battleType === "external";
  const isInternal = !isExternal;
  const hasWeekly = isInternal && Array.isArray(weeks) && weeks.length > 0;

  // 내부 팀전이고 주차 데이터가 있으면 진행바는 "현재 주차" 기준
  const aKmForBar = hasWeekly
    ? (isMyTeamA ? (currentWeekTeamAKm ?? 0) : (currentWeekTeamBKm ?? 0))
    : myTeamKm;
  const bKmForBar = hasWeekly
    ? (isMyTeamA ? (currentWeekTeamBKm ?? 0) : (currentWeekTeamAKm ?? 0))
    : otherTeamKm;
  const totalForBar = aKmForBar + bKmForBar;
  const myPercent = totalForBar > 0 ? (aKmForBar / totalForBar) * 100 : 50;
  const diff = aKmForBar - bKmForBar;

  const borderColor = isExternal ? "#FF5722" : "#1565C0";
  const gradientColor = isExternal
    ? "linear-gradient(90deg, #FF5722, #FF8A65)"
    : "linear-gradient(90deg, #1565C0, #42A5F5)";

  const myWins = hasWeekly ? (isMyTeamA ? (teamAWins ?? 0) : (teamBWins ?? 0)) : 0;
  const otherWins = hasWeekly ? (isMyTeamA ? (teamBWins ?? 0) : (teamAWins ?? 0)) : 0;

  return (
    <div
      className="bg-white rounded-2xl p-5 shadow-sm relative overflow-hidden"
      style={{
        border: `2px solid ${borderColor}`,
        boxShadow: `0 4px 20px ${isExternal ? 'rgba(255,87,34,0.15)' : 'rgba(21,101,192,0.12)'}`,
        animation: 'cardSlideIn 0.6s ease-out',
      }}
    >
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

      {/* 주차별 승점 (내부 팀전만) */}
      {hasWeekly && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-3 mb-3 border border-blue-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-gray-500">🏅 주차별 승점</span>
            {currentWeekNum && (
              <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                {currentWeekNum}주차 진행중
              </span>
            )}
          </div>
          <div className="flex items-center justify-center gap-3">
            <div className="text-center">
              <div className="text-[10px] font-bold text-gray-500">{myTeamLabel}</div>
              <div className="text-2xl font-black text-[#1565C0]">{myWins}<span className="text-xs">승</span></div>
            </div>
            <div className="text-xs font-bold text-gray-400">vs</div>
            <div className="text-center">
              <div className="text-[10px] font-bold text-gray-500">{otherTeamLabel}</div>
              <div className="text-2xl font-black text-gray-700">{otherWins}<span className="text-xs">승</span></div>
            </div>
          </div>
          {/* 주차별 결과 미니 타임라인 */}
          <div className="flex gap-1 mt-2 justify-center">
            {weeks!.map((w) => {
              let bg = "bg-gray-200";
              let label = `${w.week_num}`;
              if (w.is_current) {
                bg = "bg-yellow-300";
              } else if (w.winner_side === (isMyTeamA ? "A" : "B")) {
                bg = "bg-blue-500 text-white";
              } else if (w.winner_side === (isMyTeamA ? "B" : "A")) {
                bg = "bg-gray-400 text-white";
              } else if (w.start && new Date(w.start + "T00:00:00") <= new Date()) {
                bg = "bg-gray-300"; // 무승부 또는 종료된 무승부
              }
              return (
                <div
                  key={w.week_num}
                  className={`text-[9px] font-bold rounded w-6 h-6 flex items-center justify-center ${bg}`}
                  title={`${w.week_num}주차: ${myTeamLabel} ${fmtKm(isMyTeamA ? w.team_a_km : w.team_b_km)} vs ${otherTeamLabel} ${fmtKm(isMyTeamA ? w.team_b_km : w.team_a_km)}`}
                >
                  {label}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Teams km display */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 text-center">
          <div className={`text-xs font-extrabold ${isMyTeamA ? (isExternal ? 'text-[#FF5722]' : 'text-[#1565C0]') : 'text-[#1565C0]'}`}>
            {myTeamLabel} {isExternal ? '' : '(나)'}
          </div>
          <div className="text-2xl font-black text-[#1A1A2E]" style={{ animation: 'kmPop 1s ease-out 0.5s both' }}>
            {fmtKm(aKmForBar)}<span className="text-sm font-semibold text-gray-400">km</span>
          </div>
          {hasWeekly && (
            <div className="text-[9px] text-gray-400">누적 {fmtKm(myTeamKm)}km</div>
          )}
        </div>
        <div className="text-base font-black text-gray-300" style={{ animation: 'vsBounce 2s ease-in-out infinite' }}>
          VS
        </div>
        <div className="flex-1 text-center">
          <div className={`text-xs font-extrabold ${!isMyTeamA ? (isExternal ? 'text-[#FF5722]' : 'text-[#1565C0]') : 'text-[#1565C0]'}`}>
            {otherTeamLabel}
          </div>
          <div className="text-2xl font-black text-[#1A1A2E]" style={{ animation: 'kmPop 1s ease-out 0.7s both' }}>
            {fmtKm(bKmForBar)}<span className="text-sm font-semibold text-gray-400">km</span>
          </div>
          {hasWeekly && (
            <div className="text-[9px] text-gray-400">누적 {fmtKm(otherTeamKm)}km</div>
          )}
        </div>
      </div>

      {hasWeekly && (
        <div className="text-[9px] text-gray-400 text-center mb-1">
          ↑ 현재 {currentWeekNum ?? "-"}주차 km
        </div>
      )}

      {/* Progress bar */}
      <div className="relative mb-2">
        {diff > 0 && (
          <div className="absolute z-10" style={{ left: `${Math.min(myPercent, 95)}%`, top: '-18px' }}>
            <span className="absolute text-[10px]" style={{ animation: 'fireFloat 1.5s ease-out infinite' }}>🔥</span>
            <span className="absolute text-[10px] left-2" style={{ animation: 'fireFloat 1.5s ease-out infinite 0.5s' }}>✨</span>
          </div>
        )}

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
      <p className="text-[9px] text-gray-300 text-center mt-0.5">{fmtLocalDate(startDate)} ~ {fmtLocalDate(endDate)}</p>
    </div>
  );
}
