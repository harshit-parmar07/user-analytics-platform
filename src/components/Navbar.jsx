"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Map, Activity } from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { path: "/", label: "Sessions", icon: BarChart3 },
    { path: "/heatmap", label: "Heatmap", icon: Map },
  ];

  const trackerUrl =
    process.env.NEXT_PUBLIC_TRACKER_URL || "/tracker/index.html";

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-white/80 border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-blue-600" />
            <span className="text-xl font-bold text-blue-600">
              User Analytics
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.path ||
                (item.path === "/" && pathname.startsWith("/sessions/"));
              const activeClass = isActive
                ? "bg-blue-50 text-blue-600 border border-blue-200"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-transparent";

              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 " +
                    activeClass
                  }
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <a
            href={trackerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-md border border-slate-200 transition-all"
          >
            Open Tracker Site
          </a>
        </div>
      </div>
    </header>
  );
}

