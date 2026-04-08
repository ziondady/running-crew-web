"use client";
import { API_BASE } from "@/lib/api";import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import AppShell from "@/components/AppShell";
import TopBar from "@/components/TopBar";
import { getStoredUser, AuthUser } from "@/lib/auth";


export default function OperatorQR() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [qrToken, setQrToken] = useState("");
  const [crewName, setCrewName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const joinUrl = qrToken ? `${window.location.origin}/join?token=${qrToken}` : "";

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

    fetch(`${API_BASE}/crews/crews/${stored.crew}/qr/`, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setQrToken(data.qr_token);
        setCrewName(data.crew_name);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [router]);

  const handleCopy = () => {
    if (!joinUrl) return;
    navigator.clipboard.writeText(joinUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleShare = () => {
    if (!joinUrl) return;
    if (navigator.share) {
      navigator.share({
        title: `${crewName} 크루 가입`,
        text: "배틀크루에 합류하세요!",
        url: joinUrl,
      });
    } else {
      handleCopy();
    }
  };

  if (!user) return null;

  return (
    <AppShell>
      <TopBar title="📷 QR 생성 / 공유" back />
      <div className="p-4 space-y-4">
        {/* Header */}
        <div
          className="rounded-xl p-4 text-white shadow"
          style={{ background: "linear-gradient(135deg, #1565C0, #1976D2)" }}
        >
          <div className="font-bold text-base">{crewName || user.crew_name}</div>
          <div className="text-xs opacity-70 mt-0.5">크루 초대 QR 코드</div>
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
          <>
            {/* QR Code */}
            <div className="bg-white rounded-xl p-6 shadow-sm text-center space-y-4">
              <div className="inline-block p-4 bg-white rounded-xl border-2 border-gray-100">
                <QRCodeSVG
                  value={joinUrl}
                  size={200}
                  level="H"
                  fgColor="#1A1A2E"
                  bgColor="#FFFFFF"
                />
              </div>
              <p className="text-xs text-gray-400">이 QR코드를 멤버에게 보여주세요</p>

              {/* Token */}
              <div>
                <div className="text-xs text-gray-400 mb-1">초대 토큰</div>
                <div className="font-mono text-xs font-bold bg-gray-50 rounded-lg px-4 py-2 text-blue-700 break-all">
                  {qrToken}
                </div>
              </div>
            </div>

            {/* Join URL */}
            <div className="bg-white rounded-xl p-4 shadow-sm space-y-2">
              <div className="text-xs text-gray-400 font-bold">가입 링크</div>
              <div className="text-xs text-gray-600 break-all bg-gray-50 rounded-lg p-3">
                {joinUrl}
              </div>
            </div>

            {/* Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleCopy}
                className="rounded-xl py-3.5 font-bold text-sm text-white transition-all"
                style={{ background: copied ? "#43A047" : "#1565C0" }}
              >
                {copied ? "✓ 복사됨!" : "🔗 링크 복사"}
              </button>
              <button
                onClick={handleShare}
                className="rounded-xl py-3.5 font-bold text-sm text-white"
                style={{ background: "#FF5722" }}
              >
                📤 공유하기
              </button>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
