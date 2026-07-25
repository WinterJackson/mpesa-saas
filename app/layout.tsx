import { Toaster } from "@/components/ui/sonner";
import type { Metadata } from "next";
import { ClerkProvider } from '@clerk/nextjs';
import { Bricolage_Grotesque, Public_Sans, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

// Body: Public Sans — built by the US government for civic accessibility; calm
// and steady at small sizes, which matters for dashboards full of tables and
// receipts read on budget Android phones.
const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
});

// Headings: Bricolage Grotesque — springy, slightly irregular letterforms that
// read approachable without tipping into childish. "Friendly, but serious about
// your money."
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PaySwift — M-Pesa Payment Collection",
  description: "A robust SaaS platform for businesses to collect and manage M-Pesa payments on their websites seamlessly.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        suppressHydrationWarning
        className={`${publicSans.variable} ${bricolage.variable} ${jetbrainsMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster richColors position="top-right" />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
