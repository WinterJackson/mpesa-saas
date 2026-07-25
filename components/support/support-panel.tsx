import Link from "next/link";
import { MessageCircle, Mail, BookOpen, Activity, LifeBuoy } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SUPPORT_WHATSAPP_DISPLAY, SUPPORT_EMAIL, whatsappUrl } from "@/lib/support";

/**
 * Shared support content — the same channels the floating widget offers, laid
 * out as a full page. Rendered on the merchant Support tab and the admin
 * console so every user role has a consistent way to reach help.
 */
export function SupportPanel({ context }: { context?: string }) {
  const waMessage = context
    ? `Hi PaySwift support, I need help with ${context}:`
    : undefined;

  const channels = [
    {
      icon: MessageCircle,
      title: "WhatsApp",
      description: "Fastest way to reach us. Chat with our support team directly.",
      meta: SUPPORT_WHATSAPP_DISPLAY,
      href: waMessage ? whatsappUrl(waMessage) : whatsappUrl(),
      external: true,
      accent: "bg-[#25D366]/15 text-[#128C7E] dark:text-[#25D366]",
    },
    {
      icon: Mail,
      title: "Email",
      description: "Prefer email? Send us the details and we'll get back to you.",
      meta: SUPPORT_EMAIL,
      href: `mailto:${SUPPORT_EMAIL}`,
      external: true,
      accent: "bg-primary/10 text-primary",
    },
    {
      icon: BookOpen,
      title: "Documentation",
      description: "Integration guides, API reference and step-by-step tutorials.",
      meta: "Browse the docs",
      href: "/docs",
      external: false,
      accent: "bg-primary/10 text-primary",
    },
    {
      icon: Activity,
      title: "System status",
      description: "Check real-time platform health and past incidents.",
      meta: "View status page",
      href: "/status",
      external: false,
      accent: "bg-primary/10 text-primary",
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <LifeBuoy className="size-5" />
            Get help
          </CardTitle>
          <CardDescription>
            Our team is here to help you accept payments with confidence. Reach us through any of the
            channels below — we usually reply within minutes on WhatsApp during business hours.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {channels.map((c) => {
              const inner = (
                <div className="flex h-full items-start gap-4 rounded-xl border border-border bg-muted/20 p-4 transition-colors hover:bg-muted/40">
                  <span className={`flex size-11 shrink-0 items-center justify-center rounded-full ${c.accent}`}>
                    <c.icon className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{c.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{c.description}</p>
                    <p className="mt-2 text-sm font-medium text-primary">{c.meta} →</p>
                  </div>
                </div>
              );
              return c.external ? (
                <a
                  key={c.title}
                  href={c.href}
                  target={c.href.startsWith("mailto:") ? undefined : "_blank"}
                  rel="noopener noreferrer"
                  className="block"
                >
                  {inner}
                </a>
              ) : (
                <Link key={c.title} href={c.href} className="block">
                  {inner}
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
