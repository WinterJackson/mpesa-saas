import Link from "next/link";
import { GitBranch, BookOpen } from "lucide-react";
import { Logo } from "@/components/logo";

export function SiteFooter() {
  return (
    <footer className="w-full py-16 border-t border-border bg-background">
      <div className="container px-4 md:px-8 mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 lg:gap-24">
          <div className="md:col-span-2 flex flex-col items-start gap-4">
            <Logo />
            <p className="text-muted-foreground leading-relaxed max-w-sm mt-2">
              The developer-first M-Pesa integration platform. Seamlessly collect payments, automate reconciliation, and monitor revenue in real-time.
            </p>
            <p className="text-sm text-muted-foreground mt-8 uppercase tracking-wider font-medium">
              &copy; {new Date().getFullYear()} PaySwift. All rights reserved.
            </p>
          </div>

          <div className="flex flex-col gap-6">
            <h4 className="font-semibold text-foreground tracking-tight text-lg">Product</h4>
            <div className="flex flex-col gap-4">
              <Link href="/demo-store" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2 w-fit">
                Demo Store
              </Link>
              <Link href="/sign-in" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2 w-fit">
                Sign In
              </Link>
              <Link href="/sign-up" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2 w-fit">
                Get Started
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <h4 className="font-semibold text-foreground tracking-tight text-lg">Developers</h4>
            <div className="flex flex-col gap-4">
              <Link href="https://github.com/WinterJackson/mpesa-saas" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2 w-fit">
                <GitBranch className="size-4" /> GitHub Repository
              </Link>
              <Link href="https://github.com/WinterJackson/mpesa-saas/blob/main/README.md" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2 w-fit">
                <BookOpen className="size-4" /> Documentation
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
