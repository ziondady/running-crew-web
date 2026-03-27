"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { getStoredUser } from "@/lib/auth";
import { fmtKm } from "@/lib/format";

const API_BASE = "http://localhost:8000/api";

// Dynamic import for Leaflet (SSR 불가)
const MapView = dynamic(() => import("@/components/GPSMap"), { ssr: false });

interface GpsPoint {
  lat: number;
  lng: number;
  timestamp: number;
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatPace(kmPerSecond: number): string {
  if (kmPerSecond <= 0) return "--:--";
  const secPerKm = 1 / kmPerSecond;
  const m = Math.floor(secPerKm / 60);
  const s = Math.floor(secPerKm % 60);
  return `${m}'${String(s).padStart(2, "0")}"`;
}

export default function GPSPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "running" | "paused" | "stopped">("idle");
  const [points, setPoints] = useState<GpsPoint[]>([]);
  const [distance, setDistance] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);

  const addPoint = useCallback((lat: number, lng: number) => {
    const now = Date.now();
    setPoints((prev) => {
      const newPoint: GpsPoint = { lat, lng, timestamp: now };
      if (prev.length > 0) {
        const last = prev[prev.length - 1];
        const d = haversine(last.lat, last.lng, lat, lng);
        // 최소 3m 이동해야 기록 (GPS 노이즈 필터링)
        if (d < 0.001) return prev; // 1m 미만 이동은 노이즈
        setDistance((prevDist) => Math.round((prevDist + d) * 100) / 100);
      }
      return [...prev, newPoint];
    });
  }, []);

  const startTracking = () => {
    if (!navigator.geolocation) {
      setError("이 브라우저는 GPS를 지원하지 않습니다");
      return;
    }

    setError(null);
    setStatus("running");
    startTimeRef.current = Date.now() - pausedTimeRef.current * 1000;

    // Timer
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    // GPS watch
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        addPoint(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        if (err.code === 1) {
          setPermissionDenied(true);
          setError("GPS 권한이 거부되었습니다. 브라우저 설정에서 위치 권한을 허용해주세요.");
          stopTracking();
        } else {
          setError(`GPS 오류: ${err.message}`);
        }
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );
  };

  const pauseTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    pausedTimeRef.current = elapsed;
    setStatus("paused");
  };

  const resumeTracking = () => {
    startTracking();
  };

  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setStatus("stopped");
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleSave = async () => {
    const me = getStoredUser();
    if (!me) { router.push("/"); return; }

    setSaving(true);
    try {
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const gpsData = points.map((p) => ({ lat: p.lat, lng: p.lng }));

      const res = await fetch(`${API_BASE}/running/logs/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user: me.id,
          date: dateStr,
          distance: Math.round(distance * 100) / 100,
          buff_distance: Math.round(distance * 100) / 100,
          source: "gps",
          gps_data: gpsData,
        }),
      });
      if (!res.ok) throw new Error("저장 실패");
      setSaved(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setPoints([]);
    setDistance(0);
    setElapsed(0);
    setStatus("idle");
    setSaved(false);
    setError(null);
    pausedTimeRef.current = 0;
  };

  const pace = elapsed > 0 && distance > 0 ? distance / elapsed : 0;
  const currentPos = points.length > 0 ? points[points.length - 1] : null;

  return (
    <div className="max-w-[430px] w-full mx-auto min-h-screen bg-[#1a2a3a] flex flex-col">
      {/* Map */}
      <div className="relative" style={{ height: "55vh" }}>
        <MapView points={points} currentPos={currentPos} />

        {/* Back button */}
        <button
          onClick={() => {
            if (status === "running") pauseTracking();
            router.back();
          }}
          className="absolute top-4 left-4 z-[1000] bg-black/50 text-white w-10 h-10 rounded-full flex items-center justify-center text-lg"
        >
          ←
        </button>

        {/* Status badge */}
        {status === "running" && (
          <div className="absolute top-4 right-4 z-[1000] bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full" style={{ animation: "dDayPulse 2s ease-in-out infinite" }}>
            ● REC
          </div>
        )}
      </div>

      {/* Stats panel */}
      <div className="bg-[#111] p-4">
        {/* Main stat */}
        <div className="text-center mb-3">
          <div className="text-4xl font-black text-white" style={{ animation: status === "running" ? "kmPop 0.3s ease-out" : "none" }}>
            {fmtKm(distance)}
          </div>
          <div className="text-xs text-gray-500">km</div>
        </div>

        {/* Sub stats */}
        <div className="grid grid-cols-3 gap-4 text-center mb-4">
          <div>
            <div className="text-lg font-bold text-white">{formatPace(pace)}</div>
            <div className="text-[10px] text-gray-500">페이스/km</div>
          </div>
          <div>
            <div className="text-lg font-bold text-white">{formatTime(elapsed)}</div>
            <div className="text-[10px] text-gray-500">시간</div>
          </div>
          <div>
            <div className="text-lg font-bold text-white">{points.length}</div>
            <div className="text-[10px] text-gray-500">GPS 포인트</div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/20 text-red-400 text-xs rounded-lg px-3 py-2 mb-3 text-center">
            {error}
          </div>
        )}

        {/* Controls */}
        {status === "idle" && !saved && (
          <button
            onClick={startTracking}
            disabled={permissionDenied}
            className="w-full bg-green-500 text-white rounded-xl py-4 text-lg font-black active:scale-95 transition-transform disabled:opacity-50"
          >
            ▶ START
          </button>
        )}

        {status === "running" && (
          <div className="flex gap-3">
            <button
              onClick={pauseTracking}
              className="flex-1 bg-yellow-500 text-white rounded-xl py-4 text-sm font-bold"
            >
              ⏸ 일시정지
            </button>
            <button
              onClick={stopTracking}
              className="flex-1 bg-red-500 text-white rounded-xl py-4 text-sm font-bold"
            >
              ⏹ STOP
            </button>
          </div>
        )}

        {status === "paused" && (
          <div className="flex gap-3">
            <button
              onClick={resumeTracking}
              className="flex-1 bg-green-500 text-white rounded-xl py-4 text-sm font-bold"
            >
              ▶ 이어달리기
            </button>
            <button
              onClick={stopTracking}
              className="flex-1 bg-red-500 text-white rounded-xl py-4 text-sm font-bold"
            >
              ⏹ 종료
            </button>
          </div>
        )}

        {status === "stopped" && !saved && (
          <div className="space-y-2">
            <button
              onClick={handleSave}
              disabled={saving || points.length < 2}
              className="w-full bg-[#FF5722] text-white rounded-xl py-4 text-sm font-bold active:scale-95 transition-transform disabled:opacity-50"
            >
              {saving ? "저장 중..." : `💾 저장하기 (${fmtKm(distance)}km)`}
            </button>
            <button
              onClick={handleReset}
              className="w-full bg-gray-700 text-gray-300 rounded-xl py-3 text-xs font-bold"
            >
              취소 (기록 삭제)
            </button>
          </div>
        )}

        {saved && (
          <div className="text-center" style={{ animation: "cardSlideIn 0.5s ease-out" }}>
            <div className="text-3xl mb-2" style={{ animation: "confettiFall 2s ease-in-out infinite" }}>🎉</div>
            <div className="text-lg font-bold text-green-400">저장 완료!</div>
            <div className="text-xs text-gray-500 mt-1">점령전에 반영됩니다</div>
            <div className="flex gap-2 mt-3">
              <button onClick={handleReset} className="flex-1 bg-gray-700 text-gray-300 rounded-xl py-3 text-xs font-bold">
                다시 달리기
              </button>
              <button onClick={() => router.push("/home")} className="flex-1 bg-[#FF5722] text-white rounded-xl py-3 text-xs font-bold">
                홈으로
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
