const OFFICIAL_ORIGIN = "https://www.centurioncommander.eu";

export function toAbsoluteContentUrl(url: string, baseUrl: string): string {
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith("data:")) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  const origin = new URL(baseUrl).origin;
  if (trimmed.startsWith("/")) return `${origin}${trimmed}`;
  return new URL(trimmed, baseUrl).href;
}

function absolutizeSrcset(srcset: string, baseUrl: string): string {
  return srcset
    .split(",")
    .map((part) => {
      const bits = part.trim().split(/\s+/);
      const url = bits[0];
      if (!url) return "";
      const absolute = toAbsoluteContentUrl(url, baseUrl);
      return bits.length > 1 ? `${absolute} ${bits.slice(1).join(" ")}` : absolute;
    })
    .filter(Boolean)
    .join(", ");
}

function normalizeImgTag(tag: string, baseUrl: string): string {
  const dataSrc = tag.match(/\bdata-src=["']([^"']+)["']/i)?.[1];
  const dataSrcset = tag.match(/\bdata-srcset=["']([^"']+)["']/i)?.[1];
  let next = tag;

  if (dataSrc) {
    const absolute = toAbsoluteContentUrl(dataSrc, baseUrl);
    if (/\bsrc=["']/i.test(next)) {
      next = next.replace(/\bsrc=["'][^"']*["']/i, `src="${absolute}"`);
    } else {
      next = next.replace(/<img/i, `<img src="${absolute}"`);
    }
  } else {
    next = next.replace(/\bsrc=["']([^"']+)["']/gi, (_match, url: string) => {
      if (url.startsWith("data:")) return `src="${url}"`;
      return `src="${toAbsoluteContentUrl(url, baseUrl)}"`;
    });
  }

  if (dataSrcset) {
    const absoluteSet = absolutizeSrcset(dataSrcset, baseUrl);
    if (/\bsrcset=["']/i.test(next)) {
      next = next.replace(/\bsrcset=["'][^"']*["']/i, `srcset="${absoluteSet}"`);
    } else {
      next = next.replace(/<img\b/i, `<img srcset="${absoluteSet}"`);
    }
  } else {
    next = next.replace(/\bsrcset=["']([^"']+)["']/gi, (_match, value: string) => {
      return `srcset="${absolutizeSrcset(value, baseUrl)}"`;
    });
  }

  return next;
}

/** Fix lazy-loaded WP images and relative asset URLs for embedded rules/banlist HTML. */
export function normalizeContentHtml(html: string, baseUrl = OFFICIAL_ORIGIN): string {
  let result = html;

  // WordPress lazy-load: prefer the <noscript> image when present.
  result = result.replace(
    /<img\b[^>]*\blazyload\b[^>]*>\s*<noscript>\s*(<img[^>]*>)\s*<\/noscript>/gi,
    (_match, noscriptImg: string) => normalizeImgTag(noscriptImg, baseUrl),
  );

  result = result.replace(/<img\b[^>]*>/gi, (tag) => normalizeImgTag(tag, baseUrl));

  return result;
}
