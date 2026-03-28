const raw = (import.meta.env.VITE_API_BASE_URL ?? "").trim();

/**
 * Railway / API origin without trailing slash.
 * If the env var omits https://, the browser treats the host as a path on Vercel — we fix that here.
 * Empty in local dev → same-origin + Vite proxy.
 */
function normalizeApiBase(value) {
  let base = value.replace(/\/$/, "");
  if (!base) return "";
  if (!/^https?:\/\//i.test(base)) {
    base = `https://${base}`;
  }
  return base;
}

export const API_BASE = normalizeApiBase(raw);

export function apiUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${p}` : p;
}
