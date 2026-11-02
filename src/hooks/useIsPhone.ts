import { useEffect, useState } from "react";

/** True when the viewport matches the given CSS media query. */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    const mq = window.matchMedia(query);
    const sync = () => setMatches(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [query]);

  return matches;
}

/** True when viewport matches the project phone breakpoint (≤640px). */
export function useIsPhone() {
  return useMediaQuery("(max-width: 640px)");
}
