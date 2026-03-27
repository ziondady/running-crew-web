"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/home", icon: "🏠", label: "홈" },
  { href: "/input", icon: "➕", label: "입력" },
  { href: "/territory", icon: "🗺️", label: "점령전" },
  { href: "/versus", icon: "⚔️", label: "대항전" },
  { href: "/ranking", icon: "🏆", label: "랭킹" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <div className="w-full bg-white border-t border-gray-200 flex">
      {navItems.map((item) => {
        const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 flex flex-col items-center py-2 text-xs ${
              active ? "text-[var(--primary)] font-bold" : "text-gray-400"
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
