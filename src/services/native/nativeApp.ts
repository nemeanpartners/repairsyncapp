export function isNativeWrapperApp() {
  return false;
}

export function openExternalUrl(url: string) {
  if (!url || typeof window === "undefined") {
    return false;
  }

  window.location.href = url;
  return true;
}
