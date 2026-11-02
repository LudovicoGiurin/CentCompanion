import type { PublicEventShare } from "./events-public";
import { eventShareDescription } from "./events-public";
import { eventShareImageVersion } from "./events-public";

export type OgHtmlInput = {
  event: PublicEventShare;
  origin: string;
  pageUrl: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildEventOgHtml({ event, origin, pageUrl }: OgHtmlInput): string {
  const title = escapeHtml(event.title);
  const description = escapeHtml(eventShareDescription(event));
  const imageUrl = `${origin}/api/events/${event.id}/og.png?v=${encodeURIComponent(eventShareImageVersion(event))}`;
  const canonical = escapeHtml(pageUrl);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} — Cent Companion</title>
  <meta name="description" content="${description}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Cent Companion" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:image:url" content="${imageUrl}" />
  <meta property="og:image:secure_url" content="${imageUrl}" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${title}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${imageUrl}" />
  <link rel="canonical" href="${canonical}" />
</head>
<body>
  <p><a href="${canonical}">${title}</a> — ${description}</p>
</body>
</html>`;
}

export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}
