"use client";
import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";

const APP_VERSION = "1.0.0";

function compareVersions(current: string, minimum: string): boolean {
  const c = current.split('.').map(Number);
  const m = minimum.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((c[i] || 0) < (m[i] || 0)) return true;
    if ((c[i] || 0) > (m[i] || 0)) return false;
  }
  return false;
}

export default function VersionCheck() {
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/accounts/app-version/`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data.min_version && compareVersions(APP_VERSION, data.min_version)) {
          setNeedsUpdate(true);
          setDownloadUrl(data.download_url || "");
          setMessage(data.update_message || "새로운 버전이 출시되었습니다.");
        }
      })
      .catch(() => {});
  }, []);

  if (!needsUpdate) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-[#0D1B2A] flex flex-col items-center justify-center px-6">
      <div className="text-5xl mb-6">⚔️</div>
      <h1 className="text-white text-xl font-extrabold mb-2">업데이트가 필요합니다</h1>
      <p className="text-gray-400 text-sm text-center mb-8 leading-relaxed">{message}</p>
      {downloadUrl && (
        <a
          href={downloadUrl}
          className="w-full max-w-xs bg-[var(--primary)] text-white rounded-xl py-4 text-center text-sm font-bold active:scale-95 transition-transform block"
        >
          최신 버전 다운로드
        </a>
      )}
      <p className="text-gray-600 text-xs mt-4">현재 버전: v{APP_VERSION}</p>
    </div>
  );
}
