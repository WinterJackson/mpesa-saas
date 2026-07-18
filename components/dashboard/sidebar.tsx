"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";

const navItems = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex h-full shrink-0 pt-floating-header pl-floating-header pb-floating-header">
        <aside className="flex flex-col w-64 rounded-floating-header bg-floating-header-bg backdrop-blur-md text-sidebar-foreground shadow-floating-header overflow-hidden">
          <div className="p-6 border-b border-sidebar-border flex items-center">
            <Logo />
          </div>
          <nav className="flex-1 p-4 flex flex-col gap-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className="size-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </aside>
      </div>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-floating-header pb-[calc(var(--spacing-floating-header)+env(safe-area-inset-bottom))]">
        <nav className="flex items-center justify-around rounded-floating-header bg-floating-header-bg backdrop-blur-md shadow-floating-header p-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 p-2 rounded-md transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className="size-6" />
                <span className="text-[10px] font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
