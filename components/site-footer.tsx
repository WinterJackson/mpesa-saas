import Link from "next/link";
import { GitBranch, BookOpen } from "lucide-react";
import { Logo } from "@/components/logo";

export function SiteFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full px-[10px]">
      <div className="w-full bg-sidebar text-sidebar-foreground rounded-t-[40px]">
        <div className="container px-6 md:px-8 mx-auto max-w-7xl">
          {/* Main Footer Content */}
          <div className="py-12 md:py-16 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-10 md:gap-12 lg:gap-16">
            {/* Brand Column — full width on mobile, 2 cols on md, 2 cols on lg */}
            <div className="col-span-2 md:col-span-4 lg:col-span-2 flex flex-col items-start gap-4">
              <Logo inverted />
              <p className="text-sm text-sidebar-foreground/70 leading-relaxed max-w-sm mt-1">
                The developer-first M-Pesa integration platform. Seamlessly collect payments, automate reconciliation, and monitor revenue in real-time.
              </p>
            </div>

            {/* Product Column */}
            <div className="flex flex-col gap-4">
              <h4 className="font-semibold text-sidebar-foreground tracking-tight text-sm uppercase">
                Product
              </h4>
              <nav className="flex flex-col gap-3">
                <Link
                  href="/demo-store"
                  className="text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors w-fit"
                >
                  Demo Store
                </Link>
                <Link
                  href="/sign-in"
                  className="text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors w-fit"
                >
                  Sign In
                </Link>
                <Link
                  href="/sign-up"
                  className="text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors w-fit"
                >
                  Get Started
                </Link>
              </nav>
            </div>

            {/* Developers Column */}
            <div className="flex flex-col gap-4">
              <h4 className="font-semibold text-sidebar-foreground tracking-tight text-sm uppercase">
                Developers
              </h4>
              <nav className="flex flex-col gap-3">
                <Link
                  href="https://github.com/WinterJackson/mpesa-saas"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors flex items-center gap-2 w-fit"
                >
                  <GitBranch className="size-3.5 shrink-0" /> GitHub
                </Link>
                <Link
                  href="https://github.com/WinterJackson/mpesa-saas/blob/main/README.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors flex items-center gap-2 w-fit"
                >
                  <BookOpen className="size-3.5 shrink-0" /> Docs
                </Link>
              </nav>
            </div>

            {/* Legal Column */}
            <div className="flex flex-col gap-4">
              <h4 className="font-semibold text-sidebar-foreground tracking-tight text-sm uppercase">
                Legal
              </h4>
              <nav className="flex flex-col gap-3">
                <Link
                  href="/legal/terms"
                  className="text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors w-fit"
                >
                  Terms
                </Link>
                <Link
                  href="/legal/privacy"
                  className="text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors w-fit"
                >
                  Privacy
                </Link>
                <Link
                  href="/legal/cookies"
                  className="text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors w-fit"
                >
                  Cookies
                </Link>
              </nav>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="py-6 border-t border-sidebar-border flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-sidebar-foreground/70">
              &copy; {currentYear} PaySwift. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
