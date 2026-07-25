import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cookie Policy — PaySwift',
  description:
    'How PaySwift uses cookies and similar technologies, and the choices available to you under the Kenya Data Protection Act, 2019.',
};

const EFFECTIVE_DATE = '25 July 2026';

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="mt-10 text-xl font-bold tracking-tight text-foreground">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function CookieRow({ name, purpose, type, retention }: { name: string; purpose: string; type: string; retention: string }) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-3 pr-4 align-top font-mono text-xs text-foreground">{name}</td>
      <td className="py-3 pr-4 align-top">{purpose}</td>
      <td className="py-3 pr-4 align-top whitespace-nowrap">{type}</td>
      <td className="py-3 align-top whitespace-nowrap">{retention}</td>
    </tr>
  );
}

export default function CookiePolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-sm font-medium text-primary">Legal</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">Cookie Policy</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Effective date: {EFFECTIVE_DATE} · Last updated: {EFFECTIVE_DATE}
      </p>

      <div className="mt-8 rounded-xl border border-border bg-muted/30 p-4 text-sm leading-relaxed text-muted-foreground">
        This Cookie Policy explains how PaySwift (“PaySwift”, “we”, “us”, “our”) uses cookies and similar
        technologies when you visit our website, dashboard and hosted checkout (together, the “Service”). It
        should be read together with our{' '}
        <a className="text-primary hover:underline" href="/legal/privacy">Privacy Policy</a> and{' '}
        <a className="text-primary hover:underline" href="/legal/terms">Terms of Service</a>. We handle
        personal data in accordance with the Data Protection Act, 2019 (No. 24 of 2019) of Kenya and the
        Data Protection (General) Regulations, 2021.
      </div>

      <Section id="what" title="1. What cookies are">
        <p>
          A cookie is a small text file that a website stores on your device (computer, tablet or phone) when
          you visit. Cookies let a site remember your actions and preferences over time. We also use closely
          related browser technologies such as <strong className="text-foreground">local storage</strong>,
          which stores small amounts of data in your browser in a similar way. In this policy, “cookies”
          refers to all of these technologies.
        </p>
      </Section>

      <Section id="how" title="2. How we categorise the cookies we use">
        <p>We group the technologies we use into two categories:</p>
        <p>
          <strong className="text-foreground">Strictly necessary cookies.</strong> These are essential for the
          Service to function — for example, to sign you in securely, keep you signed in as you move between
          pages, protect against cross-site request forgery, and remember basic preferences you have set.
          Because the Service cannot operate without them, they do not require your consent, but you can
          still block them through your browser (in which case parts of the Service will not work).
        </p>
        <p>
          <strong className="text-foreground">Optional cookies.</strong> These help us understand and improve
          how PaySwift is used, or enable non-essential conveniences. We only set optional cookies where you
          have given consent through our cookie banner. Today we do not run third-party advertising or
          cross-site tracking cookies, and we do not sell personal data.
        </p>
      </Section>

      <Section id="which" title="3. The cookies we actually set">
        <p>
          We keep our cookie use deliberately minimal. The table below describes the cookies and local-storage
          items PaySwift and our essential service providers set. Exact names set by our authentication
          provider may vary as their software updates.
        </p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[36rem] text-left text-sm text-muted-foreground">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-foreground">
              <tr>
                <th className="py-3 pl-4 pr-4 font-semibold">Name</th>
                <th className="py-3 pr-4 font-semibold">Purpose</th>
                <th className="py-3 pr-4 font-semibold">Category</th>
                <th className="py-3 pr-4 font-semibold">Retention</th>
              </tr>
            </thead>
            <tbody className="[&>tr>td:first-child]:pl-4">
              <CookieRow
                name="__session, __client_uat"
                purpose="Set by our authentication provider (Clerk) to sign you in and keep your session secure. Required to access the dashboard."
                type="Strictly necessary"
                retention="Session / up to 7 days"
              />
              <CookieRow
                name="payswift_view_env"
                purpose="Remembers whether you are viewing Sandbox or Live records in your dashboard. A display preference only — it never changes how payments are processed."
                type="Strictly necessary"
                retention="Up to 1 year"
              />
              <CookieRow
                name="payswift_cookie_consent"
                purpose="Stores your cookie choice (local storage) so we don't ask again on every visit."
                type="Strictly necessary"
                retention="Up to 1 year"
              />
              <CookieRow
                name="theme"
                purpose="Remembers your light/dark appearance preference."
                type="Strictly necessary"
                retention="Persistent (local storage)"
              />
            </tbody>
          </table>
        </div>
        <p className="text-xs">
          We may also use error-monitoring (Sentry) to capture technical diagnostics when something breaks;
          this is used to keep the Service reliable and secure and does not track your browsing across other
          websites.
        </p>
      </Section>

      <Section id="choices" title="4. Your choices and how to manage cookies">
        <p>
          When you first visit, our cookie banner lets you <strong className="text-foreground">Accept all</strong>{' '}
          or choose <strong className="text-foreground">Essential only</strong>. You can change your mind at any
          time by clearing the <span className="font-mono text-xs">payswift_cookie_consent</span> item in your
          browser (or clearing site data), which will make the banner appear again.
        </p>
        <p>
          You can also control cookies through your browser settings — most browsers let you block or delete
          cookies and warn you before one is set. Because our strictly necessary cookies are required to sign
          in, blocking them will prevent the dashboard from working. Guidance is available in the help pages
          of Chrome, Safari, Firefox and Edge.
        </p>
      </Section>

      <Section id="rights" title="5. Your data protection rights">
        <p>
          Where cookies process your personal data, you have the rights granted by the Data Protection Act,
          2019 — including the right to be informed, to access your data, to object to processing, and to
          lodge a complaint with the Office of the Data Protection Commissioner (ODPC). Our{' '}
          <a className="text-primary hover:underline" href="/legal/privacy">Privacy Policy</a> explains these
          rights and how to exercise them in full.
        </p>
      </Section>

      <Section id="changes" title="6. Changes to this policy">
        <p>
          We may update this Cookie Policy from time to time to reflect changes in the technologies we use or
          in the law. When we do, we will revise the “Last updated” date above and, where the changes are
          material, ask for your consent again through the cookie banner.
        </p>
      </Section>

      <Section id="contact" title="7. Contact us">
        <p>
          If you have questions about this Cookie Policy or our use of cookies, contact us at{' '}
          <a className="text-primary hover:underline" href="mailto:support@payswift.co.ke">support@payswift.co.ke</a>.
          You can also reach our data protection contact using the details in our Privacy Policy.
        </p>
      </Section>
    </div>
  );
}
