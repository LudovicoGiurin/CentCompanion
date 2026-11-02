import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { hasPrivacyConsent } from "../lib/privacyConsent";

export type GeoBias = {
  lat: number | null;
  lon: number | null;
  countryCode: string | null;
  bbox: string | null;
  loading: boolean;
  denied: boolean;
};

const SESSION_KEY = "cc_geo_bias";

const emptyBias: GeoBias = {
  lat: null,
  lon: null,
  countryCode: null,
  bbox: null,
  loading: true,
  denied: false,
};

function bboxAround(lat: number, lon: number, delta = 1.5): string {
  return `${lon - delta},${lat - delta},${lon + delta},${lat + delta}`;
}

async function reverseCountryCode(lat: number, lon: number): Promise<string | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=5`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const data = (await res.json()) as { address?: { country_code?: string } };
  return data.address?.country_code?.toLowerCase() ?? null;
}

const GeoContext = createContext<GeoBias>(emptyBias);

export function GeoProvider({ children }: { children: ReactNode }) {
  const [bias, setBias] = useState<GeoBias>(emptyBias);

  const requestGeo = useCallback(() => {
    const cached = sessionStorage.getItem(SESSION_KEY);
    if (cached) {
      try {
        setBias({ ...(JSON.parse(cached) as GeoBias), loading: false });
        return;
      } catch {
        sessionStorage.removeItem(SESSION_KEY);
      }
    }

    if (!navigator.geolocation) {
      setBias({ ...emptyBias, loading: false, denied: true });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        let countryCode: string | null = null;
        try {
          countryCode = await reverseCountryCode(lat, lon);
        } catch {
          /* reverse geocode optional */
        }
        const next: GeoBias = {
          lat,
          lon,
          countryCode,
          bbox: bboxAround(lat, lon),
          loading: false,
          denied: false,
        };
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
        setBias(next);
      },
      () => {
        setBias({ ...emptyBias, loading: false, denied: true });
      },
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 30 * 60 * 1000,
      },
    );
  }, []);

  useEffect(() => {
    if (!hasPrivacyConsent()) {
      setBias({ ...emptyBias, loading: false, denied: true });
      return;
    }
    requestGeo();
  }, [requestGeo]);

  useEffect(() => {
    const onConsent = () => requestGeo();
    window.addEventListener("cc-privacy-consent", onConsent);
    return () => window.removeEventListener("cc-privacy-consent", onConsent);
  }, [requestGeo]);

  return <GeoContext.Provider value={bias}>{children}</GeoContext.Provider>;
}

export function useGeo() {
  return useContext(GeoContext);
}
