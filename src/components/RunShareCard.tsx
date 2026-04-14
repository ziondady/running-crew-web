"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";

interface RunShareCardProps {
  distance: number;
  elapsed: number;
  pace: string;
  points: { lat: number; lng: number }[];
  startTime: number;
  onClose: () => void;
}

export default function RunShareCard({ distance, elapsed, pace, points, startTime, onClose }: RunShareCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  };

  const fmtKm = (km: number) => {
    if (km >= 100) return Math.round(km).toString();
    return km.toFixed(2);
  };

  const drawCard = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || points.length < 2) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 1080;
    const H = 1920;
    canvas.width = W;
    canvas.height = H;

    const draw = (bgImg?: HTMLImageElement) => {
      // Background
      if (bgImg) {
        // Cover fit
        const scale = Math.max(W / bgImg.width, H / bgImg.height);
        const sw = W / scale;
        const sh = H / scale;
        const sx = (bgImg.width - sw) / 2;
        const sy = (bgImg.height - sh) / 2;
        ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, W, H);
        // Dark overlay
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.fillRect(0, 0, W, H);
      } else {
        // Default gradient background
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, "#0D1B2A");
        grad.addColorStop(1, "#1A1A2E");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      }

      // Draw route
      const lats = points.map(p => p.lat);
      const lngs = points.map(p => p.lng);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);

      const padding = 120;
      const routeArea = { x: padding, y: 300, w: W - padding * 2, h: H - 900 };

      const latRange = maxLat - minLat || 0.001;
      const lngRange = maxLng - minLng || 0.001;
      const scale = Math.min(routeArea.w / lngRange, routeArea.h / latRange) * 0.85;

      const centerX = routeArea.x + routeArea.w / 2;
      const centerY = routeArea.y + routeArea.h / 2;
      const centerLat = (minLat + maxLat) / 2;
      const centerLng = (minLng + maxLng) / 2;

      // Route glow
      ctx.beginPath();
      for (let i = 0; i < points.length; i++) {
        const x = centerX + (points[i].lng - centerLng) * scale;
        const y = centerY - (points[i].lat - centerLat) * scale;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 12;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();

      // Route main line
      ctx.beginPath();
      for (let i = 0; i < points.length; i++) {
        const x = centerX + (points[i].lng - centerLng) * scale;
        const y = centerY - (points[i].lat - centerLat) * scale;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();

      // Start point
      const sx2 = centerX + (points[0].lng - centerLng) * scale;
      const sy2 = centerY - (points[0].lat - centerLat) * scale;
      ctx.beginPath();
      ctx.arc(sx2, sy2, 10, 0, Math.PI * 2);
      ctx.fillStyle = "#4CAF50";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 3;
      ctx.stroke();

      // End point
      const ex = centerX + (points[points.length-1].lng - centerLng) * scale;
      const ey = centerY - (points[points.length-1].lat - centerLat) * scale;
      ctx.beginPath();
      ctx.arc(ex, ey, 10, 0, Math.PI * 2);
      ctx.fillStyle = "#FF5722";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 3;
      ctx.stroke();

      // Top: App name + date
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = "bold 32px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("⚔️ 배틀크루", W / 2, 100);

      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "24px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText(formatDate(startTime), W / 2, 150);

      // Bottom: Stats
      const statsY = H - 400;

      // Distance (big)
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 120px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(fmtKm(distance), W / 2, statsY);

      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "36px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText("km", W / 2, statsY + 50);

      // Pace and Time
      const col1X = W / 3;
      const col2X = (W / 3) * 2;
      const row2Y = statsY + 140;

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 48px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText(pace, col1X, row2Y);
      ctx.fillText(formatTime(elapsed), col2X, row2Y);

      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "24px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText("페이스", col1X, row2Y + 40);
      ctx.fillText("시간", col2X, row2Y + 40);

      // Bottom watermark
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.font = "20px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText("run4u.fit", W / 2, H - 60);
    };

    if (bgImage) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => draw(img);
      img.src = bgImage;
    } else {
      draw();
    }
  }, [points, distance, elapsed, pace, startTime, bgImage]);

  // Draw on mount and whenever bgImage changes
  useEffect(() => {
    const timer = setTimeout(drawCard, 100);
    return () => clearTimeout(timer);
  }, [drawCard]);

  const handleBgSelect = async () => {
    try {
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos,
        quality: 90,
      });
      if (photo.dataUrl) {
        setBgImage(photo.dataUrl);
      }
    } catch {
      // User cancelled
    }
  };

  const handleSave = async () => {
    drawCard();
    await new Promise(r => setTimeout(r, 100));
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    try {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
      if (!blob) return;

      // Try native share first, then download
      if (navigator.share) {
        const file = new File([blob], "battlecrew-run.png", { type: "image/png" });
        await navigator.share({ files: [file] });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "battlecrew-run.png";
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      // User cancelled share
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[5000] bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ paddingTop: "max(env(safe-area-inset-top, 0px) + 12px, 48px)" }}>
        <button onClick={onClose} className="text-white text-sm">✕ 닫기</button>
        <span className="text-white text-sm font-bold">러닝 공유</span>
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-[#FF5722] text-sm font-bold disabled:opacity-50"
        >
          {saving ? "저장 중..." : "공유/저장"}
        </button>
      </div>

      {/* Canvas preview */}
      <div className="flex-1 flex items-center justify-center px-4 overflow-hidden">
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full rounded-xl"
          style={{ maxHeight: "65vh" }}
        />
      </div>

      {/* Controls */}
      <div className="flex gap-2 px-4 py-4 flex-shrink-0" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}>
        <button
          onClick={() => { setBgImage(null); }}
          className={`flex-1 py-3 rounded-xl text-sm font-bold ${!bgImage ? "bg-white text-black" : "bg-gray-800 text-gray-300"}`}
        >
          기본 배경
        </button>
        <button
          onClick={handleBgSelect}
          className={`flex-1 py-3 rounded-xl text-sm font-bold ${bgImage ? "bg-white text-black" : "bg-gray-800 text-gray-300"}`}
        >
          📷 사진 선택
        </button>
      </div>
    </div>
  );
}
