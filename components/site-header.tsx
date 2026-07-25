import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/logo";

export async function SiteHeader() {
  const { userId } = await auth();

  return (
    <div className="fixed top-0 z-50 w-full pt-floating-header pl-[15px] md:pl-[30px] pr-0">
      <header className="w-full rounded-l-[40px] rounded-r-none bg-background text-foreground backdrop-blur-md shadow-[0_10px_40px_-10px_rgba(19,42,19,0.25)] dark:shadow-[0_10px_40px_-10px_rgba(19,42,19,0.6)]">
        <div className="flex h-20 w-full items-center justify-between px-4 md:px-6">
          <Logo href="/" />
          <nav className="flex items-center gap-4">
            <Link href="/pricing" className="text-sm font-medium hover:text-primary transition-colors hidden sm:block">Pricing</Link>
            <Link href="/docs" className="text-sm font-medium hover:text-primary transition-colors hidden sm:block">Docs</Link>
            <ThemeToggle />
            {userId ? (
              <Link href="/dashboard">
                <Button variant="outline" size="sm">
                  Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/sign-in">
                  <Button size="sm" className="font-medium">
                    Sign In
                  </Button>
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
    </div>
  );
}
