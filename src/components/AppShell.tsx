"use client";
import BottomNav from "./BottomNav";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full min-h-screen bg-[var(--bg)] relative flex flex-col">
      <div className="flex-1 flex flex-col">{children}</div>
      <div className="h-24" />
      <div className="fixed bottom-0 w-full max-w-[430px] left-1/2 -translate-x-1/2">
        <div
          className="w-full text-center py-2 text-xs font-semibold text-white"
          style={{ background: "linear-gradient(90deg, #FF5722, #FF8A65)" }}
        >
          광고 (AdMob 띠배너)
        </div>
        <BottomNav />
      </div>
    </div>
  );
}
