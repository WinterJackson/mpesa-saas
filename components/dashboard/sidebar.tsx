"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Settings, Receipt, Users, CreditCard, Link2, Blocks, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";

type Role = "owner" | "admin" | "developer" | "finance";

// `roles` omitted = visible to everyone. Otherwise the item is only shown to the
// listed roles, so a member never sees a section they can't act in (e.g. finance
// doesn't see Integrations/Team/Settings; developer doesn't see Billing/Team).
const navItems: { name: string; href: string; icon: typeof LayoutDashboard; roles?: Role[] }[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Transactions", href: "/transactions", icon: Receipt },
  { name: "Payment Links", href: "/payment-links", icon: Link2, roles: ["owner", "admin", "developer"] },
  { name: "Payouts", href: "/payouts", icon: Send, roles: ["owner", "admin", "finance"] },
  { name: "Integrations", href: "/integrations", icon: Blocks, roles: ["owner", "admin", "developer"] },
  { name: "Team", href: "/team", icon: Users, roles: ["owner", "admin"] },
  { name: "Billing", href: "/billing", icon: CreditCard, roles: ["owner", "admin", "finance"] },
  { name: "Settings", href: "/settings", icon: Settings, roles: ["owner", "admin", "developer"] },
];

// A nav item is active on its exact route AND on any nested route beneath it
// (e.g. Settings stays active across /settings/account, /settings/webhooks…).
// The Dashboard root only matches exactly, so it never lights up for siblings.
function isNavActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ role }: { role?: string }) {
  const pathname = usePathname();
  const items = navItems.filter((item) => !item.roles || (role && item.roles.includes(role as Role)));

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex h-full shrink-0 py-floating-header pl-0">
        <aside className="flex flex-col w-64 rounded-l-none rounded-r-[40px] bg-sidebar text-sidebar-foreground shadow-floating-header overflow-hidden">
          <div className="p-6 border-b border-sidebar-border flex items-center">
            <Logo inverted href="/dashboard" />
          </div>
          <nav className="flex-1 p-4 flex flex-col gap-2">
            {items.map((item) => {
              const isActive = isNavActive(pathname, item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
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
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 pl-[15px] pr-0 pb-[calc(var(--spacing-floating-header)+env(safe-area-inset-bottom))]">
        <nav className="flex h-20 items-center justify-around rounded-l-[40px] rounded-r-none bg-sidebar text-sidebar-foreground shadow-floating-header px-3">
          {items.map((item) => {
            const isActive = isNavActive(pathname, item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center p-2 rounded-md transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="size-6" />
                <span className="sr-only">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
