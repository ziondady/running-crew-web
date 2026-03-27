"use client";
import BottomNav from "./BottomNav";
import PushInit from "./PushInit";

export default function AppShell({ children }: { children: React.ReactNode }) {
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
