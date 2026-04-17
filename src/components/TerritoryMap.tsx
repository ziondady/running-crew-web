"use client";
import { useEffect, useRef, useState } from "react";
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

interface TerritoryMapProps {
  territories: TerritoryItem[];
  cells: CellItem[];
  myUserId?: number;
  myCrewId?: number | null;
}

const CREW_COLORS = [
  "#FF5722", "#1565C0", "#2E7D32", "#9C27B0", "#F57C00",
  "#00838F", "#C62828", "#4527A0", "#EF6C00", "#00695C",
  "#AD1457", "#283593", "#558B2F", "#6A1B9A", "#D84315",
];

export default function TerritoryMap({ territories, cells, myUserId, myCrewId }: TerritoryMapProps) {
  const [filter, setFilter] = useState<"all" | "my" | "crew">("all");
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

    const filteredCells = filter === "all" ? cells
      : filter === "my" ? cells.filter(c => c.user === myUserId)
      : cells.filter(c => c.crew_id === myCrewId);

    const filteredTerritories = filter === "all" ? territories
      : filter === "my" ? territories.filter(t => t.user === myUserId)
      : territories.filter(t => t.crew_id === myCrewId);

    // Build crew color map (include both territory and cell crew IDs)
    const crewIds = [...new Set(territories.map(t => t.crew_id).filter(Boolean))] as number[];
    const cellCrewIds = [...new Set(cells.map(c => c.crew_id).filter(Boolean))] as number[];
    const allCrewIds = [...new Set([...crewIds, ...cellCrewIds])];
    const crewColorMap: Record<number, string> = {};
    if (myCrewId) {
      crewColorMap[myCrewId] = CREW_COLORS[0];
    }
    let colorIdx = 1;
    allCrewIds.forEach(cid => {
      if (!crewColorMap[cid]) {
        crewColorMap[cid] = CREW_COLORS[colorIdx % CREW_COLORS.length];
        colorIdx++;
      }
    });

    // Draw cells first (underneath)
    filteredCells.forEach((cell) => {
      const { south, west, north, east } = cell.bounds;
      const isMyCrew = cell.crew_id === myCrewId;
      const color = cell.crew_id ? (crewColorMap[cell.crew_id] || "#999") : (cell.user_color || "#999");
      const fillOpacity = 0.25 + cell.durability * 0.08;

      const rect = L.rectangle(
        [[south, west], [north, east]],
        {
          color: color,
          weight: 0.5,
          opacity: 0.3,
          fillColor: color,
          fillOpacity: fillOpacity,
        }
      );

      rect.bindPopup(`
        <div style="font-size:12px;min-width:100px;">
          <strong>${cell.username}</strong><br/>
          ${cell.crew_name ? `<span style="color:${color};font-weight:bold;">${cell.crew_name}</span><br/>` : ''}
          ${isMyCrew ? '<br/><span style="color:#FF5722;font-size:10px;">내 크루</span>' : ''}
        </div>
      `);

      rect.addTo(layers);

      // 셀 라벨 (줌 16+ 에서만 표시)
      const centerLat = (south + north) / 2;
      const centerLng = (west + east) / 2;
      const label = cell.crew_name ? cell.crew_name.charAt(0) : cell.username.charAt(0);
      const labelMarker = L.marker([centerLat, centerLng], {
        icon: L.divIcon({
          className: "",
          html: `<div style="font-size:8px;font-weight:bold;color:${color};text-align:center;line-height:1;text-shadow:0 0 2px #fff,0 0 2px #fff;">${label}</div>`,
          iconSize: [16, 12],
          iconAnchor: [8, 6],
        }),
        interactive: false,
      });
      labelMarker.addTo(layers);
    });

    // 줌 레벨에 따라 셀 라벨 표시/숨김
    const map = mapRef.current;
    const updateLabels = () => {
      const zoom = map.getZoom();
      layers.eachLayer((layer: any) => {
        if (layer instanceof L.Marker && layer.options && !layer.options.interactive) {
          const el = layer.getElement?.();
          if (el) el.style.display = zoom >= 16 ? "" : "none";
        }
      });
    };
    map.on("zoomend", updateLabels);
    updateLabels();

    // Draw territory routes as thin lines on top
    filteredTerritories.forEach((t) => {
      if (!t.path_data || t.path_data.length < 2) return;

      const latLngs = t.path_data.map(p => [p.lat, p.lng] as [number, number]);
      const isMyCrew = t.crew_id === myCrewId;
      const color = t.crew_id ? (crewColorMap[t.crew_id] || "#999") : (t.user_color || "#999");

      const route = L.polyline(latLngs, {
        color: color,
        weight: 3,
        opacity: 0.7,
      });

      route.bindPopup(`
        <div style="font-size:12px;min-width:120px;">
          <strong>${t.username}</strong><br/>
          ${t.crew_name ? `<span style="color:${color};font-weight:bold;">${t.crew_name}</span><br/>` : ''}
          ${isMyCrew ? '<br/><span style="color:#FF5722;font-size:10px;">내 크루</span>' : ''}
        </div>
      `);

      route.addTo(layers);
    });

  }, [territories, cells, myUserId, myCrewId, filter]);

  return (
    <div>
      <div ref={containerRef} className="w-full rounded-xl overflow-hidden" style={{ height: "55vh", background: "#e8e8e8" }} />
      <div className="flex gap-1.5 mt-2">
        {([["all", "전체"], ["crew", "내 크루"], ["my", "내 영역"]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
              filter === key ? "bg-[var(--dark)] text-white" : "bg-gray-200 text-gray-400"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
