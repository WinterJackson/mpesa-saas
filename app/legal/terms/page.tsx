import React from 'react';

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      {/* <!-- TODO(LEGAL): MUST BE REVIEWED BY COUNSEL BEFORE PRODUCTION LAUNCH --> */}
      <h1 className="text-3xl font-extrabold text-gray-900 mb-6">Terms of Service</h1>
      <p className="text-gray-500 mb-4">Last updated: [DATE]</p>
      <div className="prose prose-sm sm:prose lg:prose-lg text-gray-700">
        <p>
          Welcome to PaySwift. By accessing or using our services, you agree to be bound by these Terms of Service.
          Please read them carefully.
        </p>
        <h2>1. Service Description</h2>
        <p>
          PaySwift provides a payment processing integration service connecting merchants with the M-Pesa platform.
        </p>
        <h2>2. Merchant Obligations</h2>
        <p>
          You agree to provide accurate information and comply with all applicable local laws and Safaricom&apos;s Daraja API terms of use.
        </p>
        <h2>3. Limitation of Liability</h2>
        <p>
          PaySwift is provided &quot;as is&quot; without warranties of any kind. We are not liable for any lost revenue or damages resulting from service interruptions or third-party API failures.
        </p>
        {/* Add more legal sections here */}
      </div>
    </div>
  );
}
