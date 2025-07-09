"use client";
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: "🏠" },
  { name: "Activities", href: "/activities", icon: "🚴" },
  { name: "Segments", href: "/segments", icon: "⛰️" },
  { name: "Athletes", href: "/athletes", icon: "👥" },
  { name: "Comparison", href: "/comparison", icon: "📊" },
  { name: "Settings", href: "/settings", icon: "⚙️" },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="h-screen w-56 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col py-8 px-4">
      <div className="mb-8 text-2xl font-bold text-orange-500 tracking-tight">Cycling Coach</div>
      <nav className="flex-1 flex flex-col gap-2">
        {navItems.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors font-medium text-lg hover:bg-orange-50 dark:hover:bg-gray-800 ${pathname.startsWith(item.href) ? "bg-orange-100 dark:bg-gray-800 text-orange-600 dark:text-orange-400" : "text-gray-700 dark:text-gray-200"}`}
          >
            <span className="text-xl">{item.icon}</span>
            {item.name}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
