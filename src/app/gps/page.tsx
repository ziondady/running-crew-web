"use client";
import { API_BASE } from "@/lib/api";
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { getStoredUser } from "@/lib/auth";
import { fmtKm } from "@/lib/format";
import { saveLocation } from "@/lib/location";
import { registerPlugin } from "@capacitor/core";

// BackgroundGeolocation은 네이티브 전용 플러그인 — Capacitor 브릿지로 등록
interface BgGeoPlugin {
  addWatcher(options: any, callback: (location: any, error: any) => void): Promise<string>;
  removeWatcher(options: { id: string }): Promise<void>;
}
const BackgroundGeolocation = registerPlugin<BgGeoPlugin>("BackgroundGeolocation");

// Dynamic import for Leaflet (SSR 불가)
const MapView = dynamic(() => import("@/components/GPSMap"), { ssr: false });

interface GpsPoint {
  lat: number;
  lng: number;
  timestamp: number;
}

interface SessionData {
  points: GpsPoint[];
  distance: number;
  elapsed: number;
  status: "idle" | "running" | "paused" | "stopped";
  startTime: number;
}

const SESSION_KEY = "gps_session";

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
  const [toast, setToast] = useState<string | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);

  // watchIdRef now stores a string (Capacitor) or null; fallback stores a string as well
  const bgWatcherIdRef = useRef<string | null>(null);
  const fgWatchIdRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);
  const lastGpsTimeRef = useRef<number>(0);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // --- Session persistence helpers ---
  const saveSession = useCallback(
    (
      pts: GpsPoint[],
      dist: number,
      el: number,
      st: "idle" | "running" | "paused" | "stopped",
      startTime: number
    ) => {
      const data: SessionData = { points: pts, distance: dist, elapsed: el, status: st, startTime };
      localStorage.setItem(SESSION_KEY, JSON.stringify(data));
    },
    []
  );

  const clearSession = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
  }, []);

  // --- Wake Lock ---
  const requestWakeLock = useCallback(async () => {
    if (typeof navigator !== "undefined" && "wakeLock" in navigator) {
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
      } catch {
        // Wake lock not critical — ignore errors
      }
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch {
        // Ignore
      }
      wakeLockRef.current = null;
    }
  }, []);

  // --- Toast ---
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  // --- addPoint ---
  const addPoint = useCallback(
    (lat: number, lng: number, speed?: number | null) => {
      const now = Date.now();
      saveLocation(lat, lng);
      setPoints((prev) => {
        const newPoint: GpsPoint = { lat, lng, timestamp: now };
        if (prev.length > 0) {
          const last = prev[prev.length - 1];
          const d = haversine(last.lat, last.lng, lat, lng);
          // Speed-based noise filter: standing still (speed < 0.3 m/s) AND tiny move (< 5m) → skip
          const spd = speed ?? null;
          if (spd !== null && spd < 0.3 && d < 0.005) return prev;
          // Distance noise filter: < 3m → skip (fallback when speed unavailable)
          if (d < 0.003) return prev;
          setDistance((prevDist) => Math.round((prevDist + d) * 100) / 100);
        }
        return [...prev, newPoint];
      });
    },
    []
  );

  // Persist points to sessionStorage whenever they change
  useEffect(() => {
    setPoints((pts) => {
      // Read current distance/elapsed from state (we snapshot here via closure)
      saveSession(pts, distance, elapsed, status, startTimeRef.current);
      return pts;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, distance, elapsed, status]);

  // --- Stop all watchers (internal helper) ---
  const stopAllWatchers = useCallback(async () => {
    if (bgWatcherIdRef.current !== null) {
      try {
        await BackgroundGeolocation.removeWatcher({ id: bgWatcherIdRef.current });
      } catch {
        // Ignore
      }
      bgWatcherIdRef.current = null;
    }
    if (fgWatchIdRef.current !== null) {
      try {
        navigator.geolocation.clearWatch(Number(fgWatchIdRef.current));
      } catch {
        // Ignore
      }
      fgWatchIdRef.current = null;
    }
  }, []);

  // --- Start tracking ---
  const startTracking = useCallback(async () => {
    setError(null);
    setStatus("running");
    startTimeRef.current = Date.now() - pausedTimeRef.current * 1000;

    await requestWakeLock();

    // Timer
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    // GPS signal check every 5s — 정지 시에도 gpsAccuracy가 있으면 신호 양호로 판단
    const gpsCheckInterval = setInterval(() => {
      if (lastGpsTimeRef.current > 0) {
        const gap = Date.now() - lastGpsTimeRef.current;
        // distanceFilter 사용 시 정지하면 업데이트 안 옴 → 30초 이상 & 정확도 없을 때만 경고
        if (gap > 30000) {
          showToast("📡 GPS 신호를 찾는 중...");
        }
      }
    }, 5000);

    // Shared position handler (BackgroundGeolocation location shape)
    const handleBgLocation = (
      location: { latitude: number; longitude: number; accuracy: number; speed: number | null } | null,
      error: Error | null
    ) => {
      if (error) {
        // BackgroundGeolocation failed → will fall back to Capacitor Geolocation below
        return;
      }
      if (!location) return;

      const { latitude, longitude, accuracy, speed } = location;
      setGpsAccuracy(Math.round(accuracy));
      lastGpsTimeRef.current = Date.now();

      if (accuracy > 20) {
        showToast(`📡 GPS 정확도 낮음 (${Math.round(accuracy)}m)`);
        return;
      }
      addPoint(latitude, longitude, speed);
    };

    // --- PRIMARY: BackgroundGeolocation ---
    let bgStarted = false;
    try {
      const watcherId = await BackgroundGeolocation.addWatcher(
        {
          backgroundMessage: "러닝 기록 중...",
          backgroundTitle: "러닝크루",
          requestPermissions: true,
          stale: false,
          distanceFilter: 5,
        },
        handleBgLocation
      );
      bgWatcherIdRef.current = watcherId;
      bgStarted = true;
    } catch (bgErr) {
      // BackgroundGeolocation unavailable (e.g. web browser) — fall through to Capacitor Geolocation
    }

    // --- FALLBACK: navigator.geolocation.watchPosition ---
    if (!bgStarted) {
      try {
        const nativeWatchId = navigator.geolocation.watchPosition(
          (position) => {
            const { latitude, longitude, accuracy, speed } = position.coords;
            setGpsAccuracy(Math.round(accuracy));
            lastGpsTimeRef.current = Date.now();
            if (accuracy > 20) {
              showToast(`📡 GPS 정확도 낮음 (${Math.round(accuracy)}m)`);
              return;
            }
            addPoint(latitude, longitude, speed);
          },
          (err) => {
            if (err.code === 1) {
              setPermissionDenied(true);
              setError("GPS 권한이 거부되었습니다. 설정에서 위치 권한을 허용해주세요.");
            } else if (err.code === 2) {
              showToast("📡 GPS를 찾을 수 없습니다. 실외로 이동해주세요");
            } else if (err.code === 3) {
              showToast("📡 GPS 응답 시간 초과. 재시도 중...");
            }
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
        fgWatchIdRef.current = String(nativeWatchId);
      } catch (fgErr: any) {
        setError("GPS를 시작할 수 없습니다.");
        clearInterval(gpsCheckInterval);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        setStatus("idle");
        await releaseWakeLock();
        return;
      }
    }

    // Store gpsCheck cleanup alongside; resolved on stop/pause
    (timerRef as any)._gpsCheck = gpsCheckInterval;
  }, [addPoint, requestWakeLock, releaseWakeLock, showToast, stopAllWatchers]);

  // Forward-declare stopTracking so startTracking can reference it in error handler
  // eslint-disable-next-line prefer-const
  let stopTracking: () => Promise<void>;

  const pauseTracking = useCallback(async () => {
    await stopAllWatchers();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      if ((timerRef as any)._gpsCheck) clearInterval((timerRef as any)._gpsCheck);
      timerRef.current = null;
    }
    pausedTimeRef.current = elapsed;
    setStatus("paused");
    await releaseWakeLock();
  }, [elapsed, stopAllWatchers, releaseWakeLock]);

  const resumeTracking = useCallback(() => {
    startTracking();
  }, [startTracking]);

  stopTracking = useCallback(async () => {
    await stopAllWatchers();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      if ((timerRef as any)._gpsCheck) clearInterval((timerRef as any)._gpsCheck);
      timerRef.current = null;
    }
    setStatus("stopped");
    await releaseWakeLock();
  }, [stopAllWatchers, releaseWakeLock]);

  // --- Restore session on mount ---
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const data: SessionData = JSON.parse(raw);
        if (data.points && data.points.length > 0) {
          setPoints(data.points);
          setDistance(data.distance ?? 0);
          setElapsed(data.elapsed ?? 0);
          // Restore as paused regardless — user must explicitly resume
          setStatus("paused");
          pausedTimeRef.current = data.elapsed ?? 0;
          startTimeRef.current = data.startTime ?? Date.now();
        }
      }
    } catch {
      // Corrupted session — ignore
    }
  }, []);

  // --- visibilitychange: save state when app goes to background ---
  useEffect(() => {
    const handleVisibility = () => {
      setPoints((pts) => {
        setDistance((dist) => {
          setElapsed((el) => {
            setStatus((st) => {
              saveSession(pts, dist, el, st, startTimeRef.current);
              return st;
            });
            return el;
          });
          return dist;
        });
        return pts;
      });
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [saveSession]);

  // --- Cleanup on unmount ---
  useEffect(() => {
    return () => {
      stopAllWatchers();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        if ((timerRef as any)._gpsCheck) clearInterval((timerRef as any)._gpsCheck);
      }
      releaseWakeLock();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Save run ---
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
      clearSession();
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
    clearSession();
  };

  const pace = elapsed > 0 && distance > 0 ? distance / elapsed : 0;
  const currentPos = points.length > 0 ? points[points.length - 1] : null;

  return (
    <div className="max-w-[430px] w-full mx-auto h-screen bg-[#1a2a3a] flex flex-col overflow-hidden relative">
      {/* 화면잠금 오버레이 - full screen */}
      {locked && (
        <div
          className="absolute inset-0 z-[2000] flex items-center justify-center bg-black/70"
          onDoubleClick={() => setLocked(false)}
        >
          <div className="text-center">
            <div className="text-4xl mb-3">🔒</div>
            <div className="text-white text-sm font-bold">화면이 잠겨있습니다</div>
            <div className="text-gray-400 text-xs mt-1">두 번 터치하면 잠금 해제</div>
            <div className="text-white text-2xl font-black mt-4">{fmtKm(distance)} km</div>
            <div className="text-gray-400 text-xs mt-1">{formatTime(elapsed)}</div>
          </div>
        </div>
      )}

      {/* Map - fills remaining space */}
      <div className="flex-1 relative">
        <MapView points={points} currentPos={currentPos} />

        {/* Toast popup */}
        {toast && (
          <div
            className="absolute top-16 left-4 right-4 z-[1000] bg-black/80 text-white text-xs font-bold text-center py-3 px-4 rounded-xl"
            style={{ animation: "cardSlideIn 0.3s ease-out" }}
          >
            {toast}
          </div>
        )}

        {/* GPS accuracy indicator */}
        {status === "running" && gpsAccuracy !== null && (
          <div className={`absolute top-4 left-16 z-[1000] text-[10px] font-bold px-2 py-1 rounded-full ${
            gpsAccuracy <= 10 ? "bg-green-500 text-white" :
            gpsAccuracy <= 30 ? "bg-yellow-500 text-white" :
            "bg-red-500 text-white"
          }`}>
            📡 {gpsAccuracy}m
          </div>
        )}

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

        {/* Status badge + Lock button */}
        {status === "running" && (
          <>
            <div className="absolute top-4 right-4 z-[1000]">
              <div className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full" style={{ animation: "dDayPulse 2s ease-in-out infinite" }}>
                ● REC
              </div>
            </div>
            <button
              onClick={() => setLocked(true)}
              className="absolute bottom-3 left-3 z-[1000] bg-red-500 text-white font-bold px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-1.5 text-sm active:scale-95 transition-transform"
            >
              🔒 화면잠금
            </button>
          </>
        )}

      </div>

      {/* Stats panel */}
      <div className="bg-[#111] p-4 flex-shrink-0">
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
              disabled={saving || distance < 0.01}
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
