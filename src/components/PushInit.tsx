"use client";
import { useEffect } from "react";
import { getStoredUser } from "@/lib/auth";
import { initPushNotifications } from "@/lib/push";

/**
 * Mounts invisibly and initialises FCM push notifications once the user
 * is logged in. Renders nothing — place it anywhere inside the logged-in
 * layout so it runs on every page after login.
 */
export default function PushInit() {
  useEffect(() => {
    const user = getStoredUser();
    if (!user) return;
    initPushNotifications(user.id);
  }, []);

  return null;
}
