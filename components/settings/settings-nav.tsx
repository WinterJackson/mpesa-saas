"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { name: "Overview", href: "/settings" },
  { name: "Account", href: "/settings/account" },
  { name: "Notifications", href: "/settings/notifications" },
  { name: "Webhooks", href: "/settings/webhooks" },
  { name: "KYC", href: "/settings/kyc" },
  { name: "Support", href: "/settings/support" },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <div className="overflow-x-auto">
      <nav className="flex min-w-max items-center gap-1 border-b border-border">
        {TABS.map((tab) => {
          const isActive =
            tab.href === "/settings" ? pathname === "/settings" : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
              )}
            >
              {tab.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
