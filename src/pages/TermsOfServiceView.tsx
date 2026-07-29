import { ArrowLeft } from "lucide-react";

interface TermsOfServiceViewProps {
  onClose: () => void;
  closeLabel?: string;
}

const sectionClass = "rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm";
const headingClass = "text-lg font-black text-zinc-950";
const paragraphClass = "mt-3 text-sm leading-7 text-zinc-700";
const listClass = "mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-zinc-700";

export function TermsOfServiceView({ onClose, closeLabel = "Go Back to App" }: TermsOfServiceViewProps) {
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
            Terms of Service
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-300">
            Effective date: 4 June 2026. These terms govern access to and use
            of RepairSync.
          </p>
        </header>

        <div className="space-y-4">
          <section className={sectionClass}>
            <h2 className={headingClass}>1. Use of RepairSync</h2>
            <p className={paragraphClass}>
              RepairSync is a repair business management app for customer
              management, ticket tracking, messaging, invoicing, quoting,
              inventory management, workflow automation, and related repair shop
              operations. You may use RepairSync only for lawful business
              purposes.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>2. Accounts and Security</h2>
            <p className={paragraphClass}>
              You are responsible for protecting account credentials and for all
              activity under your account. You must maintain accurate account
              information and appropriate access controls for your organisation.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>3. Customer and Business Data</h2>
            <p className={paragraphClass}>
              You retain ownership of business and customer data entered into
              RepairSync. We process that data to provide, secure, maintain, and
              improve the service.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>4. Subscriptions and Billing</h2>
            <p className={paragraphClass}>
              Paid features may require an active subscription. Subscription
              terms, pricing, billing intervals, renewals, cancellation options,
              and any Apple in-app purchase or Stripe checkout details are
              presented at purchase or in account settings.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>5. Acceptable Use</h2>
            <ul className={listClass}>
              <li>Do not misuse RepairSync or interfere with service operation.</li>
              <li>Do not attempt unauthorised access to accounts, systems, or data.</li>
              <li>Do not upload malicious content or use RepairSync for unlawful activity.</li>
              <li>Do not send unlawful, abusive, deceptive, or unauthorised communications.</li>
            </ul>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>6. Availability and Changes</h2>
            <p className={paragraphClass}>
              We aim to provide a reliable service, but availability can be
              affected by maintenance, third-party services, network conditions,
              or events outside our control. We may update RepairSync and these
              terms from time to time.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>7. Limitation of Liability</h2>
            <p className={paragraphClass}>
              To the maximum extent permitted by law, RepairSync is provided
              without warranties that it will be uninterrupted or error-free. We
              are not liable for indirect, incidental, special, consequential,
              or punitive damages.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>8. Contact</h2>
            <p className={paragraphClass}>
              For questions about these terms, contact RepairSync support at
              <span className="font-semibold text-zinc-950"> repairs.phonemedic.au@gmail.com</span>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
