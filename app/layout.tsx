import { Toaster } from "@/components/ui/sonner";
import type { Metadata } from "next";
import { ClerkProvider } from '@clerk/nextjs';
import { Fredoka, Karla, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

// Body: Karla — a humanist sans with quirky details that keep the pairing
// coherent (not a generic corporate body under a rounded heading), and reads
// cleanly at small sizes for tables and receipts on budget Android phones.
const karla = Karla({
  variable: "--font-karla",
  subsets: ["latin"],
});

// Headings: Fredoka — genuinely rounded with big open counters for warmth.
// DELIBERATELY capped at 400–600 (Regular/Medium/SemiBold): we avoid the
// chunkiest 700/800 cuts so it stays credible for a payments product rather
// than reading as a kids' app. globals.css disables synthetic bolding so
// font-bold headings render as real SemiBold, never a faux-heavy weight.
const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
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
        className={`${karla.variable} ${fredoka.variable} ${jetbrainsMono.variable} h-full antialiased`}
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
