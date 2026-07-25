import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — PaySwift',
  description:
    'How PaySwift collects, uses, shares and protects personal data, in line with Kenya’s Data Protection Act, 2019.',
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

export default function PrivacyPage() {
  return (
    <div className="w-full">
      <p className="text-sm font-medium text-primary">Legal</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">Privacy Policy</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Effective date: {EFFECTIVE_DATE} · Last updated: {EFFECTIVE_DATE}
      </p>

      <div className="mt-8 rounded-xl border border-border bg-muted/30 p-4 text-sm leading-relaxed text-muted-foreground">
        This Privacy Policy explains how PaySwift (“PaySwift”, “we”, “us”, “our”) collects, uses, shares and
        protects personal data when you use the PaySwift platform, dashboard, APIs and related services (the
        “Service”). We are committed to handling personal data in accordance with the{' '}
        <strong className="text-foreground">Data Protection Act, 2019 (No. 24 of 2019)</strong> of Kenya and
        the regulations made under it. This policy should be read together with our{' '}
        <a className="text-primary hover:underline" href="/legal/terms">Terms of Service</a>.
      </div>

      <Section id="roles" title="1. Our role and yours (controller vs processor)">
        <p>
          Under the Data Protection Act, 2019 there are two capacities in which data is handled through the
          Service:
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <strong className="text-foreground">Merchant account data.</strong> For the personal data of the
            business owners and team members who register and use PaySwift, PaySwift is the{' '}
            <strong className="text-foreground">data controller</strong>.
          </li>
          <li>
            <strong className="text-foreground">Your customers’ transaction data.</strong> For the personal
            data of your customers that flows through the Service when they pay you (such as their M-Pesa
            phone number and payment details), <strong className="text-foreground">you are the data
            controller and PaySwift is your data processor</strong>, acting on your instructions to provide
            the Service.
          </li>
        </ul>
        <p>
          PaySwift is registered with, or is undertaking registration with, the Office of the Data Protection
          Commissioner (ODPC) as required by law.
        </p>
      </Section>

      <Section id="collect" title="2. Personal data we collect">
        <p>We collect the following categories of personal data:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li><strong className="text-foreground">Account &amp; identity data:</strong> name, email address, business name, role, and authentication identifiers.</li>
          <li><strong className="text-foreground">KYC / verification data:</strong> documents you upload such as a national ID or passport, business registration certificate and KRA PIN, submitted for manual verification before live access.</li>
          <li><strong className="text-foreground">Billing data:</strong> the M-Pesa number you designate for subscription billing and a billing contact email.</li>
          <li><strong className="text-foreground">Transaction data:</strong> payment amounts, references, statuses, M-Pesa receipt numbers, and your customers’ M-Pesa phone numbers (which we store in masked form in our logs).</li>
          <li><strong className="text-foreground">Technical &amp; usage data:</strong> IP address, device/browser information, log and diagnostic data, and cookies necessary to run the Service.</li>
        </ul>
        <p>
          We do not intentionally collect sensitive personal data beyond the identity documents required for
          KYC, and we ask that you do not submit unnecessary sensitive data through the Service.
        </p>
      </Section>

      <Section id="sources" title="3. How we collect it">
        <p>
          We collect personal data directly from you (for example, when you register, complete onboarding or
          configure the Service); automatically as you use the Service (for example, log and usage data); and
          from third parties who help us deliver the Service (for example, our authentication provider and
          Safaricom’s M-Pesa/Daraja platform, which returns transaction results).
        </p>
      </Section>

      <Section id="basis" title="4. Lawful basis for processing">
        <p>
          Consistent with section 30 of the Data Protection Act, 2019, we process personal data where one or
          more of the following applies: (a) it is necessary to perform our contract with you (providing the
          Service); (b) it is necessary to comply with a legal obligation (for example, KYC, anti-money
          laundering and tax record-keeping); (c) you have given consent; or (d) it is necessary for our
          legitimate interests in operating, securing and improving the Service, where those interests are not
          overridden by your rights.
        </p>
      </Section>

      <Section id="use" title="5. How we use personal data">
        <p>We use personal data to:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>create and administer your account and provide the Service;</li>
          <li>verify your identity and business (KYC) and enable live payments;</li>
          <li>process subscription billing and issue invoices;</li>
          <li>record, reconcile and display your transactions and reporting;</li>
          <li>send service, security and transactional communications;</li>
          <li>secure the Service, prevent fraud and abuse, and meet legal and regulatory obligations;</li>
          <li>maintain and improve the Service.</li>
        </ul>
        <p><strong className="text-foreground">We do not sell your personal data, and we do not sell your customers’ personal data.</strong></p>
      </Section>

      <Section id="sharing" title="6. When we share personal data">
        <p>
          We share personal data only as necessary to run the Service and as permitted by law, including with:
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li><strong className="text-foreground">Safaricom PLC</strong> — to initiate and settle M-Pesa payments and retrieve their results.</li>
          <li><strong className="text-foreground">Service providers (data processors)</strong> — authentication, cloud hosting and database, document storage, caching, email delivery and error-monitoring providers that process data on our behalf under contract and only on our instructions.</li>
          <li><strong className="text-foreground">Regulators, courts and law enforcement</strong> — where we are required by law or to protect our rights, users or the public.</li>
          <li><strong className="text-foreground">A successor</strong> — in connection with a merger, acquisition or reorganisation, subject to this policy.</li>
        </ul>
      </Section>

      <Section id="transfers" title="7. Cross-border transfers">
        <p>
          Some of our service providers process data on servers located outside Kenya. Where personal data is
          transferred outside Kenya, we take steps required by sections 48 and 49 of the Data Protection Act,
          2019 to ensure an appropriate level of protection — for example, appropriate contractual safeguards
          with the processor, or reliance on another lawful basis for the transfer.
        </p>
      </Section>

      <Section id="retention" title="8. How long we keep personal data">
        <p>
          We keep personal data only for as long as necessary for the purposes described in this policy. Some
          data — in particular financial and transaction records — must be retained for longer to meet legal
          obligations under Kenyan tax and anti-money-laundering law (which generally require records to be
          kept for at least seven years). Because of these obligations, a request to delete your data cannot
          override our duty to retain certain financial records; where this applies, we restrict processing of
          that data to what the law requires and delete the rest.
        </p>
      </Section>

      <Section id="security" title="9. How we protect personal data">
        <p>
          We use appropriate technical and organisational measures to protect personal data, including:
          encryption of sensitive secrets at rest using AES-256-GCM; hashing of API keys; encryption in
          transit (HTTPS); database row-level security and tenant isolation so one business cannot access
          another’s data; role-based access controls; audit logging of sensitive actions; and masking of
          customer phone numbers in our logs. No method of transmission or storage is completely secure, but we
          work to protect your data and to continually improve our safeguards.
        </p>
      </Section>

      <Section id="rights" title="10. Your rights as a data subject">
        <p>
          Subject to the Data Protection Act, 2019, you have the right to: be informed of how your data is
          used; access your personal data; request correction of inaccurate data; request deletion or erasure
          (subject to our legal retention duties above); object to or request restriction of certain
          processing; and request portability of data you provided to us.
        </p>
        <p>
          You can exercise several of these rights directly from your dashboard — for example, exporting your
          organisation’s data, or submitting an account-deletion request for review. You can also contact us
          at{' '}
          <a className="text-primary hover:underline" href="mailto:privacy@payswift.co.ke">privacy@payswift.co.ke</a>.
          If you are one of a merchant’s customers, please direct requests about your data to that merchant,
          who is the controller of it; we will assist them as their processor.
        </p>
        <p>
          You also have the right to lodge a complaint with the{' '}
          <strong className="text-foreground">Office of the Data Protection Commissioner (ODPC)</strong> at{' '}
          <a className="text-primary hover:underline" href="https://www.odpc.go.ke" target="_blank" rel="noopener noreferrer">www.odpc.go.ke</a>{' '}
          if you believe your data has been handled unlawfully.
        </p>
      </Section>

      <Section id="cookies" title="11. Cookies">
        <p>
          We use cookies and similar technologies that are necessary to operate the Service — for example, to
          keep you signed in and to remember your preferences (such as your sandbox/live view). We do not use
          the Service to serve third-party advertising.
        </p>
      </Section>

      <Section id="children" title="12. Children">
        <p>
          The Service is intended for businesses and is not directed to children under 18. We do not knowingly
          collect personal data from children. If you believe a child has provided us personal data, contact
          us and we will take appropriate steps to delete it.
        </p>
      </Section>

      <Section id="breach" title="13. Data breach notification">
        <p>
          If a personal-data breach occurs that is likely to result in a risk to the rights and freedoms of
          data subjects, we will notify the Office of the Data Protection Commissioner within seventy-two (72)
          hours of becoming aware of it, as required by the Data Protection Act, 2019, and will notify affected
          data subjects (or the relevant controller, where PaySwift acts as processor) without undue delay
          where the law requires.
        </p>
      </Section>

      <Section id="changes" title="14. Changes to this policy">
        <p>
          We may update this Privacy Policy from time to time. If we make material changes, we will provide
          reasonable notice before they take effect. The “Last updated” date above indicates when this policy
          was last revised.
        </p>
      </Section>

      <Section id="contact" title="15. Contact us">
        <p>
          For any privacy question or to exercise your rights, contact our privacy team at{' '}
          <a className="text-primary hover:underline" href="mailto:privacy@payswift.co.ke">privacy@payswift.co.ke</a>.
        </p>
      </Section>
    </div>
  );
}
