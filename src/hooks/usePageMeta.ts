import { useEffect } from "react";
import i18n from "../i18n";

type PageMeta = {
  title?: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogUrl?: string;
  ogImage?: string;
};

function defaults() {
  return {
    title: i18n.t("common:meta.defaultTitle"),
    description: i18n.t("common:meta.defaultDescription"),
    siteName: i18n.t("common:brand.name"),
  };
}

function setMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function removeMeta(attr: "name" | "property", key: string) {
  document.querySelector(`meta[${attr}="${key}"]`)?.remove();
}

export function usePageMeta(meta: PageMeta) {
  useEffect(() => {
    const apply = () => {
      const d = defaults();
      const prevTitle = document.title;
      document.title = meta.title ?? d.title;
      setMeta("name", "description", meta.description ?? d.description);
      setMeta("property", "og:title", meta.ogTitle ?? meta.title ?? d.title);
      setMeta(
        "property",
        "og:description",
        meta.ogDescription ?? meta.description ?? d.description,
      );
      setMeta("property", "og:type", "website");
      setMeta("property", "og:site_name", d.siteName);
      if (meta.ogUrl) setMeta("property", "og:url", meta.ogUrl);
      if (meta.ogImage) {
        setMeta("property", "og:image", meta.ogImage);
        setMeta("property", "og:image:width", "1200");
        setMeta("property", "og:image:height", "630");
        setMeta("name", "twitter:card", "summary_large_image");
        setMeta("name", "twitter:image", meta.ogImage);
      } else {
        removeMeta("property", "og:image");
        removeMeta("property", "og:image:width");
        removeMeta("property", "og:image:height");
        removeMeta("name", "twitter:card");
        removeMeta("name", "twitter:image");
      }
      return prevTitle;
    };

    const prevTitle = apply();
    const onLang = () => {
      apply();
    };
    i18n.on("languageChanged", onLang);

    return () => {
      i18n.off("languageChanged", onLang);
      const d = defaults();
      document.title = prevTitle;
      setMeta("name", "description", d.description);
      setMeta("property", "og:title", d.title);
      setMeta("property", "og:description", d.description);
      removeMeta("property", "og:image");
      removeMeta("property", "og:image:width");
      removeMeta("property", "og:image:height");
      removeMeta("name", "twitter:card");
      removeMeta("name", "twitter:image");
    };
  }, [meta.title, meta.description, meta.ogTitle, meta.ogDescription, meta.ogUrl, meta.ogImage]);
}
