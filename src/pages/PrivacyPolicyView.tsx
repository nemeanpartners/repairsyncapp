import React from "react";
import { ArrowLeft } from "lucide-react";

interface PrivacyPolicyViewProps {
  onClose: () => void;
}

export function PrivacyPolicyView({ onClose }: PrivacyPolicyViewProps) {
  return (
    <div className="bg-white min-h-screen text-zinc-950 overflow-y-auto w-full relative">
      <div style={{
        maxWidth: "1000px",
        margin: "0 auto",
        padding: "40px 20px",
        fontFamily: "Arial,Helvetica,sans-serif",
        lineHeight: "1.7",
        color: "#333"
      }}>
        <button
          onClick={onClose}
          className="mb-8 flex items-center gap-2 text-sm font-semibold text-zinc-600 hover:text-zinc-950 transition-colors bg-zinc-100 px-4 py-2 rounded-xl border border-zinc-200 hover:bg-zinc-200 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Go Back to App
        </button>

        <h1 style={{ color: "#1f2937", margin: "0 0 10px 0" }}>RepairSync Privacy Policy</h1>

        <p><strong>Effective Date:</strong> 4 June 2026</p>

        <p>
          RepairSync ("RepairSync", "we", "our", or "us") provides repair business management software that assists repair businesses with customer management, ticket tracking, messaging, invoicing, quoting, inventory management, workflow automation, and related business operations.
        </p>

        <p>
          This Privacy Policy explains how we collect, use, store, and protect information when you use RepairSync.
        </p>

        <h2>1. Information We Collect</h2>

        <p>
          RepairSync collects information that users voluntarily provide when creating and using a RepairSync account.
        </p>

        <h3>Business Information</h3>
        <ul>
          <li>Business name</li>
          <li>Business address</li>
          <li>Business phone number</li>
          <li>Support email address</li>
          <li>Timezone and localisation settings</li>
        </ul>

        <h3>User Account Information</h3>
        <ul>
          <li>Name</li>
          <li>Email address</li>
          <li>User role and permissions</li>
          <li>Authentication and security settings</li>
        </ul>

        <h3>Customer Information Entered by Businesses</h3>
        <ul>
          <li>Customer names</li>
          <li>Phone numbers</li>
          <li>Email addresses</li>
          <li>Addresses (if entered)</li>
          <li>Repair history</li>
          <li>Ticket information</li>
          <li>Device information entered by the business</li>
          <li>Communication records</li>
        </ul>

        <h3>Business Records</h3>
        <ul>
          <li>Tickets and repair jobs</li>
          <li>Messages and message templates</li>
          <li>Quotes</li>
          <li>Invoices</li>
          <li>Inventory records</li>
          <li>Workflow and automation settings</li>
          <li>Internal notes entered by users</li>
        </ul>

        <h2>2. How We Use Information</h2>

        <p>We use information to:</p>

        <ul>
          <li>Provide and maintain the RepairSync platform</li>
          <li>Authenticate users and manage access permissions</li>
          <li>Store customer and repair records</li>
          <li>Manage tickets, repairs, invoices, and quotes</li>
          <li>Send messages initiated by the business</li>
          <li>Provide reporting and workflow functionality</li>
          <li>Support integrations enabled by the business</li>
          <li>Respond to support requests</li>
          <li>Maintain platform security</li>
        </ul>

        <h2>3. Customer Communications</h2>

        <p>
          RepairSync allows businesses to send SMS messages and other communications to their customers.
        </p>

        <p>
          Businesses are responsible for ensuring they have obtained any permissions, consents, or authorisations required by law before sending communications through RepairSync.
        </p>

        <h2>4. Information Sharing</h2>

        <p>
          RepairSync does not sell personal information.
        </p>

        <p>
          Information may be shared with service providers that help us operate the platform, including cloud hosting, authentication, messaging, backup, and infrastructure providers.
        </p>

        <p>
          Where a business enables third-party integrations, information may be shared with those services as required to provide the requested functionality.
        </p>

        <h2>5. Data Security</h2>

        <p>
          We take reasonable steps to protect information stored within RepairSync using industry-standard security measures designed to help prevent unauthorised access, disclosure, alteration, or destruction of data.
        </p>

        <p>
          While we work to protect information, no method of electronic transmission or storage can be guaranteed to be completely secure.
        </p>

        <h2>6. Data Retention</h2>

        <p>
          Information is retained for as long as necessary to provide RepairSync services, comply with legal obligations, resolve disputes, enforce agreements, and maintain business records.
        </p>

        <h2>7. Account Deletion</h2>

        <p>
          Users may request deletion of their RepairSync account and associated data.
        </p>

        <p>
          Where permitted by law, data will be deleted or anonymised. Certain records may be retained where required for legal, security, accounting, taxation, or compliance purposes.
        </p>

        <h2>8. User Rights</h2>

        <p>
          Subject to applicable law, users may request access to, correction of, or deletion of personal information held within RepairSync.
        </p>

        <h2>9. Children's Privacy</h2>

        <p>
          RepairSync is intended for business use and is not directed toward children under the age of 13.
        </p>

        <h2>10. International Data Processing</h2>

        <p>
          RepairSync may store and process information in Australia and other jurisdictions where our service providers operate.
        </p>

        <h2>11. Changes to This Privacy Policy</h2>

        <p>
          We may update this Privacy Policy from time to time. Updated versions will be posted within the application or on our website. Continued use of RepairSync after changes are published constitutes acceptance of the updated policy.
        </p>

        <h2>12. Contact Us</h2>

        <p>
          For privacy-related enquiries, requests, or complaints, please contact:
        </p>

        <p>
          <strong>RepairSync Support</strong><br />
          Email: support@repairsync.com.au
        </p>

        <p style={{ marginTop: "30px", color: "#666", fontSize: "14px" }}>
          By using RepairSync, you acknowledge that you have read and understood this Privacy Policy.
        </p>
      </div>
    </div>
  );
}
