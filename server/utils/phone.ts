export function normalizePhone(p: string) {
  if (!p) return "";
  let clean = p.replace(/[^\d]/g, "");
  // Fix for common mistyped +6104...
  if (clean.startsWith("6104") && clean.length >= 11) {
    clean = "61" + clean.substring(2);
  }
  if (clean.startsWith("04") && clean.length === 10) {
    clean = "61" + clean.substring(1);
  }
  if (clean.startsWith("4") && clean.length === 9) {
    clean = "61" + clean;
  }
  return clean;
}
