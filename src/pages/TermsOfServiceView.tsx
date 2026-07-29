import React from "react";
import { ArrowLeft } from "lucide-react";

interface TermsOfServiceViewProps {
  onClose: () => void;
}

export function TermsOfServiceView({ onClose }: TermsOfServiceViewProps) {
  return (
    <div className="bg-white min-h-screen text-zinc-950 overflow-y-auto w-full relative">
      <div
        style={{
          maxWidth: "1000px",
          margin: "0 auto",
          padding: "40px 20px",
          fontFamily: "Arial,Helvetica,sans-serif",
          lineHeight: "1.7",
          color: "#333",
        }}
      >
        <button
          onClick={onClose}
          className="mb-8 flex items-center gap-2 text-sm font-semibold text-zinc-600 hover:text-zinc-950 transition-colors bg-zinc-100 px-4 py-2 rounded-xl border border-zinc-200 hover:bg-zinc-200 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Go Back to App
        </button>

        <h1 style={{ color: "#1f2937", margin: "0 0 10px 0" }}>RepairSync Terms of Service</h1>
        <p><strong>Effective Date:</strong> 4 June 2026</p>

        <p>
          These Terms of Service govern access to and use of RepairSync, a repair business management platform for customer management, ticket tracking, messaging, invoicing, quoting, inventory management, workflow automation, and related business operations.
        </p>

        <h2>1. Use of RepairSync</h2>
        <p>
          You may use RepairSync only for lawful business purposes and in accordance with these terms. You are responsible for the accuracy of information entered into the platform and for maintaining appropriate access controls for your organisation.
        </p>

        <h2>2. Accounts and Security</h2>
        <p>
          You are responsible for protecting account credentials and for all activity under your account. Notify us promptly if you believe an account has been accessed without authorisation.
        </p>

        <h2>3. Customer and Business Data</h2>
        <p>
          You retain ownership of business and customer data entered into RepairSync. We process that data to provide, secure, maintain, and improve the service.
        </p>

        <h2>4. Subscriptions and Billing</h2>
        <p>
          Paid features may require an active subscription. Subscription terms, pricing, billing intervals, renewals, and cancellation options are presented at purchase or in account settings.
        </p>

        <h2>5. Acceptable Use</h2>
        <p>
          You must not misuse RepairSync, interfere with service operation, attempt unauthorised access, upload malicious content, or use the platform to send unlawful, abusive, or deceptive communications.
        </p>

        <h2>6. Service Availability</h2>
        <p>
          We aim to provide a reliable service, but availability can be affected by maintenance, third-party services, network conditions, or events outside our control.
        </p>

        <h2>7. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, RepairSync is provided without warranties that it will be uninterrupted or error-free. We are not liable for indirect, incidental, special, consequential, or punitive damages.
        </p>

        <h2>8. Changes to These Terms</h2>
        <p>
          We may update these terms from time to time. Updated terms will be posted within the application or on our website. Continued use of RepairSync after changes are published constitutes acceptance of the updated terms.
        </p>

        <h2>9. Contact</h2>
        <p>
          For questions about these terms, contact the RepairSync operator or support contact provided in the application.
        </p>
      </div>
    </div>
  );
}
