import Link from "next/link";
import { GitBranch, BookOpen } from "lucide-react";
import { Logo } from "@/components/logo";

export function SiteFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-border bg-background">
      <div className="container px-6 md:px-8 mx-auto max-w-7xl">
        {/* Main Footer Content */}
        <div className="py-12 md:py-16 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-10 md:gap-12 lg:gap-16">
          {/* Brand Column — full width on mobile, 2 cols on md, 2 cols on lg */}
          <div className="col-span-2 md:col-span-4 lg:col-span-2 flex flex-col items-start gap-4">
            <Logo />
            <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mt-1">
              The developer-first M-Pesa integration platform. Seamlessly collect payments, automate reconciliation, and monitor revenue in real-time.
            </p>
          </div>

          {/* Product Column */}
          <div className="flex flex-col gap-4">
            <h4 className="font-semibold text-foreground tracking-tight text-sm uppercase">
              Product
            </h4>
            <nav className="flex flex-col gap-3">
              <Link
                href="/demo-store"
                className="text-sm text-muted-foreground hover:text-primary transition-colors w-fit"
              >
                Demo Store
              </Link>
              <Link
                href="/sign-in"
                className="text-sm text-muted-foreground hover:text-primary transition-colors w-fit"
              >
                Sign In
              </Link>
              <Link
                href="/sign-up"
                className="text-sm text-muted-foreground hover:text-primary transition-colors w-fit"
              >
                Get Started
              </Link>
            </nav>
          </div>

          {/* Developers Column */}
          <div className="flex flex-col gap-4">
            <h4 className="font-semibold text-foreground tracking-tight text-sm uppercase">
              Developers
            </h4>
            <nav className="flex flex-col gap-3">
              <Link
                href="https://github.com/WinterJackson/mpesa-saas"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-2 w-fit"
              >
                <GitBranch className="size-3.5 shrink-0" /> GitHub
              </Link>
              <Link
                href="https://github.com/WinterJackson/mpesa-saas/blob/main/README.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-2 w-fit"
              >
                <BookOpen className="size-3.5 shrink-0" /> Docs
              </Link>
            </nav>
          </div>

          {/* Legal Column */}
          <div className="flex flex-col gap-4">
            <h4 className="font-semibold text-foreground tracking-tight text-sm uppercase">
              Legal
            </h4>
            <nav className="flex flex-col gap-3">
              <Link
                href="/legal/terms"
                className="text-sm text-muted-foreground hover:text-primary transition-colors w-fit"
              >
                Terms
              </Link>
              <Link
                href="/legal/privacy"
                className="text-sm text-muted-foreground hover:text-primary transition-colors w-fit"
              >
                Privacy
              </Link>
            </nav>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="py-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            &copy; {currentYear} PaySwift. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="https://github.com/WinterJackson/mpesa-saas"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary transition-colors"
              aria-label="GitHub"
            >
              <GitBranch className="size-4" />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
