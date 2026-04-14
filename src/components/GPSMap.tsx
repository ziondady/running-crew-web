"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getCachedLocation, saveLocation } from "@/lib/location";

interface GpsPoint {
  lat: number;
  lng: number;
  timestamp: number;
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

const CREW_COLORS = [
  "#FF5722", "#1565C0", "#2E7D32", "#9C27B0", "#F57C00",
  "#00838F", "#C62828", "#4527A0", "#EF6C00", "#00695C",
  "#AD1457", "#283593", "#558B2F", "#6A1B9A", "#D84315",
];

interface GPSMapProps {
  points: GpsPoint[];
  currentPos: GpsPoint | null;
  cells?: CellItem[];
  showCells?: boolean;
  myCrewId?: number | null;
}

export default function GPSMap({ points, currentPos, cells = [], showCells = false, myCrewId }: GPSMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cellsLayerRef = useRef<L.LayerGroup | null>(null);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
    });
    const cached = getCachedLocation();
    map.setView(cached ? [cached.lat, cached.lng] : [37.5665, 126.9780], cached ? 16 : 15);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    // Add zoom control to bottom right
    L.control.zoom({ position: "bottomright" }).addTo(map);

    // 현위치 이동 버튼
    const locateControl = L.Control.extend({
      options: { position: "bottomright" as L.ControlPosition },
      onAdd() {
        const btn = L.DomUtil.create("div", "");
        btn.innerHTML = "📍";
        btn.style.cssText = "width:34px;height:34px;background:#fff;border-radius:4px;box-shadow:0 1px 5px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:18px;margin-bottom:0;";
        btn.onclick = (e) => {
          e.stopPropagation();
          const loc = getCachedLocation();
          if (loc && mapRef.current) mapRef.current.setView([loc.lat, loc.lng], 16);
        };
        return btn;
      },
    });
    new locateControl().addTo(map);

    // Layer group for territory cells
    cellsLayerRef.current = L.layerGroup().addTo(map);

    mapRef.current = map;

    // 초기 위치는 캐시 사용 (네이티브 GPS가 업데이트하면 currentPos로 지도 이동됨)

    return () => {
      map.remove();
      mapRef.current = null;
      cellsLayerRef.current = null;
    };
  }, []);

  // Update territory cells layer
  useEffect(() => {
    if (!mapRef.current || !cellsLayerRef.current) return;
    const layer = cellsLayerRef.current;
    layer.clearLayers();

    if (!showCells || cells.length === 0) return;

    // Build crew color map
    const crewIds = [...new Set(cells.map(c => c.crew_id).filter(Boolean))] as number[];
    const crewColorMap: Record<number, string> = {};
    if (myCrewId) {
      crewColorMap[myCrewId] = CREW_COLORS[0];
    }
    let colorIdx = 1;
    crewIds.forEach(cid => {
      if (!crewColorMap[cid]) {
        crewColorMap[cid] = CREW_COLORS[colorIdx % CREW_COLORS.length];
        colorIdx++;
      }
    });

    cells.forEach((cell) => {
      const { south, west, north, east } = cell.bounds;
      const color = cell.crew_id ? (crewColorMap[cell.crew_id] || "#999") : (cell.user_color || "#999");
      const fillOpacity = 0.25 + cell.durability * 0.08;

      L.rectangle(
        [[south, west], [north, east]],
        {
          color: color,
          weight: 0.5,
          opacity: 0.3,
          fillColor: color,
          fillOpacity: fillOpacity,
        }
      ).addTo(layer);
    });
  }, [cells, showCells, myCrewId]);

  // Update polyline and marker
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    const latLngs = points.map((p) => [p.lat, p.lng] as [number, number]);

    // Update or create polyline
    if (polylineRef.current) {
      polylineRef.current.setLatLngs(latLngs);
    } else if (latLngs.length > 0) {
      polylineRef.current = L.polyline(latLngs, {
        color: "#FF5722",
        weight: 4,
        opacity: 0.8,
        smoothFactor: 1,
      }).addTo(map);
    }

    // Update current position marker
    if (currentPos) {
      if (markerRef.current) {
        markerRef.current.setLatLng([currentPos.lat, currentPos.lng]);
      } else {
        markerRef.current = L.circleMarker([currentPos.lat, currentPos.lng], {
          radius: 8,
          fillColor: "#FF5722",
          fillOpacity: 1,
          color: "#fff",
          weight: 3,
        }).addTo(map);
      }

      // Pan to current position
      map.panTo([currentPos.lat, currentPos.lng], { animate: true });
    }

    // Add start marker
    if (latLngs.length > 0 && !(map as any)._startMarkerAdded) {
      // Inject glow animation CSS once
      if (!document.getElementById("start-marker-style")) {
        const style = document.createElement("style");
        style.id = "start-marker-style";
        style.textContent = `
          @keyframes startMarkerGlow {
            0%, 100% { box-shadow: 0 0 6px rgba(76,175,80,0.6); }
            50%       { box-shadow: 0 0 14px rgba(76,175,80,1); }
          }
          .start-marker-pin {
            animation: startMarkerGlow 2s ease-in-out infinite;
          }
        `;
        document.head.appendChild(style);
      }

      const startIcon = L.divIcon({
        className: "",
        html: `<div class="start-marker-pin" style="
          width: 28px; height: 28px;
          background: #4CAF50;
          border: 3px solid #fff;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          display: flex; align-items: center; justify-content: center;
        "><span style="transform: rotate(45deg); color: white; font-weight: 900; font-size: 12px; line-height: 1;">S</span></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
      });
      L.marker(latLngs[0], { icon: startIcon }).addTo(map);
      (map as any)._startMarkerAdded = true;
    }
  }, [points, currentPos]);

  return (
    <div ref={containerRef} className="w-full h-full" style={{ background: "#1a2a3a" }} />
  );
}
