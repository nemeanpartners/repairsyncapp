import { ArrowLeft } from "lucide-react";

interface PrivacyPolicyViewProps {
  onClose: () => void;
  closeLabel?: string;
}

const sectionClass = "rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm";
const headingClass = "text-lg font-black text-zinc-950";
const paragraphClass = "mt-3 text-sm leading-7 text-zinc-700";
const listClass = "mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-zinc-700";

export function PrivacyPolicyView({ onClose, closeLabel = "Go Back to App" }: PrivacyPolicyViewProps) {
  return (
    <div className="min-h-screen w-full bg-zinc-50 text-zinc-950">
      <div className="mx-auto max-w-3xl px-5 py-6 sm:px-8 sm:py-10">
        <button
          type="button"
          onClick={onClose}
          className="mb-6 inline-flex min-h-10 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-bold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-100 hover:text-zinc-950"
        >
          <ArrowLeft className="h-4 w-4" />
          {closeLabel}
        </button>

        <header className="mb-6 rounded-3xl bg-zinc-950 p-6 text-white shadow-xl shadow-zinc-200">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-300">
            RepairSync Legal
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight">
            Privacy Policy
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-300">
            Effective date: 4 June 2026. RepairSync is a repair business
            management app operated for repair shops, technicians, and business
            teams.
          </p>
        </header>

        <div className="space-y-4">
          <section className={sectionClass}>
            <h2 className={headingClass}>Who We Are</h2>
            <p className={paragraphClass}>
              RepairSync provides repair business management software for
              customer management, repair tickets, messaging, invoicing,
              quoting, inventory management, technician workflows, automation,
              and related repair shop operations.
            </p>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-xl bg-zinc-50 p-3">
                <dt className="font-bold text-zinc-500">App name</dt>
                <dd className="mt-1 font-semibold text-zinc-950">RepairSync</dd>
              </div>
              <div className="rounded-xl bg-zinc-50 p-3">
                <dt className="font-bold text-zinc-500">Website</dt>
                <dd className="mt-1 font-semibold text-zinc-950">
                  repairsync.qld.one
                </dd>
              </div>
              <div className="rounded-xl bg-zinc-50 p-3 sm:col-span-2">
                <dt className="font-bold text-zinc-500">Support contact</dt>
                <dd className="mt-1 font-semibold text-zinc-950">
                  nemeanpartnersptyltd@gmail.com
                </dd>
              </div>
            </dl>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Information We Collect</h2>
            <p className={paragraphClass}>
              We collect information needed to create accounts, run repair
              workflows, and provide business tools inside RepairSync.
            </p>
            <ul className={listClass}>
              <li>Business name, address, phone number, support email, and settings.</li>
              <li>User name, email address, role, permissions, and security settings.</li>
              <li>Customer details entered by the business, including names, phone numbers, email addresses, repair history, device details, tickets, and communication records.</li>
              <li>Repair shop records such as tickets, quotes, invoices, inventory records, notes, workflow settings, and automation settings.</li>
            </ul>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>How We Use Information</h2>
            <ul className={listClass}>
              <li>Provide, maintain, and secure the RepairSync platform.</li>
              <li>Authenticate users and manage account access.</li>
              <li>Store and display customer, ticket, quote, invoice, and inventory records.</li>
              <li>Send customer communications initiated by the repair business.</li>
              <li>Provide reporting, automation, workflow, and integration features.</li>
              <li>Respond to support requests and troubleshoot platform issues.</li>
            </ul>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Customer Communications</h2>
            <p className={paragraphClass}>
              RepairSync can help businesses send SMS messages and other
              customer communications. The repair business is responsible for
              ensuring it has the permissions and consents required by law
              before sending messages to customers.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Sharing and Service Providers</h2>
            <p className={paragraphClass}>
              RepairSync does not sell personal information. Information may be
              shared with providers that help operate the app, including cloud
              hosting, authentication, messaging, backups, payments,
              infrastructure, and integrations enabled by the business.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Security and Retention</h2>
            <p className={paragraphClass}>
              We use reasonable technical and organisational safeguards to
              protect information. No electronic system can be guaranteed to be
              completely secure. We retain information as needed to provide the
              service, comply with legal obligations, resolve disputes, enforce
              agreements, and maintain business records.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Access, Correction, and Deletion</h2>
            <p className={paragraphClass}>
              Users may request access to, correction of, or deletion of
              personal information held in RepairSync, subject to applicable law.
              Some records may be retained where required for legal, accounting,
              taxation, security, or compliance reasons.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Children and International Processing</h2>
            <p className={paragraphClass}>
              RepairSync is intended for business use and is not directed to
              children under 13. Information may be stored and processed in
              Australia and other jurisdictions where our service providers
              operate.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Contact</h2>
            <p className={paragraphClass}>
              For privacy enquiries, access requests, correction requests,
              deletion requests, or complaints, contact RepairSync support at
              <span className="font-semibold text-zinc-950"> nemeanpartnersptyltd@gmail.com</span>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
