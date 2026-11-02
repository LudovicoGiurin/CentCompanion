import { createHash } from "crypto";
import { normalizeContentHtml } from "../../shared/normalizeContentHtml";

const OFFICIAL_BASE = "https://www.centurioncommander.eu";

/** Official Centurion Commander source pages */
export const OFFICIAL_SOURCES = {
  rules: `${OFFICIAL_BASE}/comprehensive-rules/`,
  banlist: `${OFFICIAL_BASE}/ban-list/`,
} as const;

export function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export async function fetchOfficialPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "CentCompanion/1.0 (sync bot)" },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function stripNoise(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "");
}

function trimTrailingSections(html: string): string {
  return html.split(/<h2[^>]*>\s*related news/i)[0] ?? html;
}

export function extractMainContent(html: string): string {
  const cleaned = stripNoise(html);

  const selectors = [
    /<div[^>]*class="[^"]*\bentry-content\b[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i,
    /<div[^>]*class="[^"]*\bpost-content\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<article[^>]*>([\s\S]*?)<\/article>/i,
  ];

  for (const pattern of selectors) {
    const match = cleaned.match(pattern);
    if (match && match[1].trim().length > 200) {
      return trimTrailingSections(match[1].trim());
    }
  }

  const bodyMatch = cleaned.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return trimTrailingSections(bodyMatch?.[1]?.trim() ?? html);
}

export const DEFAULT_RULES_HTML = `
<h2>Centurion Commander — Comprehensive Rules</h2>
<p>Content syncs from <a href="${OFFICIAL_SOURCES.rules}">centurioncommander.eu/comprehensive-rules</a>.</p>
<p>Run manual sync from the Admin panel or wait for the daily scheduled sync.</p>
`.trim();

export const DEFAULT_BANLIST_HTML = `
<h2>Centurion Commander — Ban List</h2>
<p>Content syncs from <a href="${OFFICIAL_SOURCES.banlist}">centurioncommander.eu/ban-list</a>.</p>
<p>Run manual sync from the Admin panel or wait for the daily scheduled sync.</p>
`.trim();

export type OfficialContentType = "rules" | "banlist";

export async function fetchOfficialContent(type: OfficialContentType): Promise<string> {
  const url = type === "rules" ? OFFICIAL_SOURCES.rules : OFFICIAL_SOURCES.banlist;
  const fallback = type === "rules" ? DEFAULT_RULES_HTML : DEFAULT_BANLIST_HTML;
  const html = await fetchOfficialPage(url);
  const raw = html ? extractMainContent(html) : null;
  const content = raw ? normalizeContentHtml(raw, url) : null;
  return content && content.length > 100 ? content : fallback;
}

