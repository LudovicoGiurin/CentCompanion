import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "../i18n";
import { useGeo, type GeoBias } from "../hooks/useGeo";

export type PlaceSelection = {
  location: string;
  city: string | null;
};

type PlaceSuggestion = {
  id: string;
  /** Short name shown as the option's first line (venue / place name). */
  title: string;
  /** Compact full label, stored as the event location on select. */
  displayName: string;
  detail: string;
  city: string | null;
  country: string | null;
  countryCode: string | null;
};

type LocationSearchProps = {
  value: string;
  selectedCity: string | null;
  onValueChange: (value: string) => void;
  onSelect: (place: PlaceSelection) => void;
  placeholder?: string;
  required?: boolean;
};

type NominatimItem = {
  place_id: number;
  display_name: string;
  name?: string;
  address?: {
    road?: string;
    house_number?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    country?: string;
    country_code?: string;
  };
};

type PhotonFeature = {
  properties: {
    osm_id?: number;
    osm_type?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    country?: string;
    countrycode?: string;
    type?: string;
  };
};

const COUNTRY_NAMES: Record<string, string> = {
  it: "Italy",
  fr: "France",
  de: "Germany",
  es: "Spain",
  pt: "Portugal",
  gb: "United Kingdom",
  us: "United States",
};

/** Localized country labels used when matching geocoder results. */
const COUNTRY_ALIASES: Record<string, string[]> = {
  it: ["italy", "italia"],
  fr: ["france", "francia"],
  de: ["germany", "deutschland", "germania"],
  es: ["spain", "españa", "espana", "spagna"],
  pt: ["portugal"],
  gb: ["united kingdom", "uk", "regno unito", "grande bretagna"],
  us: ["united states", "usa", "stati uniti"],
};

function photonLang(): string {
  const lang = (i18n.language || "en").split("-")[0].toLowerCase();
  return lang || "en";
}

/** Fold accents so "Città" matches "Citta" / "città". */
function foldText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function cityFromParts(parts: {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
}): string | null {
  return (
    parts.city ??
    parts.town ??
    parts.village ??
    parts.municipality ??
    parts.county ??
    null
  );
}

function normalizeKey(name: string): string {
  return foldText(name).replace(/[^a-z0-9]+/g, " ").trim().slice(0, 48);
}

function dedupePlaces(items: PlaceSuggestion[]): PlaceSuggestion[] {
  const seen = new Set<string>();
  const out: PlaceSuggestion[] = [];
  for (const item of items) {
    const key = normalizeKey(item.displayName);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function locationHintsFromQuery(query: string): string[] {
  const words = query.trim().split(/\s+/).filter((w) => w.length >= 3);
  if (words.length < 2) return [];
  const hints = new Set<string>();
  hints.add(foldText(words[words.length - 1]));
  if (words.length >= 2) hints.add(foldText(words.slice(-2).join(" ")));
  return [...hints];
}

function matchesBiasCountry(item: PlaceSuggestion, countryCode: string): boolean {
  if (item.countryCode === countryCode) return true;
  const aliases = COUNTRY_ALIASES[countryCode] ?? [];
  const country = item.country ? foldText(item.country) : "";
  if (aliases.some((alias) => country === alias || country.includes(alias))) return true;
  const label = COUNTRY_NAMES[countryCode];
  return !!label && country === foldText(label);
}

function rankPlaces(
  query: string,
  items: PlaceSuggestion[],
  bias?: GeoBias,
): PlaceSuggestion[] {
  const tokens = foldText(query)
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  const locationHints = locationHintsFromQuery(query);

  return [...items].sort((a, b) => {
    const score = (item: PlaceSuggestion) => {
      const hay = foldText(`${item.displayName} ${item.detail} ${item.city ?? ""}`);
      let s = 0;

      for (const token of tokens) {
        if (hay.includes(token)) s += 3;
        else if (token.length >= 4) {
          const prefix = token.slice(0, Math.min(4, token.length));
          if (hay.includes(prefix)) s += 1;
        }
      }

      for (const hint of locationHints) {
        if (hay.includes(hint)) s += 25;
        if (item.city && foldText(item.city).includes(hint)) s += 30;
      }

      if (bias?.countryCode) {
        if (matchesBiasCountry(item, bias.countryCode)) s += 20;
        else if (item.countryCode || item.country) s -= 30;
      }

      if (locationHints.length > 0) {
        const matchesHint = locationHints.some((hint) => hay.includes(hint));
        if (!matchesHint) s -= 50;
      }

      return s;
    };
    return score(b) - score(a);
  });
}

function fromNominatim(item: NominatimItem): PlaceSuggestion {
  const city = extractCityFromNominatim(item);
  const country = item.address?.country ?? null;
  const countryCode = item.address?.country_code?.toLowerCase() ?? null;
  // display_name is the full comma-separated address (often 8+ parts) —
  // unreadable in a dropdown. Build a short title + compact detail instead.
  const title = item.name?.trim() || item.display_name.split(",")[0].trim();
  const road = item.address?.road;
  const street = road
    ? item.address?.house_number
      ? `${road} ${item.address.house_number}`
      : road
    : null;
  const detailParts = [street, city, item.address?.state, country].filter(
    (d): d is string => !!d && !foldText(title).includes(foldText(d)),
  );
  return {
    id: `n-${item.place_id}`,
    title,
    displayName: [title, ...detailParts].join(", "),
    detail: detailParts.join(" · "),
    city,
    country,
    countryCode,
  };
}

function fromPhoton(feature: PhotonFeature, index: number): PlaceSuggestion {
  const p = feature.properties;
  const city = cityFromParts(p);
  const countryCode = p.countrycode?.toLowerCase() ?? null;
  const country =
    p.country ?? (countryCode ? (COUNTRY_NAMES[countryCode] ?? countryCode.toUpperCase()) : null);
  const titleParts = [
    p.name,
    p.street && p.housenumber ? `${p.street} ${p.housenumber}` : p.street,
    !p.name && !p.street ? city : null,
  ].filter(Boolean);
  const title = titleParts.join(", ") || city || i18n.t("common:location.unknownPlace");
  const detailParts = [
    p.name && p.street ? p.street : null,
    city,
    p.state,
    country,
    p.type ? p.type.replace(/_/g, " ") : null,
  ].filter(Boolean);
  const extraParts = detailParts.filter((d) => d && !title.includes(d));
  return {
    id: `p-${p.osm_type ?? "x"}-${p.osm_id ?? index}`,
    title,
    displayName: [title, ...extraParts].join(", "),
    detail: extraParts.join(" · "),
    city,
    country,
    countryCode,
  };
}

function extractCityFromNominatim(item: NominatimItem): string | null {
  return cityFromParts(item.address ?? {});
}

async function fetchPhoton(query: string, bias?: GeoBias): Promise<PlaceSuggestion[]> {
  try {
    const params = new URLSearchParams({
      q: query,
      limit: "10",
      lang: photonLang(),
    });
    if (bias?.bbox) params.set("bbox", bias.bbox);
    if (bias?.lat != null && bias?.lon != null) {
      params.set("lat", String(bias.lat));
      params.set("lon", String(bias.lon));
    }
    const url = `https://photon.komoot.io/api/?${params.toString()}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const data = (await res.json()) as { features?: PhotonFeature[] };
    return (data.features ?? []).map(fromPhoton);
  } catch {
    return [];
  }
}

async function fetchNominatim(query: string, bias?: GeoBias): Promise<PlaceSuggestion[]> {
  try {
    const params = new URLSearchParams({
      format: "json",
      addressdetails: "1",
      limit: "8",
      q: query,
      "accept-language": photonLang(),
    });
    if (bias?.countryCode) params.set("countrycodes", bias.countryCode);
    const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const rows = (await res.json()) as NominatimItem[];
    return rows.map(fromNominatim);
  } catch {
    return [];
  }
}

function alternateQueries(query: string, bias?: GeoBias): string[] {
  const words = query.trim().split(/\s+/).filter((w) => w.length >= 2);
  const alts = new Set<string>([query.trim()]);
  const countryName = bias?.countryCode ? COUNTRY_NAMES[bias.countryCode] : null;

  if (words.length >= 2) {
    const cityHint = words[words.length - 1];
    const venue = words.slice(0, -1).join(" ");
    if (countryName) alts.add(`${venue}, ${cityHint}, ${countryName}`);
    alts.add(`${cityHint} ${venue}`);
  }
  if (words.length > 2) alts.add(words.slice(1).join(" "));
  if (words.length >= 2) alts.add(words.slice(-2).join(" "));

  return [...alts].filter((q) => q.length >= 2);
}

export async function searchPlaces(query: string, bias?: GeoBias): Promise<PlaceSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  try {
    const queries = alternateQueries(trimmed, bias);
    const settled = await Promise.allSettled(
      queries.flatMap((q) => [fetchPhoton(q, bias), fetchNominatim(q, bias)]),
    );
    const batches = settled.flatMap((result) =>
      result.status === "fulfilled" ? result.value : [],
    );
    const merged = dedupePlaces(batches);
    const ranked = rankPlaces(trimmed, merged, bias);

    const withLocationMatch = ranked.filter((item) => {
      const hints = locationHintsFromQuery(trimmed);
      if (hints.length === 0) return true;
      const hay = foldText(`${item.displayName} ${item.detail} ${item.city ?? ""}`);
      return hints.some((hint) => hay.includes(hint));
    });

    return (withLocationMatch.length > 0 ? withLocationMatch : ranked).slice(0, 8);
  } catch {
    return [];
  }
}

export async function resolveCityFromLocation(
  location: string,
  bias?: GeoBias,
): Promise<string | null> {
  try {
    const results = await searchPlaces(location, bias);
    return results[0]?.city ?? null;
  } catch {
    return null;
  }
}

export function LocationSearch({
  value,
  selectedCity,
  onValueChange,
  onSelect,
  placeholder,
  required = false,
}: LocationSearchProps) {
  const { t } = useTranslation("common");
  const geo = useGeo();
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  // Only search/open while the user is actually typing — not on mount with a
  // pre-filled value, and not when `value` changes because a suggestion was picked.
  const typingRef = useRef(false);
  const resolvedPlaceholder = placeholder ?? t("location.placeholder");

  useEffect(() => {
    if (value.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    if (!typingRef.current) return;
    if (geo.loading) return;

    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const rows = await searchPlaces(value, geo);
        setSuggestions(rows);
        setOpen(rows.length > 0);
        setActiveIndex(-1);
      } catch {
        setSuggestions([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => window.clearTimeout(timer);
  }, [value, geo.loading, geo.countryCode, geo.bbox, geo.lat, geo.lon]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const pick = (item: PlaceSuggestion) => {
    typingRef.current = false;
    onSelect({ location: item.displayName, city: item.city });
    setOpen(false);
    setSuggestions([]);
  };

  return (
    <div className="cc-place-search" ref={wrapRef}>
      <div className="cc-place-search__input-wrap">
        <i className="ph ph-map-pin cc-place-search__icon" aria-hidden="true" />
        <input
          className="sc-input cc-place-search__input"
          value={value}
          onChange={(e) => {
            typingRef.current = true;
            onValueChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true);
          }}
          onKeyDown={(e) => {
            if (!open || suggestions.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIndex((i) => (i + 1) % suggestions.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
            } else if (e.key === "Enter" && activeIndex >= 0) {
              e.preventDefault();
              pick(suggestions[activeIndex]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={resolvedPlaceholder}
          required={required}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
        />
        {loading && <span className="cc-place-search__status">{t("location.searching")}</span>}
      </div>

      {selectedCity && (
        <p className="cc-place-search__city">
          <i className="ph ph-buildings" /> {t("location.city", { city: selectedCity })}
        </p>
      )}

      {geo.countryCode && !geo.denied && (
        <p className="sc-body-sm" style={{ marginTop: 6, color: "var(--sc-muted)" }}>
          {t("location.searchingNear", {
            country: COUNTRY_NAMES[geo.countryCode] ?? geo.countryCode.toUpperCase(),
          })}
        </p>
      )}

      {open && suggestions.length > 0 && (
        <ul className="cc-place-search__dropdown" id={listId} role="listbox">
          {suggestions.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                className={`cc-place-search__option ${index === activeIndex ? "cc-place-search__option--active" : ""}`}
                role="option"
                aria-selected={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => pick(item)}
              >
                <span className="cc-place-search__option-title">{item.title}</span>
                {item.detail && (
                  <span className="cc-place-search__option-detail">{item.detail}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && !loading && value.trim().length >= 2 && suggestions.length === 0 && (
        // TODO: key added to en/common.json as location.noMatches
        <div className="cc-place-search__empty">{t("location.noMatches")}</div>
      )}
    </div>
  );
}
