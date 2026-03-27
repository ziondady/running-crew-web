"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import BattleCard from "@/components/BattleCard";
import { getCrewRanking, getUserProfile ,API_BASE} from "@/lib/api";
import { getStoredUser, saveUser, AuthUser } from "@/lib/auth";
import { fmtKm } from "@/lib/format";

interface RankMember {
  id: number;
  username: string;
  monthly_km: number;
  rank: number;
}

interface ActiveBattle {
  battle_id: number;
  battle_name: string;
  battle_type: string;
  my_team: string;
  team_a_label: string;
  team_b_label: string;
  team_a_km: number;
  team_b_km: number;
  days_left: number;
  start_date: string;
  end_date: string;
  crew_a_name: string | null;
  crew_b_name: string | null;
}

export default function HomePage() {
  const router = useRouter();
  const [me, setMe] = useState<AuthUser | null>(null);
  const [ranking, setRanking] = useState<RankMember[]>([]);
  const [activeBattles, setActiveBattles] = useState<ActiveBattle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored) { router.replace("/"); return; }

    // 프로필을 API에서 최신으로 가져옴
    getUserProfile(stored.id)
      .then((data) => {
        setMe(data);
        saveUser(data);
        // 유저의 크루 ID로 랭킹 조회
        // 활성 팀전 조회
        fetch(`${API_BASE}/crews/battles/my-active/?user_id=${data.id}`, { cache: "no-store" })
          .then((r) => r.json())
          .then((battles) => setActiveBattles(battles))
          .catch(() => {});

        if (data.crew) {
          return getCrewRanking(data.crew).then((r) => {
            const list = r.ranking || (Array.isArray(r) ? r : []);
            setRanking(list.map((m: any) => ({ id: m.id, username: m.username, monthly_km: m.monthly_km, rank: m.rank })));
            setLoading(false);
          });
        }
        setLoading(false);
      })
      .catch(() => { setMe(stored); setLoading(false); });
  }, [router]);

  if (!me) return null;

  const myRank = ranking.find((r) => r.id === me.id)?.rank || "-";

  return (
    <AppShell>
      {/* Top bar */}
      <div className="w-full bg-[var(--dark)] text-white px-4 py-3 text-sm font-bold flex items-center gap-2">
        <span className="flex-1">🏃 러닝크루</span>
        <button onClick={() => router.push("/mypage")} className="opacity-80 text-lg">⚙️</button>
      </div>

      <div className="p-4 space-y-3">
        <p className="text-xs text-gray-400">3월 나의 기록</p>

        {/* Stat card */}
        <div
          className="rounded-xl p-5 text-center text-white"
          style={{ background: "linear-gradient(135deg, #FF5722, #FF8A65)" }}
        >
          <div className="text-3xl font-extrabold">{fmtKm(me.monthly_km)} km</div>
          <div className="text-xs opacity-80 mt-1">이번달 누적 거리</div>
          <div className="grid grid-cols-4 gap-2 mt-4">
            <div className="text-center">
              <div className="text-base font-extrabold">{fmtKm(me.yearly_km)}</div>
              <div className="text-[9px] opacity-80">올해 누적km</div>
            </div>
            <div className="text-center">
              <div className="text-base font-extrabold">{me.run_days}일</div>
              <div className="text-[9px] opacity-80">이번달 러닝일</div>
            </div>
            <div className="text-center">
              <div className="text-base font-extrabold">{myRank}위</div>
              <div className="text-[9px] opacity-80">크루 내 순위</div>
            </div>
            <div className="text-center">
              <div className="text-base font-extrabold">{me.monthly_meetup || 0}회</div>
              <div className="text-[9px] opacity-80">오프벙</div>
            </div>
          </div>
        </div>

        {/* 활성 팀전 배너 */}
        {activeBattles.map((b) => {
          const isTeamA = b.my_team === "A";
          const myTeamKm = isTeamA ? b.team_a_km : b.team_b_km;
          const otherTeamKm = isTeamA ? b.team_b_km : b.team_a_km;
          const myTeamLabel = isTeamA ? (b.team_a_label || "A팀") : (b.team_b_label || "B팀");
          const otherTeamLabel = isTeamA ? (b.team_b_label || "B팀") : (b.team_a_label || "A팀");

          return (
            <BattleCard
              key={b.battle_id}
              battleName={b.battle_name}
              battleType={b.battle_type as "external" | "internal"}
              myTeamLabel={myTeamLabel}
              otherTeamLabel={otherTeamLabel}
              myTeamKm={myTeamKm}
              otherTeamKm={otherTeamKm}
              daysLeft={b.days_left}
              startDate={b.start_date}
              endDate={b.end_date}
              isMyTeamA={isTeamA}
            />
          );
        })}

        {/* 크루 미소속 배너 */}
        {!me.crew && (
          <div className="bg-white rounded-xl p-5 shadow-sm text-center space-y-3">
            <div className="text-3xl">🏃</div>
            <p className="text-sm font-bold">아직 크루에 소속되지 않았어요</p>
            <p className="text-xs text-gray-400">크루를 만들거나 가입해서 함께 달려보세요!</p>
            <div className="flex gap-2">
              <button
                onClick={() => router.push("/onboarding")}
                className="flex-1 bg-[var(--primary)] text-white rounded-lg py-2.5 text-sm font-bold active:scale-95 transition-transform"
              >
                🏃 크루 만들기
              </button>
              <button
                onClick={() => router.push("/onboarding")}
                className="flex-1 bg-gray-100 text-gray-600 rounded-lg py-2.5 text-sm font-bold active:scale-95 transition-transform"
              >
                📷 QR 가입
              </button>
            </div>
          </div>
        )}

        {/* Crew ranking */}
        {me.crew && (
        <div>
          <p className="text-xs font-bold mb-2 cursor-pointer active:opacity-70" onClick={() => router.push("/ranking?tab=distance&sub=monthly")}>크루내 개인랭킹 ({me.crew_name}) <span className="text-gray-400">→</span></p>
          {loading ? (
            <div className="text-center text-gray-400 text-sm py-4">로딩 중...</div>
          ) : ranking.length === 0 ? (
            <div className="text-center text-gray-400 text-sm py-4">아직 기록이 없습니다</div>
          ) : (
            <div className="space-y-1.5">
              {ranking.slice(0, 5).map((m) => {
                const isMe = m.id === me.id;
                const medal = m.rank === 1 ? "🥇" : m.rank === 2 ? "🥈" : m.rank === 3 ? "🥉" : "";
                return (
                  <div
                    key={m.id}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm shadow-sm ${
                      isMe ? "bg-orange-50 border border-orange-200" : "bg-white"
                    }`}
                  >
                    <span className="font-extrabold text-[var(--primary)] w-5">{m.rank}</span>
                    {medal && <span>{medal}</span>}
                    <span className={`flex-1 font-semibold ${isMe ? "text-[var(--primary)]" : ""}`}>
                      {isMe ? `나 (${m.username})` : m.username}
                    </span>
                    <span className={`font-bold ${isMe ? "text-[var(--primary)]" : "text-[var(--dark)]"}`}>
                      {fmtKm(m.monthly_km)}km
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        )}
      </div>
    </AppShell>
  );
}
