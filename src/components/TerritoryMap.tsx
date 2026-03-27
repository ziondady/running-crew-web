"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface TerritoryItem {
  id: number;
  user: number;
  username: string;
  user_color: string;
  path_data: { lat: number; lng: number }[];
  durability: number;
}

interface TerritoryMapProps {
  territories: TerritoryItem[];
  myUserId?: number;
}

export default function TerritoryMap({ territories, myUserId }: TerritoryMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<L.LayerGroup | null>(null);

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([37.5665, 126.9780], 12); // Default: Seoul

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);

    layersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // Try current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => map.setView([pos.coords.latitude, pos.coords.longitude], 14),
        () => {},
        { enableHighAccuracy: true }
      );
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Draw territories when data changes
  useEffect(() => {
    if (!mapRef.current || !layersRef.current) return;
    const layers = layersRef.current;
    layers.clearLayers();

    if (territories.length === 0) return;

    const allPoints: [number, number][] = [];

    territories.forEach((t) => {
      if (!t.path_data || t.path_data.length < 2) return;

      const latLngs: [number, number][] = t.path_data.map((p) => [p.lat, p.lng]);
      allPoints.push(...latLngs);

      const isMine = t.user === myUserId;
      const color = t.user_color || (isMine ? "#FF5722" : "#1565C0");

      // Line weight based on durability (1-5)
      const weight = 2 + t.durability * 1.5; // 3.5 ~ 9.5
      const opacity = 0.4 + t.durability * 0.12; // 0.52 ~ 1.0

      const polyline = L.polyline(latLngs, {
        color: color,
        weight: weight,
        opacity: opacity,
        smoothFactor: 1,
        lineCap: "round",
        lineJoin: "round",
      });

      // Popup with territory info
      polyline.bindPopup(`
        <div style="font-size:12px;min-width:120px;">
          <strong>${t.username}</strong><br/>
          내구도: Lv.${t.durability}<br/>
          ${isMine ? '<span style="color:#FF5722;font-weight:bold;">내 크루</span>' : ''}
        </div>
      `);

      polyline.addTo(layers);
    });

    // Fit bounds to show all territories
    if (allPoints.length > 0) {
      const bounds = L.latLngBounds(allPoints);
      mapRef.current.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
    }
  }, [territories, myUserId]);

  return (
    <div ref={containerRef} className="w-full rounded-xl overflow-hidden" style={{ height: "350px", background: "#e8e8e8" }} />
  );
}
