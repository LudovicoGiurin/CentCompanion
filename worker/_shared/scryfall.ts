/**
 * Minimal Scryfall client. Used to pick a random legendary creature
 * artwork as the default profile picture for new accounts.
 */

type ScryfallImageUris = { art_crop?: string; normal?: string };
type ScryfallCard = {
  name?: string;
  image_uris?: ScryfallImageUris;
  card_faces?: { image_uris?: ScryfallImageUris }[];
};

export async function fetchRandomLegendaryArt(): Promise<{ url: string; name: string } | null> {
  try {
    const query = encodeURIComponent("type:legendary type:creature");
    const res = await fetch(`https://api.scryfall.com/cards/random?q=${query}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "CentCompanion/1.0 (https://centcomp.net)",
      },
    });
    if (!res.ok) return null;
    const card = (await res.json()) as ScryfallCard;
    const uris = card.image_uris ?? card.card_faces?.[0]?.image_uris;
    const url = uris?.art_crop ?? uris?.normal;
    if (!url) return null;
    return { url, name: card.name ?? "" };
  } catch {
    return null;
  }
}
