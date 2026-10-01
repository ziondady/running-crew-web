"use client";
import { useEffect, useState } from "react";

interface LatestApk {
  version: string;
  file: string;
}

// Android 설치 파일(APK) 내려받기. 안드로이드 전용이라 로봇 아이콘을 함께 보여준다.
// 서버의 /downloads/latest.json 이 현재 배포 버전을 알려주므로 새 버전을 올려도
// 화면을 다시 배포할 필요가 없다. 파일이 없으면 버튼을 숨긴다.
export default function ApkDownloadButton() {
  const [apk, setApk] = useState<LatestApk | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/downloads/latest.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.version && data?.file) setApk({ version: data.version, file: data.file });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!apk) return null;

  return (
    <a
      href={`/downloads/${encodeURIComponent(apk.file)}`}
      download
      aria-label={`안드로이드 앱 v${apk.version} 다운로드`}
      title="안드로이드 전용 설치 파일"
      className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold text-white active:scale-95 transition-transform"
      style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.25)" }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 18c0 .55.45 1 1 1h1v3.5a1.5 1.5 0 0 0 3 0V19h2v3.5a1.5 1.5 0 0 0 3 0V19h1c.55 0 1-.45 1-1V8H6v10z" fill="#3DDC84" />
        <path d="M3.5 8A1.5 1.5 0 0 0 2 9.5v7a1.5 1.5 0 0 0 3 0v-7A1.5 1.5 0 0 0 3.5 8zm17 0A1.5 1.5 0 0 0 19 9.5v7a1.5 1.5 0 0 0 3 0v-7A1.5 1.5 0 0 0 20.5 8z" fill="#3DDC84" />
        <path d="M15.53 2.16l1.3-1.3a.5.5 0 0 0-.7-.7l-1.48 1.47A5.96 5.96 0 0 0 12 1c-.96 0-1.86.23-2.66.63L7.85.16a.5.5 0 0 0-.7.7l1.3 1.3A5.98 5.98 0 0 0 6 7h12a5.98 5.98 0 0 0-2.47-4.84z" fill="#3DDC84" />
        <circle cx="9.5" cy="4.5" r=".9" fill="#1A1A2E" />
        <circle cx="14.5" cy="4.5" r=".9" fill="#1A1A2E" />
      </svg>
      <span>v{apk.version}</span>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3v12m0 0l-5-5m5 5l5-5M5 21h14" />
      </svg>
    </a>
  );
}
