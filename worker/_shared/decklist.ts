export type DeckCard = { name: string; qty: number };
export type DecklistSnapshot = {
  main: DeckCard[];
  commanders: DeckCard[];
  hash?: string;
};

function parseQtyLine(line: string): DeckCard | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("#")) return null;
  const m = trimmed.match(/^(\d+)x?\s+(.+)$/i);
  if (!m) return { name: trimmed, qty: 1 };
  return { name: m[2].trim(), qty: Number(m[1]) };
}

export function parsePastedDecklist(paste: string): DecklistSnapshot {
  const lines = paste.split(/\r?\n/);
  const commanders: DeckCard[] = [];
  const main: DeckCard[] = [];
  let section: "main" | "commanders" = "main";

  for (const line of lines) {
    const lower = line.trim().toLowerCase();
    if (lower.startsWith("commander") || lower.startsWith("commanders")) {
      section = "commanders";
      continue;
    }
    if (lower.startsWith("deck") || lower.startsWith("main")) {
      section = "main";
      continue;
    }
    const card = parseQtyLine(line);
    if (!card) continue;
    if (section === "commanders") commanders.push(card);
    else main.push(card);
  }

  // Centurion: first 1–2 singleton cards often are commanders if no section
  if (!commanders.length && main.length >= 1) {
    const maybe = main.slice(0, Math.min(2, main.length));
    if (maybe.every((c) => c.qty === 1)) {
      commanders.push(...maybe);
    }
  }

  return { main, commanders };
}

export async function hashDecklist(deck: DecklistSnapshot): Promise<string> {
  const payload = JSON.stringify({
    commanders: deck.commanders.map((c) => `${c.qty} ${c.name}`).sort(),
    main: deck.main.map((c) => `${c.qty} ${c.name}`).sort(),
  });
  const data = new TextEncoder().encode(payload);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Best-effort public Moxfield fetch. Returns null if unavailable. */
export async function fetchMoxfieldDecklist(
  url: string,
): Promise<{ name: string | null; decklist: DecklistSnapshot } | null> {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("moxfield.com")) return null;
    const parts = parsed.pathname.split("/").filter(Boolean);
    const decksIdx = parts.indexOf("decks");
    if (decksIdx < 0 || !parts[decksIdx + 1]) return null;
    const publicId = parts[decksIdx + 1];

    const apiUrl = `https://api2.moxfield.com/v2/decks/all/${encodeURIComponent(publicId)}`;
    const res = await fetch(apiUrl, {
      headers: { Accept: "application/json", "User-Agent": "CentCompanion/1.0" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      name?: string;
      boards?: Record<
        string,
        { cards?: Record<string, { quantity?: number; card?: { name?: string } }> }
      >;
      commanders?: Record<string, { quantity?: number; card?: { name?: string } }>;
      mainboard?: Record<string, { quantity?: number; card?: { name?: string } }>;
    };

    const commanders: DeckCard[] = [];
    const main: DeckCard[] = [];

    const cmdSrc = data.commanders ?? data.boards?.commanders?.cards ?? {};
    for (const entry of Object.values(cmdSrc)) {
      const name = entry.card?.name;
      if (name) commanders.push({ name, qty: entry.quantity ?? 1 });
    }

    const mainSrc = data.mainboard ?? data.boards?.mainboard?.cards ?? {};
    for (const entry of Object.values(mainSrc)) {
      const name = entry.card?.name;
      if (name) main.push({ name, qty: entry.quantity ?? 1 });
    }

    if (!commanders.length && !main.length) return null;
    return { name: data.name ?? null, decklist: { main, commanders } };
  } catch {
    return null;
  }
}
