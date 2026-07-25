import React from 'react';
import Link from 'next/link';
import { Logo } from '@/components/logo';
import { SiteFooter } from '@/components/site-footer';

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-4xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Logo href="/" />
          <nav className="flex items-center gap-5 text-sm font-medium">
            <Link href="/legal/terms" className="text-muted-foreground transition-colors hover:text-foreground">Terms</Link>
            <Link href="/legal/privacy" className="text-muted-foreground transition-colors hover:text-foreground">Privacy</Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
