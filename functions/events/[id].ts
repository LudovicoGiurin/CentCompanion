/// <reference types="@cloudflare/workers-types" />

import { setEnv, type Env } from "../../worker/runtime";
import { isCrawlerUserAgent } from "../../worker/_shared/crawler";
import { appOrigin, getPublicEventShare } from "../../worker/_shared/events-public";
import { buildEventOgHtml } from "../../worker/_shared/og-html";

type PagesEnv = Env & {
  ASSETS: { fetch: typeof fetch };
};

export const onRequest: PagesFunction<PagesEnv> = async (context) => {
  const eventId = Number(context.params.id);
  if (!eventId) {
    return context.env.ASSETS.fetch(new URL("/index.html", context.request.url));
  }

  const ua = context.request.headers.get("user-agent");
  if (!isCrawlerUserAgent(ua)) {
    return context.env.ASSETS.fetch(new URL("/index.html", context.request.url));
  }

  setEnv(context.env);

  try {
    const event = await getPublicEventShare(eventId);
    if (!event) {
      return context.env.ASSETS.fetch(new URL("/index.html", context.request.url));
    }

    const pageUrl = new URL(context.request.url);
    pageUrl.hash = "";

    const html = buildEventOgHtml({
      event,
      origin: appOrigin(context.env.APP_URL, context.request.url),
      pageUrl: pageUrl.toString(),
    });

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
      },
    });
  } catch (err) {
    console.error("Event share HTML failed", err);
    return context.env.ASSETS.fetch(new URL("/index.html", context.request.url));
  }
};
