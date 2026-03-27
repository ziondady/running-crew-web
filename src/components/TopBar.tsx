"use client";
import { useRouter } from "next/navigation";

export default function TopBar({
  title, right, back, settingsButton,
}: {
  title: string;
  right?: React.ReactNode;
  back?: boolean;
  settingsButton?: boolean;
}) {
  const router = useRouter();
  return (
    <div className="w-full bg-[var(--dark)] text-white px-4 py-3 text-sm font-bold flex items-center gap-2">
      {back && <button onClick={() => window.history.back()} className="opacity-60 text-xs">←</button>}
      <span className="flex-1">{title}</span>
      {right}
      {settingsButton && (
        <button onClick={() => router.push("/mypage")} className="opacity-80 text-lg ml-1">⚙️</button>
      )}
    </div>
  );
}
