import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service — PaySwift',
  description:
    'The terms governing your use of PaySwift, a Kenyan M-Pesa payment integration platform for businesses.',
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

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-sm font-medium text-primary">Legal</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">Terms of Service</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Effective date: {EFFECTIVE_DATE} · Last updated: {EFFECTIVE_DATE}
      </p>

      <div className="mt-8 rounded-xl border border-border bg-muted/30 p-4 text-sm leading-relaxed text-muted-foreground">
        These Terms of Service (the “Terms”) form a legally binding agreement between you (the “Merchant”,
        “you”) and PaySwift (“PaySwift”, “we”, “us”, “our”) governing your access to and use of the
        PaySwift platform, dashboard, APIs and related services (together, the “Service”). By creating an
        account, clicking to accept, or using the Service, you confirm that you have read, understood and
        agree to be bound by these Terms. If you do not agree, do not use the Service.
      </div>

      <Section id="about" title="1. Who we are and what PaySwift is">
        <p>
          PaySwift is a software-as-a-service platform that helps businesses in Kenya accept, manage and
          reconcile payments made over Safaricom’s M-Pesa service through the Daraja API. PaySwift provides
          tools such as a dashboard, no-code payment links, a hosted checkout, a developer API, webhooks,
          reporting and integrations.
        </p>
        <p>
          <strong className="text-foreground">PaySwift is a technology provider, not a bank, deposit-taking
          institution, or issuer of electronic money.</strong> Under our standard model, M-Pesa payments are
          collected directly into your own M-Pesa Paybill or Till (your own Safaricom-issued shortcode) and
          settle to you directly through Safaricom. PaySwift does not take custody of, hold, or control your
          customers’ funds. Safaricom PLC is the licensed payment service provider that operates M-Pesa and
          effects settlement.
        </p>
      </Section>

      <Section id="eligibility" title="2. Eligibility and account registration">
        <p>
          To use the Service you must be at least 18 years old and able to enter into a binding contract, and
          you must be a lawfully registered business or a sole proprietor operating lawfully in Kenya. You
          agree to provide accurate, current and complete information during onboarding and to keep it up to
          date, including the “Know Your Customer” (KYC) information and documents we reasonably require
          (such as a national ID, business registration certificate and KRA PIN).
        </p>
        <p>
          You are responsible for maintaining the confidentiality of your account credentials and API keys,
          and for all activity under your account. Notify us immediately at{' '}
          <a className="text-primary hover:underline" href="mailto:support@payswift.co.ke">support@payswift.co.ke</a>{' '}
          if you suspect unauthorised access.
        </p>
      </Section>

      <Section id="service" title="3. The Service, sandbox and going live">
        <p>
          New accounts start in <strong className="text-foreground">sandbox mode</strong>, which uses
          Safaricom’s test environment and does not move real money. To accept real payments
          (<strong className="text-foreground">live mode</strong>) you must complete KYC verification and be
          approved by PaySwift, and you must connect your own valid Safaricom Daraja live credentials. We may
          decline, delay or revoke live access at our reasonable discretion, including where verification is
          incomplete or where we identify a compliance or fraud risk.
        </p>
        <p>
          You are responsible for obtaining and maintaining your own Safaricom Daraja account and shortcode
          and for complying with Safaricom’s Daraja API terms. The M-Pesa service is provided by Safaricom
          and is outside PaySwift’s control.
        </p>
      </Section>

      <Section id="fees" title="4. Fees, subscriptions and taxes">
        <p>
          PaySwift charges a <strong className="text-foreground">flat subscription fee</strong> for the
          Service and, on some plans, a small flat fee per transaction beyond the volume included in your
          plan. <strong className="text-foreground">PaySwift never charges a percentage of your sales.</strong>{' '}
          Current pricing is published on our pricing page and forms part of these Terms.
        </p>
        <p>
          Subscription fees are billed in advance to the M-Pesa number you designate for billing, by way of an
          M-Pesa STK Push prompt that you authorise with your PIN. Fees are stated exclusive of any applicable
          taxes unless indicated otherwise; where PaySwift is required to charge Value Added Tax (VAT) or other
          taxes under Kenyan law, these will be added and reflected on your invoice. You are responsible for
          your own tax obligations arising from your use of the Service and your sales.
        </p>
        <p>
          If a subscription payment fails, we may retry it and place your account in a past-due state with a
          grace period. If it remains unpaid, we may suspend paid features until payment is made. Fees already
          paid are non-refundable except where required by law.
        </p>
      </Section>

      <Section id="obligations" title="5. Your obligations and acceptable use">
        <p>You agree that you will not, and will not permit others to:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>use the Service for any unlawful, fraudulent or deceptive purpose, or to sell goods or services prohibited by Kenyan law or by Safaricom’s terms;</li>
          <li>use the Service to facilitate money laundering, terrorism financing, or to evade sanctions, in breach of the Proceeds of Crime and Anti-Money Laundering Act, 2009 (POCAMLA) and related regulations;</li>
          <li>misrepresent your identity or your business, or process transactions on behalf of an undisclosed third party;</li>
          <li>attempt to gain unauthorised access to the Service, interfere with its operation, bypass rate limits or security controls, or reverse engineer it;</li>
          <li>infringe the intellectual property or privacy rights of PaySwift or any third party.</li>
        </ul>
        <p>
          You are solely responsible for the lawfulness of your business, your relationship with your
          customers, the goods and services you sell, and any refunds or disputes with your customers.
        </p>
      </Section>

      <Section id="compliance" title="6. Compliance with law">
        <p>
          Each party will comply with all laws applicable to it, including the National Payment System Act,
          2011 and its regulations, the Central Bank of Kenya’s applicable directives, the Data Protection
          Act, 2019, the Consumer Protection Act, 2012, and POCAMLA. As a merchant you are responsible for
          meeting your own regulatory, licensing, consumer-protection and tax obligations in connection with
          your business.
        </p>
      </Section>

      <Section id="data" title="7. Data protection">
        <p>
          Our handling of personal data is described in our{' '}
          <a className="text-primary hover:underline" href="/legal/privacy">Privacy Policy</a>, which forms
          part of these Terms. In respect of your customers’ personal data that you process through the
          Service, <strong className="text-foreground">you are the data controller and PaySwift acts as your
          data processor</strong> under the Data Protection Act, 2019, processing that data only to provide the
          Service and on your documented instructions. You are responsible for having a lawful basis to
          collect your customers’ data and for providing them with any required notices.
        </p>
      </Section>

      <Section id="ip" title="8. Intellectual property">
        <p>
          PaySwift and its licensors own all rights in the Service, including its software, APIs, design and
          trademarks. We grant you a limited, non-exclusive, non-transferable, revocable right to use the
          Service during your subscription. You retain all rights in your own data and content; you grant us
          the limited right to process it to provide, secure and improve the Service.
        </p>
      </Section>

      <Section id="thirdparty" title="9. Third-party services">
        <p>
          The Service integrates with third parties including Safaricom (M-Pesa/Daraja), authentication,
          hosting, storage and communications providers. Your use of those services may be governed by their
          own terms, and their availability and performance are outside our control. PaySwift is not
          responsible for the acts, omissions, outages or changes of any third party.
        </p>
      </Section>

      <Section id="availability" title="10. Availability, support and changes">
        <p>
          We work to keep the Service available and secure and publish operational status where practicable.
          Except where a specific service-level commitment is stated for your plan, the Service is provided on
          a commercially reasonable-efforts basis and may occasionally be unavailable for maintenance,
          upgrades or reasons beyond our control. We may modify, add or remove features over time.
        </p>
      </Section>

      <Section id="suspension" title="11. Suspension and termination">
        <p>
          You may stop using the Service and close your account at any time. We may suspend or terminate your
          access, in whole or in part, if you breach these Terms, if required by law or by a payment partner,
          or to protect the Service, other users or the public from harm, fraud or a security risk. We will
          give reasonable notice where practicable. On termination, your right to use the Service ends;
          provisions that by their nature should survive (including fees accrued, liability, indemnity,
          governing law and record-retention obligations) will survive.
        </p>
      </Section>

      <Section id="disclaimer" title="12. Disclaimers">
        <p>
          To the maximum extent permitted by law, the Service is provided “as is” and “as available” without
          warranties of any kind, whether express or implied, including implied warranties of merchantability,
          fitness for a particular purpose and non-infringement. We do not warrant that the Service will be
          uninterrupted, error-free or free from harmful components, or that any third-party network
          (including M-Pesa) will always be available. Nothing in these Terms excludes any liability that
          cannot lawfully be excluded.
        </p>
      </Section>

      <Section id="liability" title="13. Limitation of liability">
        <p>
          To the maximum extent permitted by law, PaySwift will not be liable for any indirect, incidental,
          special, consequential or punitive damages, or for any loss of profits, revenue, goodwill or data,
          arising out of or relating to the Service, even if advised of the possibility. Our total aggregate
          liability arising out of or relating to the Service in any twelve-month period will not exceed the
          total subscription fees you paid to PaySwift for the Service in that period. These limits do not
          apply to liability that cannot be limited or excluded under Kenyan law.
        </p>
      </Section>

      <Section id="indemnity" title="14. Indemnification">
        <p>
          You agree to indemnify and hold harmless PaySwift and its officers, employees and agents from and
          against any claims, losses, liabilities and reasonable expenses (including legal fees) arising out
          of your use of the Service, your breach of these Terms, your violation of any law, or a dispute
          between you and your customers or any third party.
        </p>
      </Section>

      <Section id="law" title="15. Governing law and dispute resolution">
        <p>
          These Terms are governed by and construed in accordance with the laws of the Republic of Kenya. The
          parties will first attempt in good faith to resolve any dispute through negotiation. If a dispute is
          not resolved within thirty (30) days, it will be referred to arbitration in Nairobi under the
          Arbitration Act, 1995, before a single arbitrator, with the option of the courts of Kenya for
          interim relief. The courts of Kenya have exclusive jurisdiction over any matter not subject to
          arbitration.
        </p>
      </Section>

      <Section id="changes" title="16. Changes to these Terms">
        <p>
          We may update these Terms from time to time. If we make material changes, we will provide reasonable
          notice (for example, by email or an in-product notice) before they take effect. Your continued use
          of the Service after the effective date constitutes acceptance of the updated Terms.
        </p>
      </Section>

      <Section id="contact" title="17. Contact us">
        <p>
          Questions about these Terms can be sent to{' '}
          <a className="text-primary hover:underline" href="mailto:legal@payswift.co.ke">legal@payswift.co.ke</a>.
          For support, contact{' '}
          <a className="text-primary hover:underline" href="mailto:support@payswift.co.ke">support@payswift.co.ke</a>.
        </p>
      </Section>
    </div>
  );
}
