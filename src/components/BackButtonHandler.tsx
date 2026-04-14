"use client";
import { useEffect, useRef } from "react";
import { App } from "@capacitor/app";

export default function BackButtonHandler() {
  const lastBackRef = useRef(0);
  const toastRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handler = App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        const now = Date.now();
        if (now - lastBackRef.current < 2000) {
          App.exitApp();
        } else {
          lastBackRef.current = now;
          // 토스트 표시
          if (toastRef.current) {
            toastRef.current.style.display = "flex";
            setTimeout(() => {
              if (toastRef.current) toastRef.current.style.display = "none";
            }, 2000);
          }
        }
      }
    });

    return () => {
      handler.then((h) => h.remove());
    };
  }, []);

  return (
    <div
      ref={toastRef}
      style={{
        display: "none",
        position: "fixed",
        bottom: 80,
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(0,0,0,0.8)",
        color: "#fff",
        padding: "10px 20px",
        borderRadius: 12,
        fontSize: 13,
        fontWeight: 600,
        zIndex: 9998,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      한 번 더 누르면 종료됩니다
    </div>
  );
}
