const PROFILE_PATH = "/profile";

/** Old bookmarks / OAuth return URLs still use /dashboard */
function migrateLegacyPath(path: string): string {
  if (path === "/dashboard") return PROFILE_PATH;
  if (path.startsWith("/dashboard?")) return PROFILE_PATH + path.slice("/dashboard".length);
  return path;
}

export function authReturnUrl(path: string): string {
  const safe = path.startsWith("/") && !path.startsWith("//") ? migrateLegacyPath(path) : PROFILE_PATH;
  return `/login?return=${encodeURIComponent(safe)}`;
}

export function registerReturnUrl(path: string): string {
  const safe = path.startsWith("/") && !path.startsWith("//") ? migrateLegacyPath(path) : PROFILE_PATH;
  return `/register?return=${encodeURIComponent(safe)}`;
}

export function resolveReturnPath(raw: string | null, fallback = PROFILE_PATH): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return fallback;
  return migrateLegacyPath(raw);
}
