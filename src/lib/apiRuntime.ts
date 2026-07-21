import axios from "axios";

const rawApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").trim();
const apiBaseUrl = rawApiBaseUrl.replace(/\/+$/, "");

function isRelativeApiPath(value: string) {
  return value === "/api" || value.startsWith("/api/");
}

export function apiUrl(path: string) {
  if (!apiBaseUrl || !isRelativeApiPath(path)) {
    return path;
  }
  return `${apiBaseUrl}${path}`;
}

export function getApiBaseUrl() {
  return apiBaseUrl;
}

export function configureApiRuntime() {
  if (!apiBaseUrl) {
    return;
  }

  axios.defaults.baseURL = apiBaseUrl;

  if (typeof window === "undefined" || (window as any).__repairSyncApiRuntimeConfigured) {
    return;
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === "string" && isRelativeApiPath(input)) {
      return originalFetch(apiUrl(input), init);
    }
    if (input instanceof URL && isRelativeApiPath(input.pathname)) {
      return originalFetch(new URL(apiUrl(input.pathname), apiBaseUrl), init);
    }
    return originalFetch(input, init);
  }) as typeof window.fetch;

  (window as any).__repairSyncApiRuntimeConfigured = true;
}
