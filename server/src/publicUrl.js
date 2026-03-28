/** When PUBLIC_URL is set (e.g. https://your-app.up.railway.app), asset URLs in JSON are absolute for split frontend hosting. */
export function publicAssetUrl(relativePath) {
  const rel = relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
  const base = (process.env.PUBLIC_URL ?? "").trim().replace(/\/$/, "");
  return base ? `${base}${rel}` : rel;
}
