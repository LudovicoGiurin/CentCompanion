const CRAWLER_UA =
  /bot|crawler|spider|facebook|twitter|discord|slack|telegram|whatsapp|linkedin|embed|preview|opengraph|vkshare|pinterest|reddit|tumblr|iframely|meta-external|applebot/i;

export function isCrawlerUserAgent(userAgent: string | null): boolean {
  if (!userAgent) return false;
  return CRAWLER_UA.test(userAgent);
}
