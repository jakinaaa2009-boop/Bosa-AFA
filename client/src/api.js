const raw = (import.meta.env.VITE_API_BASE_URL ?? "").trim();

/** Railway / API origin without trailing slash. Empty in local dev → same-origin + Vite proxy. */
export const API_BASE = raw.replace(/\/$/, "");

export function apiUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${p}` : p;
}
