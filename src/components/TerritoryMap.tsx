"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getCachedLocation } from "@/lib/location";

interface CellBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

interface TerritoryItem {
  id: number;
  cell_key: string;
  user: number;
  username: string;
  user_color: string;
  crew_id: number | null;
  crew_name: string | null;
  durability: number;
  bounds: CellBounds;
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

  // Draw territory cells when data changes
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

    territories.forEach((t) => {
      if (!t.bounds) return;
      const { south, west, north, east } = t.bounds;
      allBounds.push([south, west], [north, east]);

      const isMyCrew = t.crew_id === myCrewId;
      const color = t.crew_id ? (crewColorMap[t.crew_id] || "#999") : "#999";

      // 내구도에 따른 투명도 (1~5 → 0.25~0.65)
      const fillOpacity = 0.2 + t.durability * 0.09;

      const rect = L.rectangle(
        [[south, west], [north, east]],
        {
          color: color,
          weight: isMyCrew ? 1.5 : 1,
          opacity: 0.9,
          fillColor: color,
          fillOpacity: fillOpacity,
        }
      );

      rect.bindPopup(`
        <div style="font-size:12px;min-width:120px;">
          <strong>${t.username}</strong><br/>
          ${t.crew_name ? `<span style="color:${color};font-weight:bold;">${t.crew_name}</span><br/>` : ''}
          내구도: Lv.${t.durability}
          ${isMyCrew ? '<br/><span style="color:#FF5722;font-size:10px;">내 크루</span>' : ''}
        </div>
      `);

      rect.addTo(layers);
    });

    // Fit bounds to show all cells
    if (allBounds.length > 0) {
      const bounds = L.latLngBounds(allBounds);
      mapRef.current.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
    }
  }, [territories, myUserId, myCrewId]);

  return (
    <div ref={containerRef} className="w-full rounded-xl overflow-hidden" style={{ height: "55vh", background: "#e8e8e8" }} />
  );
}
