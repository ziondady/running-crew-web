"use client";
import { API_BASE, getTerritoryCells } from "@/lib/api";
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { getStoredUser } from "@/lib/auth";
import { fmtKm } from "@/lib/format";
import { saveLocation, getCachedLocation } from "@/lib/location";
import { registerPlugin } from "@capacitor/core";
import { checkGpsPermission, PermissionStatus } from "@/lib/gpsPermissions";
import { startBackup, appendPoint as appendBackupPoint, readBackup, clearBackup } from "@/lib/gpsBackup";

// BackgroundGeolocation은 네이티브 전용 플러그인 — Capacitor 브릿지로 등록
interface BgGeoPlugin {
  addWatcher(options: any, callback: (location: any, error: any) => void): Promise<string>;
  removeWatcher(options: { id: string }): Promise<void>;
}
const BackgroundGeolocation = registerPlugin<BgGeoPlugin>("BackgroundGeolocation");

// iOS Wake Lock 네이티브 플러그인
interface WakeLockNativePlugin {
  acquire(): Promise<any>;
  release(): Promise<any>;
}
const WakeLockNative = registerPlugin<WakeLockNativePlugin>("WakeLock");

// Dynamic import for Leaflet (SSR 불가)
const MapView = dynamic(() => import("@/components/GPSMap"), { ssr: false });
const RunShareCard = dynamic(() => import("@/components/RunShareCard"), { ssr: false });

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

interface CellItem {
  id: number;
  cell_key: string;
  user: number;
  username: string;
  user_color: string;
  crew_id: number | null;
  crew_name: string | null;
  durability: number;
  bounds: { south: number; north: number; west: number; east: number };
}

const SESSION_KEY = "gps_session";
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h

// Watcher health check constants
const HEALTH_CHECK_INTERVAL_MS = 10_000;       // 10s 마다 체크
const WATCHER_STALE_THRESHOLD_MS = 45_000;     // 45s 끊기면 재시작
const SIGNAL_WARNING_THRESHOLD_MS = 20_000;    // 20s 끊기면 경고만
const FIRST_POINT_TIMEOUT_MS = 20_000;         // 시작 20s 안에 첫 포인트 없으면 경고
const MAX_RESTART_ATTEMPTS = 3;                // 1분 내 재시작 최대 횟수
const RESTART_WINDOW_MS = 60_000;

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
  const [countdown, setCountdown] = useState<number | string | null>(null);
  const [gpsNotReady, setGpsNotReady] = useState(false);
  const [gpsWarmupReady, setGpsWarmupReady] = useState(false);
  const [territoryCells, setTerritoryCells] = useState<CellItem[]>([]);
  const [showTerritoryCells, setShowTerritoryCells] = useState(true);

  // watchIdRef now stores a string (Capacitor) or null; fallback stores a string as well
  const bgWatcherIdRef = useRef<string | null>(null);
  const fgWatchIdRef = useRef<string | null>(null);
  const warmupWatchIdRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);
  const lastGpsTimeRef = useRef<number>(0);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // --- Health check & recovery state ---
  const statusRef = useRef<"idle" | "running" | "paused" | "stopped">("idle");
  const healthCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const firstPointTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restartStateRef = useRef({ count: 0, windowStart: 0 });
  const lastWarnRef = useRef(0);
  const [showShare, setShowShare] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus | null>(null);
  const [recoveryPrompt, setRecoveryPrompt] = useState<{ points: GpsPoint[]; distance: number; elapsed: number; startTime: number } | null>(null);

  // status state를 ref에 동기화 (setInterval 클로저 안에서 최신 값 필요)
  useEffect(() => { statusRef.current = status; }, [status]);

  // --- Session persistence helpers ---
  const saveSession = useCallback(
    (
      pts: GpsPoint[],
      dist: number,
      el: number,
      st: "idle" | "running" | "paused" | "stopped",
      startTime: number
    ) => {
      const data: SessionData & { savedAt: number } = {
        points: pts, distance: dist, elapsed: el, status: st, startTime,
        savedAt: Date.now(),
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(data));
    },
    []
  );

  const clearSession = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
  }, []);

  // --- Wake Lock (브라우저 API + iOS 네이티브) ---
  const requestWakeLock = useCallback(async () => {
    // 브라우저 Wake Lock API (Android)
    if (typeof navigator !== "undefined" && "wakeLock" in navigator) {
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
      } catch {
        // Wake lock not critical — ignore errors
      }
    }
    // iOS 네이티브 Wake Lock
    try { await WakeLockNative.acquire(); } catch {}
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch {}
      wakeLockRef.current = null;
    }
    try { await WakeLockNative.release(); } catch {}
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
        // 네이티브 백업 파일에 즉시 append (fire-and-forget)
        appendBackupPoint({ lat, lng, timestamp: now }).catch(() => {});
        if (prev.length > 0) {
          const last = prev[prev.length - 1];
          const d = haversine(last.lat, last.lng, lat, lng);
          const timeDelta = (now - last.timestamp) / 1000; // seconds

          // 1. GPS 튐 방지: 시간 대비 비현실적 이동 (400km/h 이상) → skip  [TEMP: raised for KTX testing]
          if (timeDelta > 0 && d / timeDelta > 0.1111) return prev;

          // 2. 정지 상태 필터: speed < 0.5 m/s AND 이동 < 10m → skip
          const spd = speed ?? null;
          if (spd !== null && spd < 0.5 && d < 0.01) return prev;

          // 3. 최소 이동 거리: < 8m → skip (GPS 드리프트 누적 방지)
          if (d < 0.008) return prev;

          // 4. 연속 소이동 필터: 직전 3개 포인트 평균 이동이 5m 미만이면 skip
          if (prev.length >= 3) {
            let recentTotal = 0;
            for (let i = prev.length - 2; i >= Math.max(0, prev.length - 3); i--) {
              recentTotal += haversine(prev[i].lat, prev[i].lng, prev[i + 1].lat, prev[i + 1].lng);
            }
            const recentAvg = recentTotal / Math.min(2, prev.length - 1);
            if (recentAvg < 0.005 && d < 0.01) return prev;
          }

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

  // --- Position handler (shared across initial start and health-check restarts) ---
  const handleBgLocation = useCallback((
    location: { latitude: number; longitude: number; accuracy: number; speed: number | null } | null,
    error: Error | null
  ) => {
    if (error) return;
    if (!location) return;
    const { latitude, longitude, accuracy, speed } = location;
    setGpsAccuracy(Math.round(accuracy));
    lastGpsTimeRef.current = Date.now();
    if (accuracy > 15) {
      const now = Date.now();
      if (now - lastWarnRef.current > 15_000) {
        showToast(`📡 GPS 정확도 낮음 (${Math.round(accuracy)}m)`);
        lastWarnRef.current = now;
      }
      return;
    }
    addPoint(latitude, longitude, speed);
  }, [addPoint, showToast]);

  // --- Native BG watcher start (returns true on success) ---
  const startNativeWatcher = useCallback(async (): Promise<boolean> => {
    try {
      const watcherId = await BackgroundGeolocation.addWatcher(
        {
          backgroundMessage: "러닝 기록 중...",
          backgroundTitle: "배틀크루",
          requestPermissions: true,
          stale: false,
          distanceFilter: 5,
        },
        handleBgLocation
      );
      bgWatcherIdRef.current = watcherId;
      return true;
    } catch {
      return false;
    }
  }, [handleBgLocation]);

  // --- Fallback foreground watcher (web browser or native failure) ---
  const startFgWatcher = useCallback((): boolean => {
    try {
      const nativeWatchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, accuracy, speed } = position.coords;
          setGpsAccuracy(Math.round(accuracy));
          lastGpsTimeRef.current = Date.now();
          if (accuracy > 15) {
            const now = Date.now();
            if (now - lastWarnRef.current > 15_000) {
              showToast(`📡 GPS 정확도 낮음 (${Math.round(accuracy)}m)`);
              lastWarnRef.current = now;
            }
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
      return true;
    } catch {
      return false;
    }
  }, [addPoint, showToast]);

  // --- Health-check: automatic watcher restart on stale/dead signal ---
  const restartWatcher = useCallback(async () => {
    const now = Date.now();
    const state = restartStateRef.current;
    // Reset window if outside
    if (now - state.windowStart > RESTART_WINDOW_MS) {
      state.count = 0;
      state.windowStart = now;
    }
    if (state.count >= MAX_RESTART_ATTEMPTS) {
      showToast("⚠️ GPS 복구 실패. 앱을 다시 실행해주세요.");
      return;
    }
    state.count += 1;

    showToast("🔄 GPS 재연결 중...");

    // 기존 watcher 정리
    await stopAllWatchers();

    // 재시작
    const ok = await startNativeWatcher();
    if (!ok) {
      startFgWatcher();
    }
    lastGpsTimeRef.current = Date.now(); // grace period
  }, [stopAllWatchers, startNativeWatcher, startFgWatcher, showToast]);

  const startHealthCheck = useCallback(() => {
    // 첫 포인트 타임아웃
    if (firstPointTimeoutRef.current) clearTimeout(firstPointTimeoutRef.current);
    firstPointTimeoutRef.current = setTimeout(() => {
      if (statusRef.current === "running" && lastGpsTimeRef.current === 0) {
        showToast("📡 GPS 신호를 찾지 못했습니다. 실외로 이동해주세요");
      }
    }, FIRST_POINT_TIMEOUT_MS);

    // 주기 health check
    if (healthCheckRef.current) clearInterval(healthCheckRef.current);
    healthCheckRef.current = setInterval(() => {
      if (statusRef.current !== "running") return;
      const last = lastGpsTimeRef.current;
      if (last === 0) return;
      const gap = Date.now() - last;
      if (gap > WATCHER_STALE_THRESHOLD_MS) {
        restartWatcher();
      } else if (gap > SIGNAL_WARNING_THRESHOLD_MS) {
        const now = Date.now();
        if (now - lastWarnRef.current > 15_000) {
          showToast(`📡 GPS 신호 약함 (${Math.floor(gap / 1000)}초)`);
          lastWarnRef.current = now;
        }
      }
    }, HEALTH_CHECK_INTERVAL_MS);
  }, [restartWatcher, showToast]);

  const stopHealthCheck = useCallback(() => {
    if (firstPointTimeoutRef.current) {
      clearTimeout(firstPointTimeoutRef.current);
      firstPointTimeoutRef.current = null;
    }
    if (healthCheckRef.current) {
      clearInterval(healthCheckRef.current);
      healthCheckRef.current = null;
    }
  }, []);

  // --- Start tracking ---
  const startTracking = useCallback(async () => {
    setError(null);
    setStatus("running");
    statusRef.current = "running";
    startTimeRef.current = Date.now() - pausedTimeRef.current * 1000;
    lastGpsTimeRef.current = 0; // reset so first-point timeout kicks in
    restartStateRef.current = { count: 0, windowStart: Date.now() };

    await requestWakeLock();

    // 캐시된 위치가 있으면 즉시 첫 포인트로 추가 (S 핀이 바로 보이도록)
    if (points.length === 0) {
      const cached = getCachedLocation();
      if (cached) {
        const seedPoint: GpsPoint = { lat: cached.lat, lng: cached.lng, timestamp: Date.now() };
        setPoints([seedPoint]);
      }
    }

    // 네이티브 백업 파일 초기화 (이어달리기면 기존 백업 유지, 신규 시작이면 초기화)
    if (points.length === 0) {
      try { await startBackup(); } catch {}
    }

    // Timer
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    // PRIMARY: native BG watcher
    const bgOk = await startNativeWatcher();

    // FALLBACK: foreground watcher
    if (!bgOk) {
      const fgOk = startFgWatcher();
      if (!fgOk) {
        setError("GPS를 시작할 수 없습니다.");
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        setStatus("idle");
        statusRef.current = "idle";
        await releaseWakeLock();
        return;
      }
    }

    // health check 가동
    startHealthCheck();
  }, [points.length, requestWakeLock, releaseWakeLock, startNativeWatcher, startFgWatcher, startHealthCheck]);

  // Forward-declare stopTracking so startTracking can reference it in error handler
  // eslint-disable-next-line prefer-const
  let stopTracking: () => Promise<void>;

  const pauseTracking = useCallback(async () => {
    await stopAllWatchers();
    stopHealthCheck();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    pausedTimeRef.current = elapsed;
    setStatus("paused");
    statusRef.current = "paused";
    await releaseWakeLock();
  }, [elapsed, stopAllWatchers, stopHealthCheck, releaseWakeLock]);

  const resumeTracking = useCallback(() => {
    startTracking();
  }, [startTracking]);

  const startWithCountdown = useCallback(async () => {
    setGpsNotReady(false);
    setCountdown(3);
    await new Promise(r => setTimeout(r, 1000));
    setCountdown(2);
    await new Promise(r => setTimeout(r, 1000));
    setCountdown(1);
    await new Promise(r => setTimeout(r, 1000));
    setCountdown("점령시작!");
    await new Promise(r => setTimeout(r, 700));
    setCountdown(null);
    startTracking();
  }, [startTracking]);

  const stopWarmup = useCallback(() => {
    if (warmupWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(warmupWatchIdRef.current);
      warmupWatchIdRef.current = null;
    }
  }, []);

  const handleStart = useCallback(async () => {
    if (!gpsWarmupReady) {
      // 워밍업으로도 GPS 안 잡힘 - 진행 여부 확인
      setGpsNotReady(true);
      return;
    }

    // 워밍업 워처 정리 후 카운트다운 → 시작
    stopWarmup();
    await startWithCountdown();
  }, [gpsWarmupReady, startWithCountdown, stopWarmup]);

  stopTracking = useCallback(async () => {
    await stopAllWatchers();
    stopHealthCheck();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setStatus("stopped");
    statusRef.current = "stopped";
    await releaseWakeLock();
  }, [stopAllWatchers, stopHealthCheck, releaseWakeLock]);

  // --- Restore session on mount (shows prompt instead of auto-resume) ---
  useEffect(() => {
    (async () => {
      // 1. 권한 체크
      try {
        const p = await checkGpsPermission();
        setPermissionStatus(p);
      } catch {}

      // 2. localStorage 세션 + 네이티브 백업 파일 병합
      let sessionPoints: GpsPoint[] = [];
      let sessionDistance = 0;
      let sessionElapsed = 0;
      let sessionStartTime = 0;
      let sessionSavedAt = 0;

      try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (raw) {
          const data = JSON.parse(raw) as SessionData & { savedAt?: number };
          const savedAt = data.savedAt ?? 0;
          // TTL 초과된 세션은 무시하고 삭제
          if (savedAt && Date.now() - savedAt > SESSION_MAX_AGE_MS) {
            localStorage.removeItem(SESSION_KEY);
            await clearBackup();
          } else if (data.points && data.points.length > 0) {
            sessionPoints = data.points;
            sessionDistance = data.distance ?? 0;
            sessionElapsed = data.elapsed ?? 0;
            sessionStartTime = data.startTime ?? Date.now();
            sessionSavedAt = savedAt;
          }
        }
      } catch {}

      // 3. 네이티브 백업 파일과 병합 — 백업에만 있는 최신 포인트가 있으면 추가
      try {
        const backup = await readBackup();
        if (backup && backup.points.length > 0) {
          const lastSessionTs = sessionPoints.length > 0 ? sessionPoints[sessionPoints.length - 1].timestamp : 0;
          const newer = backup.points.filter((p) => p.timestamp > lastSessionTs);
          if (newer.length > 0) {
            // 백업에만 있는 포인트를 세션 포인트 뒤에 이어붙임
            // 거리 재계산
            const merged = [...sessionPoints, ...newer];
            let mergedDistance = sessionDistance;
            for (let i = Math.max(1, sessionPoints.length); i < merged.length; i++) {
              const a = merged[i - 1];
              const b = merged[i];
              mergedDistance += haversine(a.lat, a.lng, b.lat, b.lng);
            }
            sessionPoints = merged;
            sessionDistance = Math.round(mergedDistance * 100) / 100;
          }
          if (sessionStartTime === 0 && backup.meta.startedAt) {
            sessionStartTime = backup.meta.startedAt;
          }
        }
      } catch {}

      if (sessionPoints.length > 0) {
        setRecoveryPrompt({
          points: sessionPoints,
          distance: sessionDistance,
          elapsed: sessionElapsed,
          startTime: sessionStartTime || Date.now(),
        });
      }

      // 영역 셀 로드
      getTerritoryCells().then(setTerritoryCells).catch(() => {});
    })();
  }, []);

  // --- GPS 워밍업: 페이지 진입 시 바로 GPS 잡기 ---
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsAccuracy(pos.coords.accuracy);
        setGpsWarmupReady(true);
        saveLocation(pos.coords.latitude, pos.coords.longitude);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
    warmupWatchIdRef.current = id;
    return () => {
      navigator.geolocation.clearWatch(id);
      warmupWatchIdRef.current = null;
    };
  }, []);

  // --- visibilitychange: save state + Wake Lock 재획득 + GPS 재시작 ---
  useEffect(() => {
    const handleVisibility = () => {
      // 세션 저장
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

      // 앱 복귀 시 (visible) 러닝 중이면 Wake Lock 재획득 + GPS 재시작
      if (document.visibilityState === "visible" && statusRef.current === "running") {
        // 앱 복귀 시 타이머 즉시 갱신 (백그라운드에서 interval이 throttle됐을 수 있음)
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
        requestWakeLock();
        // GPS가 끊겼을 수 있으므로 watcher 재시작
        const gap = Date.now() - lastGpsTimeRef.current;
        if (gap > 10000) {
          restartWatcher();
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [saveSession, requestWakeLock, restartWatcher]);

  // 최신 state를 ref로 추적 (unmount cleanup에서 접근용)
  const pointsRef = useRef(points);
  const distanceRef = useRef(distance);
  const elapsedRef = useRef(elapsed);
  const statusRefForSave = useRef(status);
  useEffect(() => { pointsRef.current = points; }, [points]);
  useEffect(() => { distanceRef.current = distance; }, [distance]);
  useEffect(() => { elapsedRef.current = elapsed; }, [elapsed]);
  useEffect(() => { statusRefForSave.current = status; }, [status]);

  // --- Cleanup on unmount ---
  useEffect(() => {
    return () => {
      // 러닝 중이면 세션 저장
      if (pointsRef.current.length > 0 && ["running", "paused"].includes(statusRefForSave.current)) {
        const data = {
          points: pointsRef.current,
          distance: distanceRef.current,
          elapsed: elapsedRef.current,
          status: "paused" as const,
          startTime: startTimeRef.current,
          savedAt: Date.now(),
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(data));
      }
      stopAllWatchers();
      stopHealthCheck();
      if (timerRef.current) {
        clearInterval(timerRef.current);
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
      await clearBackup();
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
    statusRef.current = "idle";
    setSaved(false);
    setError(null);
    pausedTimeRef.current = 0;
    clearSession();
    clearBackup().catch(() => {});
  };

  const pace = elapsed > 0 && distance > 0 ? distance / elapsed : 0;
  const currentPos = points.length > 0 ? points[points.length - 1] : null;

  // --- Recovery handlers ---
  const acceptRecovery = useCallback(() => {
    if (!recoveryPrompt) return;
    setPoints(recoveryPrompt.points);
    setDistance(recoveryPrompt.distance);
    setElapsed(recoveryPrompt.elapsed);
    pausedTimeRef.current = recoveryPrompt.elapsed;
    startTimeRef.current = recoveryPrompt.startTime;
    // Set to paused first so startTracking computes correct elapsed offset
    setStatus("paused");
    statusRef.current = "paused";
    setRecoveryPrompt(null);
    // Auto-resume so the user doesn't need a second tap
    startTracking();
  }, [recoveryPrompt, startTracking]);

  const dismissRecovery = useCallback(async () => {
    setRecoveryPrompt(null);
    clearSession();
    await clearBackup();
  }, [clearSession]);

  return (
    <div className="max-w-[430px] w-full mx-auto h-screen bg-[#1a2a3a] flex flex-col overflow-hidden relative">
      {/* 세션 복구 다이얼로그 */}
      {recoveryPrompt && (
        <div className="absolute inset-0 z-[3000] flex items-center justify-center bg-black/80 px-6">
          <div className="w-full max-w-sm bg-[#1a2a3a] border border-gray-700 rounded-2xl p-5 text-white">
            <div className="text-center mb-4">
              <div className="text-3xl mb-2">💾</div>
              <div className="text-base font-bold">이전 러닝 기록이 남아있어요</div>
              <div className="text-xs text-gray-400 mt-1">
                저장되지 않은 세션을 복구할 수 있습니다
              </div>
            </div>
            <div className="bg-black/30 rounded-lg p-3 mb-4 space-y-1 text-center">
              <div className="text-2xl font-black text-[#FF5722]">
                {fmtKm(recoveryPrompt.distance)} km
              </div>
              <div className="text-xs text-gray-400">
                {formatTime(recoveryPrompt.elapsed)} · {recoveryPrompt.points.length} 포인트
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={dismissRecovery}
                className="flex-1 bg-gray-700 text-gray-300 rounded-xl py-3 text-xs font-bold active:scale-95 transition-transform"
              >
                폐기
              </button>
              <button
                onClick={acceptRecovery}
                className="flex-1 bg-[#FF5722] text-white rounded-xl py-3 text-xs font-bold active:scale-95 transition-transform"
              >
                이어달리기
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* 카운트다운 오버레이 */}
      {countdown !== null && (
        <div className="absolute inset-0 z-[3000] bg-black flex items-center justify-center">
          <div
            className={`font-black ${typeof countdown === "string" ? "text-6xl text-[#FF5722]" : "text-9xl text-white"}`}
            style={{ animation: "kmPop 0.3s ease-out" }}
          >
            {countdown}
          </div>
        </div>
      )}

      {/* GPS 미준비 다이얼로그 */}
      {gpsNotReady && (
        <div className="absolute inset-0 z-[3000] bg-black/70 flex items-center justify-center px-6">
          <div className="bg-[#1a2a3a] rounded-2xl p-6 w-full max-w-sm text-center space-y-4">
            <div className="text-4xl">📡</div>
            <p className="text-white text-sm font-bold">앗! 아직 GPS가 잡히지 않았습니다</p>
            <p className="text-gray-400 text-xs">일단 달리실래요?<br/>자동으로 잡히면 이어서 기록됩니다.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setGpsNotReady(false)}
                className="flex-1 bg-gray-600 text-white rounded-xl py-3 text-sm font-bold"
              >
                기다릴게요
              </button>
              <button
                onClick={() => { stopWarmup(); startWithCountdown(); }}
                className="flex-1 bg-green-500 text-white rounded-xl py-3 text-sm font-bold"
              >
                일단 시작
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-2 bg-[#1a2a3a] flex-shrink-0" style={{ paddingTop: "calc(env(safe-area-inset-top) + 8px)" }}>
        {[
          { label: "📍 GPS", active: true },
          { label: "✏️ 수동", href: "/input" },
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
                  ? "bg-gray-800 text-gray-600"
                  : "bg-gray-700 text-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 권한 경고 배너 */}
      {permissionStatus && permissionStatus.level !== "always" && permissionStatus.platform !== "web" && (
        <div className={`mx-2 mb-1 rounded-lg px-3 py-2 text-[11px] font-bold flex items-center gap-2 ${
          permissionStatus.level === "denied" ? "bg-red-600 text-white" : "bg-yellow-600/90 text-white"
        }`}>
          <span>⚠️</span>
          <span className="flex-1">{permissionStatus.message}</span>
        </div>
      )}

      {/* Map - fills remaining space */}
      <div className="flex-1 relative">
        <MapView
          points={points}
          currentPos={currentPos}
          cells={showTerritoryCells ? territoryCells : []}
          showCells={showTerritoryCells}
          myCrewId={getStoredUser()?.crew ?? null}
        />

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
            router.push("/home");
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

        {/* Territory cells toggle button */}
        <button
          onClick={() => setShowTerritoryCells(v => !v)}
          className={`absolute bottom-3 right-3 z-[1000] w-10 h-10 rounded-xl shadow-lg flex items-center justify-center text-lg active:scale-95 transition-transform ${
            showTerritoryCells ? "bg-[#FF5722] text-white" : "bg-black/50 text-white"
          }`}
        >
          🗺️
        </button>

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

        {/* GPS 워밍업 상태 표시 */}
        {status === "idle" && !saved && (
          <div className={`text-xs text-center mb-2 ${gpsWarmupReady ? "text-green-400" : "text-yellow-400 animate-pulse"}`}>
            {gpsWarmupReady
              ? `GPS 준비 완료${gpsAccuracy !== null ? ` (정확도 ${Math.round(gpsAccuracy)}m)` : ""}`
              : "GPS 신호 잡는 중..."}
          </div>
        )}

        {/* Controls */}
        {status === "idle" && !saved && (
          <button
            onClick={handleStart}
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
            <button
              onClick={() => setShowShare(true)}
              className="w-full bg-white/10 border border-white/20 text-white rounded-xl py-3 text-sm font-bold active:scale-95 transition-transform mb-2 mt-3"
            >
              📸 러닝 공유 이미지 만들기
            </button>
            <div className="flex gap-2">
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

      {showShare && (
        <RunShareCard
          distance={distance}
          elapsed={elapsed}
          pace={formatPace(pace)}
          points={points.map(p => ({ lat: p.lat, lng: p.lng }))}
          startTime={startTimeRef.current}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}
