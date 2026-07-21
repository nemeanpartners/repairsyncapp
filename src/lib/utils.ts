import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function formatInvoiceNumber(invNum: string | null | undefined): string {
  if (!invNum) return "";
  return String(invNum).replace(/\D/g, "");
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizePhone(p: string | null | undefined) {
  if (!p) return "";
  let clean = String(p).replace(/[^\d]/g, "");
  if (clean.startsWith("04") && clean.length === 10) {
    clean = "61" + clean.substring(1);
  }
  if (clean.startsWith("4") && clean.length === 9) {
    clean = "61" + clean;
  }
  return clean;
}
