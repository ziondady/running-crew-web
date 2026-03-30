"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/home", icon: "🏠", label: "홈", aliases: [] as string[] },
  { href: "/gps", icon: "🏃", label: "러닝", aliases: ["/input", "/upload"] },
  { href: "/territory", icon: "🗺️", label: "점령전", aliases: [] as string[] },
  { href: "/versus", icon: "⚔️", label: "대항전", aliases: [] as string[] },
  { href: "/ranking", icon: "🏆", label: "랭킹", aliases: [] as string[] },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <div className="w-full bg-white border-t border-gray-200 flex">
      {navItems.map((item) => {
        const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href)) || item.aliases.some((a) => pathname.startsWith(a));
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
