import satori, { init as initSatori } from "satori/standalone";
import yogaWasm from "satori/yoga.wasm";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import resvgWasm from "@resvg/resvg-wasm/index_bg.wasm";
import { getPressStartFont } from "../assets/press-start-2p-font";
import { getLogoDataUrl } from "../assets/logo-image";
import type { PublicEventShare } from "./events-public";
import { eventStatusLabel, eventTypeShareLabel, formatEventShareDate } from "./events-public";
import { truncate } from "./og-html";

let satoriReady: Promise<void> | null = null;
let resvgReady: Promise<void> | null = null;

async function ensureSatori() {
  if (!satoriReady) {
    satoriReady = initSatori(yogaWasm as WebAssembly.Module);
  }
  await satoriReady;
}

async function ensureResvg() {
  if (!resvgReady) {
    resvgReady = initWasm(resvgWasm);
  }
  await resvgReady;
}

const COLORS = {
  cream: "#f4e9c8",
  gold: "#ffc832",
  red: "#c0392b",
  muted: "#b7a778",
};

function statusStyle(status: string): { border: string; background: string; color: string } {
  switch (status) {
    case "ongoing":
      return { border: "#f0a232", background: "rgba(240,162,50,0.18)", color: "#ffcf7a" };
    case "completed":
      return { border: "#d8d8d8", background: "rgba(216,216,216,0.14)", color: "#e6e6e6" };
    default:
      return { border: "#c0392b", background: "rgba(192,57,43,0.18)", color: "#f0a08f" };
  }
}

function typeStyle(eventType: PublicEventShare["eventType"]): { border: string; background: string; color: string } {
  switch (eventType) {
    case "lv2":
      return { border: "#cf2b2b", background: "rgba(207,43,43,0.22)", color: "#ff8a8a" };
    case "lv1":
      return { border: "#7a3dd3", background: "rgba(122,61,211,0.22)", color: "#d4b4ff" };
    case "local_league":
      return { border: "#1f6fd8", background: "rgba(31,111,216,0.22)", color: "#8ec5ff" };
    default:
      return { border: "#2fa84f", background: "rgba(47,168,79,0.22)", color: "#9ef0b0" };
  }
}

function pill(label: string, accent: string) {
  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        alignItems: "center",
        fontSize: 16,
        padding: "12px 16px",
        border: `2px solid ${accent}`,
        backgroundColor: "rgba(255,255,255,0.05)",
        color: COLORS.cream,
      },
      children: label,
    },
  };
}

function infoBlock(label: string, value: string) {
  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      },
      children: [
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              fontSize: 14,
              color: COLORS.muted,
              letterSpacing: "2px",
            },
            children: label,
          },
        },
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              fontSize: 28,
              lineHeight: 1.35,
              color: COLORS.cream,
            },
            children: value,
          },
        },
      ],
    },
  };
}

function satoriTree(event: PublicEventShare, logoSrc: string) {
  const title = truncate(event.title, 48);
  const when = formatEventShareDate(event.startsAt);
  const where = truncate(
    [event.storeName, event.location, event.city].filter(Boolean).join(" · "),
    72,
  );
  const players = event.maxPlayers
    ? `${event.registrationCount} / ${event.maxPlayers} PLAYERS`
    : `${event.registrationCount} REGISTERED`;
  const format = (event.format ?? "Swiss").toUpperCase();
  const status = eventStatusLabel(event.status).toUpperCase();
  const typeLabel = eventTypeShareLabel(event);
  const badge = statusStyle(event.status);
  const typeBadge = typeStyle(event.eventType);
  const titleSize = title.length > 28 ? 26 : 32;

  const bottomChildren: unknown[] = [
    pill(players, COLORS.red),
    pill(format, COLORS.gold),
  ];
  if (event.joinCode) {
    bottomChildren.push(pill(`CODE ${event.joinCode}`, "rgba(244,233,200,0.5)"));
  }

  return {
    type: "div",
    props: {
      style: {
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: "36px 40px",
        backgroundColor: "#100b0a",
        backgroundImage: "linear-gradient(135deg, #241310 0%, #1a0c0a 55%, #090909 100%)",
        color: COLORS.cream,
        fontFamily: "Press Start 2P",
        overflow: "hidden",
      },
      children: [
        {
          type: "div",
          props: {
            style: {
              position: "absolute",
              top: "-140px",
              right: "-90px",
              width: "540px",
              height: "540px",
              borderRadius: "9999px",
              backgroundImage:
                "radial-gradient(circle, rgba(192,57,43,0.38) 0%, rgba(192,57,43,0) 70%)",
            },
          },
        },
        {
          type: "div",
          props: {
            style: {
              position: "absolute",
              bottom: "-180px",
              left: "-120px",
              width: "500px",
              height: "500px",
              borderRadius: "9999px",
              backgroundImage:
                "radial-gradient(circle, rgba(255,200,50,0.28) 0%, rgba(255,200,50,0) 70%)",
            },
          },
        },
        {
          type: "div",
          props: {
            style: {
              position: "relative",
              display: "flex",
              alignItems: "center",
              gap: "20px",
              marginBottom: "18px",
              padding: "24px 26px",
              minHeight: "104px",
              border: `4px solid ${typeBadge.border}`,
              backgroundColor: typeBadge.background,
              color: typeBadge.color,
              fontSize: typeLabel.length > 24 ? 22 : 30,
              lineHeight: 1.25,
              letterSpacing: "1px",
            },
            children: [
              {
                type: "img",
                props: {
                  src: logoSrc,
                  width: 56,
                  height: 56,
                  style: {
                    width: "56px",
                    height: "56px",
                    objectFit: "contain",
                    flexShrink: 0,
                  },
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    flex: 1,
                    minWidth: 0,
                  },
                  children: typeLabel,
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    flexShrink: 0,
                    fontSize: 15,
                    padding: "10px 14px",
                    border: `3px solid ${badge.border}`,
                    backgroundColor: badge.background,
                    color: badge.color,
                    letterSpacing: "1px",
                  },
                  children: status,
                },
              },
            ],
          },
        },
        {
          type: "div",
          props: {
            style: {
              position: "relative",
              display: "flex",
              flexDirection: "column",
              flexGrow: 1,
              padding: "28px 30px",
              border: "2px solid rgba(255,255,255,0.14)",
              backgroundColor: "rgba(8,10,6,0.62)",
            },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    fontSize: titleSize,
                    lineHeight: 1.25,
                    marginBottom: "8px",
                    maxHeight: "120px",
                    overflow: "hidden",
                  },
                  children: title,
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    flexDirection: "column",
                    gap: "22px",
                    marginTop: "12px",
                  },
                  children: [
                    infoBlock("WHEN", when),
                    infoBlock("WHERE", where),
                  ],
                },
              },
            ],
          },
        },
        {
          type: "div",
          props: {
            style: {
              position: "relative",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              flexWrap: "wrap",
              marginTop: "18px",
            },
            children: bottomChildren,
          },
        },
      ],
    },
  };
}

export async function renderEventOgPng(event: PublicEventShare): Promise<Uint8Array> {
  await ensureSatori();
  await ensureResvg();
  const fontData = getPressStartFont();

  const svg = await satori(satoriTree(event, getLogoDataUrl()) as Parameters<typeof satori>[0], {
    width: 1200,
    height: 630,
    fonts: [
      {
        name: "Press Start 2P",
        data: fontData,
        weight: 400,
        style: "normal",
      },
    ],
  });

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: 1200 },
  });
  return resvg.render().asPng();
}
