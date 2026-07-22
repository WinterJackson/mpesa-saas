import React from 'react';

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      {/* <!-- TODO(LEGAL): MUST BE REVIEWED BY COUNSEL BEFORE PRODUCTION LAUNCH --> */}
      <h1 className="text-3xl font-extrabold text-foreground mb-6">Privacy Policy</h1>
      <p className="text-muted-foreground mb-4">Last updated: [DATE]</p>
      <div className="prose prose-sm sm:prose lg:prose-lg dark:prose-invert text-foreground">
        <p>
          PaySwift respects your privacy. This Privacy Policy outlines how we collect, use, and protect your information.
        </p>
        <h2>1. Information We Collect</h2>
        <p>
          We collect merchant onboarding information, Shopify access tokens, and transaction data including masked customer phone numbers.
        </p>
        <h2>2. How We Use Information</h2>
        <p>
          We use your information exclusively to provide and improve the PaySwift service. We do not sell your data to third parties.
        </p>
        <h2>3. Data Security</h2>
        <p>
          We employ industry-standard security measures, including AES-256-GCM encryption for sensitive secrets, to protect your data.
        </p>
        {/* Add more legal sections here */}
      </div>
    </div>
  );
}
