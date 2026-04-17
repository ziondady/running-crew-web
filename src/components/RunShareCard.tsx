"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { Capacitor } from "@capacitor/core";

interface RunShareCardProps {
  distance: number;
  elapsed: number;
  pace: string;
  points: { lat: number; lng: number }[];
  startTime: number;
  onClose: () => void;
}

type Template = "classic" | "stack" | "bottombar" | "minimal";
type Step = "template" | "background";

const TEMPLATE_NAMES: Record<Template, string> = {
  classic: "클래식",
  stack: "스택",
  bottombar: "바텀바",
  minimal: "미니멀",
};

const TEMPLATES: Template[] = ["classic", "stack", "bottombar", "minimal"];

export default function RunShareCard({ distance, elapsed, pace, points, startTime, onClose }: RunShareCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<Step>("template");
  const [template, setTemplate] = useState<Template>("classic");

  const previewRefs = useRef<(HTMLCanvasElement | null)[]>([null, null, null, null]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const fmtKm = (km: number) => {
    if (km >= 100) return Math.round(km).toString();
    return km.toFixed(2);
  };

  const drawCardOnCanvas = useCallback(
    (canvas: HTMLCanvasElement, tmpl: Template, bgImg?: HTMLImageElement) => {
      if (points.length < 2) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const W = 1080;
      const H = 1920;
      canvas.width = W;
      canvas.height = H;

      // Background
      if (bgImg) {
        const scale = Math.max(W / bgImg.width, H / bgImg.height);
        const sw = W / scale;
        const sh = H / scale;
        const sx = (bgImg.width - sw) / 2;
        const sy = (bgImg.height - sh) / 2;
        ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, W, H);
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.fillRect(0, 0, W, H);
      } else {
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, "#0D1B2A");
        grad.addColorStop(1, "#1A1A2E");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      }

      const lats = points.map((p) => p.lat);
      const lngs = points.map((p) => p.lng);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      const latRange = maxLat - minLat || 0.001;
      const lngRange = maxLng - minLng || 0.001;
      const centerLat = (minLat + maxLat) / 2;
      const centerLng = (minLng + maxLng) / 2;

      const FONT = "-apple-system, BlinkMacSystemFont, sans-serif";

      const drawRoute = (area: { x: number; y: number; w: number; h: number }) => {
        const routeScale = Math.min(area.w / lngRange, area.h / latRange) * 0.85;
        const cx = area.x + area.w / 2;
        const cy = area.y + area.h / 2;

        // Glow
        ctx.beginPath();
        for (let i = 0; i < points.length; i++) {
          const x = cx + (points[i].lng - centerLng) * routeScale;
          const y = cy - (points[i].lat - centerLat) * routeScale;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = "rgba(255,255,255,0.15)";
        ctx.lineWidth = 12;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();

        // Main line
        ctx.beginPath();
        for (let i = 0; i < points.length; i++) {
          const x = cx + (points[i].lng - centerLng) * routeScale;
          const y = cy - (points[i].lat - centerLat) * routeScale;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();

        // Start dot
        const sx2 = cx + (points[0].lng - centerLng) * routeScale;
        const sy2 = cy - (points[0].lat - centerLat) * routeScale;
        ctx.beginPath();
        ctx.arc(sx2, sy2, 10, 0, Math.PI * 2);
        ctx.fillStyle = "#4CAF50";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 3;
        ctx.stroke();

        // End dot
        const ex = cx + (points[points.length - 1].lng - centerLng) * routeScale;
        const ey = cy - (points[points.length - 1].lat - centerLat) * routeScale;
        ctx.beginPath();
        ctx.arc(ex, ey, 10, 0, Math.PI * 2);
        ctx.fillStyle = "#FF5722";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 3;
        ctx.stroke();
      };

      if (tmpl === "classic") {
        // App name + date top center
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.font = `bold 32px ${FONT}`;
        ctx.textAlign = "center";
        ctx.fillText("⚔️ 배틀크루", W / 2, 100);

        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.font = `24px ${FONT}`;
        ctx.fillText(formatDate(startTime), W / 2, 150);

        // Route: middle area
        const padding = 120;
        drawRoute({ x: padding, y: 300, w: W - padding * 2, h: H - 900 });

        // Distance big center below route
        const statsY = H - 400;
        ctx.fillStyle = "#FFFFFF";
        ctx.font = `bold 120px ${FONT}`;
        ctx.textAlign = "center";
        ctx.fillText(fmtKm(distance), W / 2, statsY);

        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = `36px ${FONT}`;
        ctx.fillText("km", W / 2, statsY + 50);

        const col1X = W / 3;
        const col2X = (W / 3) * 2;
        const row2Y = statsY + 140;
        ctx.fillStyle = "#FFFFFF";
        ctx.font = `bold 48px ${FONT}`;
        ctx.fillText(pace, col1X, row2Y);
        ctx.fillText(formatTime(elapsed), col2X, row2Y);

        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.font = `24px ${FONT}`;
        ctx.fillText("페이스", col1X, row2Y + 40);
        ctx.fillText("시간", col2X, row2Y + 40);

        // Watermark
        ctx.fillStyle = "rgba(255,255,255,0.2)";
        ctx.font = `20px ${FONT}`;
        ctx.fillText("run4u.fit", W / 2, H - 60);
      } else if (tmpl === "stack") {
        // Route takes right 60% of canvas
        const routeX = W * 0.4;
        drawRoute({ x: routeX, y: 100, w: W * 0.55, h: H - 200 });

        // Left side stats stacked
        const leftX = 80;
        let curY = 200;

        // Date top-left
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = `24px ${FONT}`;
        ctx.textAlign = "left";
        ctx.fillText(formatDate(startTime), leftX, curY);
        curY += 120;

        // Distance big
        ctx.fillStyle = "#FFFFFF";
        ctx.font = `bold 110px ${FONT}`;
        ctx.textAlign = "left";
        ctx.fillText(fmtKm(distance), leftX, curY);
        curY += 50;

        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = `30px ${FONT}`;
        ctx.fillText("km", leftX, curY);
        curY += 100;

        // Pace
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = `22px ${FONT}`;
        ctx.fillText("페이스", leftX, curY);
        curY += 40;
        ctx.fillStyle = "#FFFFFF";
        ctx.font = `bold 48px ${FONT}`;
        ctx.fillText(pace, leftX, curY);
        curY += 80;

        // Time
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = `22px ${FONT}`;
        ctx.fillText("시간", leftX, curY);
        curY += 40;
        ctx.fillStyle = "#FFFFFF";
        ctx.font = `bold 48px ${FONT}`;
        ctx.fillText(formatTime(elapsed), leftX, curY);

        // App name watermark bottom center
        ctx.fillStyle = "rgba(255,255,255,0.2)";
        ctx.font = `20px ${FONT}`;
        ctx.textAlign = "center";
        ctx.fillText("⚔️ 배틀크루 · run4u.fit", W / 2, H - 60);
      } else if (tmpl === "bottombar") {
        // Date + app name small at top-left
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = `24px ${FONT}`;
        ctx.textAlign = "left";
        ctx.fillText(formatDate(startTime), 60, 90);

        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.font = `20px ${FONT}`;
        ctx.fillText("⚔️ 배틀크루", 60, 130);

        // Route fills most of canvas
        const barH = 220;
        drawRoute({ x: 60, y: 160, w: W - 120, h: H - 160 - barH - 40 });

        // Horizontal bar at the bottom
        const barY = H - barH;
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(0, barY, W, barH);

        const thirdW = W / 3;

        // Distance
        ctx.fillStyle = "#FFFFFF";
        ctx.font = `bold 72px ${FONT}`;
        ctx.textAlign = "center";
        ctx.fillText(fmtKm(distance), thirdW * 0.5, barY + 100);
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = `26px ${FONT}`;
        ctx.fillText("거리 (km)", thirdW * 0.5, barY + 145);

        // Divider
        ctx.fillStyle = "rgba(255,255,255,0.2)";
        ctx.fillRect(thirdW - 1, barY + 30, 2, barH - 60);

        // Pace
        ctx.fillStyle = "#FFFFFF";
        ctx.font = `bold 72px ${FONT}`;
        ctx.textAlign = "center";
        ctx.fillText(pace, thirdW * 1.5, barY + 100);
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = `26px ${FONT}`;
        ctx.fillText("페이스", thirdW * 1.5, barY + 145);

        // Divider
        ctx.fillStyle = "rgba(255,255,255,0.2)";
        ctx.fillRect(thirdW * 2 - 1, barY + 30, 2, barH - 60);

        // Time
        ctx.fillStyle = "#FFFFFF";
        ctx.font = `bold 72px ${FONT}`;
        ctx.textAlign = "center";
        ctx.fillText(formatTime(elapsed), thirdW * 2.5, barY + 100);
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = `26px ${FONT}`;
        ctx.fillText("시간", thirdW * 2.5, barY + 145);
      } else if (tmpl === "minimal") {
        // Date top-left small
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.font = `22px ${FONT}`;
        ctx.textAlign = "left";
        ctx.fillText(formatDate(startTime), 60, 80);

        // Route fills entire canvas area
        drawRoute({ x: 0, y: 0, w: W, h: H });

        // Pace and time very small above distance
        const smallY = H - 290;
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.font = `28px ${FONT}`;
        ctx.textAlign = "right";
        ctx.fillText(`${pace}  /km    ${formatTime(elapsed)}`, W - 60, smallY);

        // Distance very large bottom-right
        ctx.fillStyle = "#FFFFFF";
        ctx.font = `bold 160px ${FONT}`;
        ctx.textAlign = "right";
        ctx.fillText(fmtKm(distance), W - 50, H - 120);

        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = `36px ${FONT}`;
        ctx.fillText("km", W - 55, H - 75);

        // Watermark bottom-left
        ctx.fillStyle = "rgba(255,255,255,0.15)";
        ctx.font = `20px ${FONT}`;
        ctx.textAlign = "left";
        ctx.fillText("run4u.fit", 60, H - 60);
      }
    },
    [points, distance, elapsed, pace, startTime, fmtKm, formatDate, formatTime]
  );

  const drawCard = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (bgImage) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => drawCardOnCanvas(canvas, template, img);
      img.src = bgImage;
    } else {
      drawCardOnCanvas(canvas, template);
    }
  }, [drawCardOnCanvas, template, bgImage]);

  // Draw main canvas when on background step or when template/bg changes
  useEffect(() => {
    if (step !== "background") return;
    const timer = setTimeout(drawCard, 100);
    return () => clearTimeout(timer);
  }, [drawCard, step]);

  // Draw preview canvases when on template step
  useEffect(() => {
    if (step !== "template") return;
    const timer = setTimeout(() => {
      TEMPLATES.forEach((tmpl, idx) => {
        const canvas = previewRefs.current[idx];
        if (canvas) {
          drawCardOnCanvas(canvas, tmpl);
        }
      });
    }, 100);
    return () => clearTimeout(timer);
  }, [step, drawCardOnCanvas]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Change 2: Photo picker — use Capacitor Camera when native
  const handleBgSelect = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
        const photo = await Camera.pickImages({
          quality: 90,
          limit: 1,
        });
        if (photo.photos && photo.photos.length > 0) {
          const first = photo.photos[0];
          // Convert path to data URL by reading via fetch
          const response = await fetch(first.webPath);
          const blob = await response.blob();
          const reader = new FileReader();
          reader.onload = (ev) => setBgImage(ev.target?.result as string);
          reader.readAsDataURL(blob);
        }
      } catch (e) {
        console.error("Image pick failed:", e);
      }
    } else {
      // Web fallback — existing file input
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setBgImage(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Change 3: Share/Save — use Capacitor plugins when native
  const handleSave = async () => {
    drawCard();
    await new Promise((r) => setTimeout(r, 100));
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);

    try {
      const dataUrl = canvas.toDataURL("image/png");

      if (Capacitor.isNativePlatform()) {
        // Native: save to filesystem then share
        const { Filesystem, Directory } = await import("@capacitor/filesystem");
        const { Share } = await import("@capacitor/share");

        const base64Data = dataUrl.split(",")[1];
        const filename = `battlecrew-run-${Date.now()}.png`;

        const savedFile = await Filesystem.writeFile({
          path: filename,
          data: base64Data,
          directory: Directory.Cache,
        });

        await Share.share({
          title: "배틀크루 러닝",
          text: "오늘의 러닝 기록!",
          url: savedFile.uri,
          dialogTitle: "러닝 기록 공유",
        });
      } else {
        // Web fallback: download or Web Share API
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
        if (!blob) return;

        if (navigator.share && navigator.canShare?.({ files: [new File([blob], "battlecrew-run.png", { type: "image/png" })] })) {
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
      }
    } catch (e) {
      // Share cancelled or failed — silently ignore
      console.log("Share failed or cancelled:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleSelectTemplate = (tmpl: Template) => {
    setTemplate(tmpl);
    setStep("background");
  };

  if (step === "template") {
    return (
      <div className="fixed inset-0 z-[5000] bg-black flex flex-col">
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ paddingTop: "max(env(safe-area-inset-top, 0px) + 12px, 48px)" }}
        >
          <button onClick={onClose} className="text-white text-sm">
            ✕ 닫기
          </button>
          <span className="text-white text-sm font-bold">템플릿 선택</span>
          <span className="w-12" />
        </div>

        {/* 2x2 grid of template previews */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            {TEMPLATES.map((tmpl, idx) => (
              <button
                key={tmpl}
                type="button"
                onClick={() => handleSelectTemplate(tmpl)}
                className="flex flex-col items-center gap-2"
                style={{ touchAction: "manipulation" }}
              >
                <div className="w-full rounded-xl overflow-hidden border-2 border-transparent hover:border-orange-500 active:border-orange-500">
                  {/* Change 1: pointer-events: none so touch passes through canvas to button */}
                  <div style={{ pointerEvents: "none" }}>
                    <canvas
                      ref={(el) => {
                        previewRefs.current[idx] = el;
                      }}
                      className="w-full"
                      style={{ display: "block", aspectRatio: "1080/1920", pointerEvents: "none" }}
                    />
                  </div>
                </div>
                <span className="text-white text-sm font-bold">{TEMPLATE_NAMES[tmpl]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // step === "background"
  return (
    <div className="fixed inset-0 z-[5000] bg-black flex flex-col">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ paddingTop: "max(env(safe-area-inset-top, 0px) + 12px, 48px)" }}
      >
        <button onClick={() => setStep("template")} className="text-white text-sm">
          ← 뒤로
        </button>
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
      <div
        className="flex gap-2 px-4 py-4 flex-shrink-0"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
      >
        <button
          onClick={() => {
            setBgImage(null);
          }}
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
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
      </div>
    </div>
  );
}
