import { ArrowLeft, Mail } from "lucide-react";

interface SupportContactViewProps {
  onClose: () => void;
  closeLabel?: string;
}

const SUPPORT_EMAIL = "nemeanpartnersptyltd@gmail.com";

export function SupportContactView({ onClose, closeLabel = "Go Back to App" }: SupportContactViewProps) {
  const mailto =
    `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("RepairSync support request")}` +
    `&body=${encodeURIComponent("Hi RepairSync Support,\n\nI need help with:\n\n")}`;

  return (
    <div className="min-h-screen w-full bg-zinc-50 text-zinc-950">
      <div className="mx-auto max-w-2xl px-5 py-6 sm:px-8 sm:py-10">
        <button
          type="button"
          onClick={onClose}
          className="mb-6 inline-flex min-h-10 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-bold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-100 hover:text-zinc-950"
        >
          <ArrowLeft className="h-4 w-4" />
          {closeLabel}
        </button>

        <main className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-600">
            RepairSync Support
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-zinc-950">
            Contact Us
          </h1>
          <p className="mt-4 text-sm leading-7 text-zinc-700">
            For RepairSync support, account help, billing questions, privacy
            enquiries, or App Store review contact, email Nemean Partners Pty
            Ltd at the address below.
          </p>

          <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
              Support Email
            </p>
            <a
              href={mailto}
              className="mt-2 inline-flex break-all text-lg font-black text-zinc-950 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-950"
            >
              {SUPPORT_EMAIL}
            </a>
          </div>

          <a
            href={mailto}
            className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-black text-white shadow-sm transition-colors hover:bg-zinc-800 sm:w-auto"
          >
            <Mail className="h-4 w-4" />
            Email RepairSync Support
          </a>
        </main>
      </div>
    </div>
  );
}
