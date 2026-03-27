"use client";
import { useEffect } from "react";
import { getStoredUser } from "@/lib/auth";
import { initPushNotifications } from "@/lib/push";

export default function PushInit() {
  useEffect(() => {
    const user = getStoredUser();
    if (!user) return;
    // Capacitor 브릿지 로딩 대기 (외부 URL 로드 시 타이밍 이슈)
    const timer = setTimeout(() => {
      initPushNotifications(user.id);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return null;
}
