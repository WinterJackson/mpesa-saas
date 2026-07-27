"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Building2, FileCheck, CreditCard, Scale, Receipt, Landmark, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import type { AdminRole } from "@/lib/admin-rbac";

const navItems: { name: string; href: string; icon: typeof LayoutDashboard; roles?: AdminRole[] }[] = [
  { name: "Overview", href: "/admin", icon: LayoutDashboard },
  { name: "Organizations", href: "/admin/organizations", icon: Building2 },
  { name: "KYC Review", href: "/admin/kyc-review", icon: FileCheck },
  { name: "Billing", href: "/admin/billing", icon: CreditCard },
  { name: "Reconciliation", href: "/admin/reconciliation", icon: Scale },
  { name: "Transactions", href: "/admin/transactions", icon: Receipt },
  { name: "Balances", href: "/admin/balances", icon: Landmark },
  { name: "Admins", href: "/admin/admins", icon: Shield, roles: ["superadmin"] },
];

function isNavActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebar({ role }: { role: AdminRole }) {
  const pathname = usePathname();
  const items = navItems.filter((item) => !item.roles || item.roles.includes(role));

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex h-full shrink-0 py-floating-header pl-0">
        <aside className="flex flex-col w-64 rounded-l-none rounded-r-[40px] bg-sidebar text-sidebar-foreground shadow-floating-header overflow-hidden">
          <div className="p-6 border-b border-sidebar-border flex items-center">
            <Logo inverted href="/admin" />
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
