"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getCachedLocation } from "@/lib/location";

interface TerritoryItem {
  id: number;
  user: number;
  username: string;
  user_color: string;
  crew_id: number | null;
  crew_name: string | null;
  durability: number;
  path_data: { lat: number; lng: number }[];
}

interface TerritoryMapProps {
  territories: TerritoryItem[];
  myUserId?: number;
  myCrewId?: number | null;
}

const CREW_COLORS = [
  "#FF5722", "#1565C0", "#2E7D32", "#9C27B0", "#F57C00",
  "#00838F", "#C62828", "#4527A0", "#EF6C00", "#00695C",
  "#AD1457", "#283593", "#558B2F", "#6A1B9A", "#D84315",
];

export default function TerritoryMap({ territories, myUserId, myCrewId }: TerritoryMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<L.LayerGroup | null>(null);

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
    });
    const cached = getCachedLocation();
    map.setView(cached ? [cached.lat, cached.lng] : [37.5665, 126.9780], cached ? 15 : 12);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

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

    layersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Draw territory routes when data changes
  useEffect(() => {
    if (!mapRef.current || !layersRef.current) return;
    const layers = layersRef.current;
    layers.clearLayers();

    if (territories.length === 0) return;

    // Build crew color map
    const crewIds = [...new Set(territories.map(t => t.crew_id).filter(Boolean))] as number[];
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

    const allBounds: [number, number][] = [];

    // 시작점과 끝점이 가까우면(50m 이내) 폐합 경로로 판단
    function isClosed(pts: [number, number][]): boolean {
      if (pts.length < 10) return false;
      const first = pts[0];
      const last = pts[pts.length - 1];
      const dLat = (first[0] - last[0]) * 111320;
      const dLng = (first[1] - last[1]) * 111320 * Math.cos(first[0] * Math.PI / 180);
      return Math.sqrt(dLat * dLat + dLng * dLng) < 50;
    }

    territories.forEach((t) => {
      if (!t.path_data || t.path_data.length < 2) return;

      const latLngs = t.path_data.map(p => [p.lat, p.lng] as [number, number]);
      const isMyCrew = t.crew_id === myCrewId;
      const color = t.crew_id ? (crewColorMap[t.crew_id] || "#999") : (t.user_color || "#999");
      const fillOpacity = 0.3 + t.durability * 0.1;
      const weight = 8 + t.durability * 2;

      const popupHtml = `
        <div style="font-size:12px;min-width:120px;">
          <strong>${t.username}</strong><br/>
          ${t.crew_name ? `<span style="color:${color};font-weight:bold;">${t.crew_name}</span><br/>` : ''}
          내구도: Lv.${t.durability}
          ${isMyCrew ? '<br/><span style="color:#FF5722;font-size:10px;">내 크루</span>' : ''}
        </div>
      `;

      if (isClosed(latLngs)) {
        // 폐합 경로 → 폴리곤 (면적 채움)
        const polygon = L.polygon(latLngs, {
          color: color,
          weight: 2,
          opacity: 0.8,
          fillColor: color,
          fillOpacity: fillOpacity,
        });
        polygon.bindPopup(popupHtml);
        polygon.addTo(layers);
      } else {
        // 개방 경로 → 폴리라인 (코리더)
        const corridor = L.polyline(latLngs, {
          color: color,
          weight: weight,
          opacity: fillOpacity,
          lineCap: 'round',
          lineJoin: 'round',
        });
        const route = L.polyline(latLngs, {
          color: color,
          weight: 2,
          opacity: 0.8,
        });
        corridor.bindPopup(popupHtml);
        corridor.addTo(layers);
        route.addTo(layers);
      }

      // Collect bounds
      latLngs.forEach(ll => allBounds.push(ll));
    });

    // Fit bounds to show all routes
    if (allBounds.length > 0) {
      const bounds = L.latLngBounds(allBounds);
      mapRef.current.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
    }
  }, [territories, myUserId, myCrewId]);

  return (
    <div ref={containerRef} className="w-full rounded-xl overflow-hidden" style={{ height: "55vh", background: "#e8e8e8" }} />
  );
}
