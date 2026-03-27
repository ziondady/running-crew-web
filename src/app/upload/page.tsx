"use client";
import { API_BASE } from "@/lib/api";import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import TopBar from "@/components/TopBar";
import { getStoredUser } from "@/lib/auth";
import { fmtKm } from "@/lib/format";


interface UploadResult {
  filename: string;
  source: string;
  total_distance_km: number;
  point_count: number;
  activity_date: string | null;
  total_points: number;
  gps_points?: { lat: number; lng: number }[];
  saved_log?: {
    id: number;
    date: string;
    distance: number;
    source: string;
  };
}

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [autoSave, setAutoSave] = useState(true);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.toLowerCase();
    if (!ext.endsWith('.fit') && !ext.endsWith('.gpx')) {
      setError("FIT 또는 GPX 파일만 업로드 가능합니다");
      return;
    }
    setSelectedFile(file);
    setError(null);
    setResult(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    const me = getStoredUser();
    if (!me) { router.push("/"); return; }

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", selectedFile);
    if (autoSave) {
      formData.append("user_id", String(me.id));
    }

    try {
      const res = await fetch(`${API_BASE}/running/upload/`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "업로드 실패");
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <AppShell>
      <TopBar title="📁 파일 업로드" back settingsButton />
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="rounded-xl p-4 text-white shadow" style={{ background: "linear-gradient(135deg, #FF5722, #FF8A65)" }}>
          <div className="font-bold text-base">Garmin / GPS 파일 업로드</div>
          <div className="text-xs opacity-80 mt-1">FIT 또는 GPX 파일을 업로드하면 GPS 경로와 거리가 자동 추출됩니다</div>
        </div>

        {/* Result display */}
        {result ? (
          <div className="space-y-3" style={{ animation: 'cardSlideIn 0.5s ease-out' }}>
            {/* Success card */}
            <div className="bg-white rounded-xl p-5 shadow-sm text-center">
              <div className="text-4xl mb-2" style={{ animation: 'confettiFall 2s ease-in-out infinite' }}>🎉</div>
              <div className="text-lg font-extrabold text-green-600" style={{ animation: 'kmPop 0.6s ease-out' }}>
                업로드 성공!
              </div>
              <div className="text-xs text-gray-400 mt-1">{result.filename}</div>
            </div>

            {/* Stats */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-xl font-extrabold text-[var(--primary)]">{fmtKm(result.total_distance_km)}</div>
                  <div className="text-[10px] text-gray-400">총 거리 (km)</div>
                </div>
                <div>
                  <div className="text-xl font-extrabold text-blue-600">{result.total_points.toLocaleString()}</div>
                  <div className="text-[10px] text-gray-400">GPS 포인트</div>
                </div>
                <div>
                  <div className="text-xl font-extrabold text-green-600">{result.source === 'garmin' ? 'Garmin' : 'GPX'}</div>
                  <div className="text-[10px] text-gray-400">소스</div>
                </div>
              </div>
              {result.activity_date && (
                <div className="text-center mt-3 text-xs text-gray-500">
                  활동 날짜: <strong>{result.activity_date}</strong>
                </div>
              )}
            </div>

            {/* Save status */}
            {result.saved_log ? (
              <div className="bg-green-50 rounded-xl p-4 border border-green-200 text-center">
                <div className="text-sm font-bold text-green-700">✅ 러닝 기록 자동 저장 완료</div>
                <div className="text-xs text-green-600 mt-1">
                  {result.saved_log.date} · {fmtKm(result.saved_log.distance)}km · 점령전에 반영됩니다
                </div>
              </div>
            ) : (
              <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200 text-center">
                <div className="text-sm font-bold text-yellow-700">📋 파싱만 완료 (저장 안 됨)</div>
                <div className="text-xs text-yellow-600 mt-1">자동 저장을 켜고 다시 업로드하세요</div>
              </div>
            )}

            {/* GPS preview */}
            {result.total_points > 0 && (
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="text-xs font-bold text-gray-600 mb-2">📍 GPS 경로 미리보기</div>
                <div className="bg-gray-100 rounded-lg h-40 relative overflow-hidden">
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <GPSPreview points={result.gps_points || []} />
                  </svg>
                </div>
                <div className="text-[10px] text-gray-400 text-center mt-1">{result.total_points.toLocaleString()}개 GPS 포인트</div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={handleReset}
                className="flex-1 bg-gray-100 text-gray-600 rounded-xl py-3 text-sm font-bold active:scale-95 transition-transform"
              >
                다른 파일 업로드
              </button>
              <button
                onClick={() => router.push("/home")}
                className="flex-1 bg-[var(--primary)] text-white rounded-xl py-3 text-sm font-bold active:scale-95 transition-transform"
              >
                홈으로
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* File selector */}
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <input
                ref={fileInputRef}
                type="file"
                accept=".fit,.gpx"
                onChange={handleFileSelect}
                className="hidden"
              />

              {!selectedFile ? (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-[var(--primary)] transition-colors"
                >
                  <div className="text-4xl mb-3">📁</div>
                  <div className="text-sm font-bold text-gray-600">FIT 또는 GPX 파일 선택</div>
                  <div className="text-[10px] text-gray-400 mt-1">Garmin Connect에서 내보낸 파일을 선택하세요</div>
                </button>
              ) : (
                <div className="text-center">
                  <div className="text-3xl mb-2">{selectedFile.name.endsWith('.fit') ? '⌚' : '📍'}</div>
                  <div className="text-sm font-bold">{selectedFile.name}</div>
                  <div className="text-xs text-gray-400 mt-1">{(selectedFile.size / 1024).toFixed(1)} KB</div>
                  <button
                    onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                    className="text-xs text-red-400 mt-2 underline"
                  >
                    파일 변경
                  </button>
                </div>
              )}
            </div>

            {/* Auto-save toggle */}
            <div className="bg-white rounded-xl p-4 shadow-sm flex items-center gap-3">
              <div className="flex-1">
                <div className="text-sm font-semibold">자동 저장</div>
                <div className="text-[10px] text-gray-400">업로드 시 러닝 기록 + 점령전에 자동 반영</div>
              </div>
              <button
                onClick={() => setAutoSave(!autoSave)}
                className={`w-11 h-6 rounded-full transition-all relative ${autoSave ? "bg-green-500" : "bg-gray-200"}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${autoSave ? "left-5" : "left-0.5"}`} />
              </button>
            </div>

            {/* How to export guide */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="text-xs font-bold text-gray-600 mb-2">📖 Garmin에서 파일 내보내기</div>
              <div className="space-y-2 text-[10px] text-gray-500">
                <div className="flex gap-2">
                  <span className="font-bold text-[var(--primary)] w-4">1</span>
                  <span>Garmin Connect 앱 또는 웹 접속</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-bold text-[var(--primary)] w-4">2</span>
                  <span>활동 상세 → ⚙️ 설정 → '원본 내보내기'</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-bold text-[var(--primary)] w-4">3</span>
                  <span>.FIT 파일 다운로드</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-bold text-[var(--primary)] w-4">4</span>
                  <span>위에서 파일 선택 → 업로드</span>
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 rounded-xl p-3 text-sm text-red-500 text-center">
                {error}
              </div>
            )}

            {/* Upload button */}
            <button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              className={`w-full rounded-xl py-3 text-sm font-bold text-white active:scale-95 transition-all ${
                !selectedFile ? "bg-gray-300" : uploading ? "bg-gray-400" : "bg-[var(--primary)]"
              }`}
            >
              {uploading ? "업로드 중..." : "📤 업로드 및 분석"}
            </button>
          </>
        )}
      </div>
    </AppShell>
  );
}

// GPS path preview component
function GPSPreview({ points }: { points: { lat: number; lng: number }[] }) {
  if (points.length < 2) return null;

  const lats = points.map(p => p.lat);
  const lngs = points.map(p => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const padLat = (maxLat - minLat) * 0.1 || 0.001;
  const padLng = (maxLng - minLng) * 0.1 || 0.001;

  const toX = (lng: number) => ((lng - minLng + padLng) / (maxLng - minLng + padLng * 2)) * 100;
  const toY = (lat: number) => 100 - ((lat - minLat + padLat) / (maxLat - minLat + padLat * 2)) * 100;

  // Sample points to max 200 for performance
  const step = Math.max(1, Math.floor(points.length / 200));
  const sampled = points.filter((_, i) => i % step === 0);

  const pathD = sampled.map((p, i) =>
    `${i === 0 ? 'M' : 'L'} ${toX(p.lng).toFixed(1)} ${toY(p.lat).toFixed(1)}`
  ).join(' ');

  return (
    <>
      <path d={pathD} fill="none" stroke="#FF5722" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
      {/* Start point */}
      <circle cx={toX(sampled[0].lng)} cy={toY(sampled[0].lat)} r="2" fill="#4CAF50" />
      {/* End point */}
      <circle cx={toX(sampled[sampled.length - 1].lng)} cy={toY(sampled[sampled.length - 1].lat)} r="2" fill="#FF5722" />
    </>
  );
}
