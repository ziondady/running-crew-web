"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface GpsPoint {
  lat: number;
  lng: number;
  timestamp: number;
}

interface GPSMapProps {
  points: GpsPoint[];
  currentPos: GpsPoint | null;
}

export default function GPSMap({ points, currentPos }: GPSMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([37.5665, 126.9780], 15); // Default: Seoul

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
          navigator.geolocation?.getCurrentPosition(
            (pos) => { if (mapRef.current) mapRef.current.setView([pos.coords.latitude, pos.coords.longitude], 16); },
            () => {}, { enableHighAccuracy: true }
          );
        };
        return btn;
      },
    });
    new locateControl().addTo(map);

    mapRef.current = map;

    // Try to get initial position
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (mapRef.current) {
            mapRef.current.setView([pos.coords.latitude, pos.coords.longitude], 16);
          }
        },
        () => {},
        { enableHighAccuracy: true }
      );
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

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
      L.circleMarker(latLngs[0], {
        radius: 6,
        fillColor: "#4CAF50",
        fillOpacity: 1,
        color: "#fff",
        weight: 2,
      }).addTo(map);
      (map as any)._startMarkerAdded = true;
    }
  }, [points, currentPos]);

  return (
    <div ref={containerRef} className="w-full h-full" style={{ background: "#1a2a3a" }} />
  );
}
