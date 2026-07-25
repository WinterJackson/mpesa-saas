import React from 'react';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground font-sans selection:bg-primary selection:text-primary-foreground">
      <SiteHeader />
      <main className="flex-1 w-full pt-32 pb-24 md:pt-40 md:pb-32 lg:pt-48 lg:pb-40 relative bg-background">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
