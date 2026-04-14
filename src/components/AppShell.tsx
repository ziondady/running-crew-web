"use client";
import { useEffect } from "react";
import BottomNav from "./BottomNav";
import PushInit from "./PushInit";
import { saveLocation } from "@/lib/location";

export default function AppShell({ children }: { children: React.ReactNode }) {
  // App-level GPS warmup so GPS chip is ready before user enters GPS page
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        saveLocation(pos.coords.latitude, pos.coords.longitude);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  return (
    <div className="w-full min-h-screen bg-[var(--bg)] relative flex flex-col">
      <PushInit />
      <div className="flex-1 flex flex-col">{children}</div>
      <div className="h-24" />
      <div className="fixed bottom-0 w-full max-w-[430px] left-1/2 -translate-x-1/2">
        <BottomNav />
      </div>
    </div>
  );
}
