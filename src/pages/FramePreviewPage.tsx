import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";

const DESKTOP = { id: "desktop", label: "Desktop", w: 1280, h: 800 };
const PHONE = { id: "phone", label: "Phone", w: 390, h: 844 };
const FRAMES = [DESKTOP, PHONE];
const FRAME_GAP = 20;
const LABEL_BLOCK = 36;

const PRESETS = [
  { path: "/", label: "Home" },
  { path: "/events", label: "Events" },
  { path: "/join", label: "Join" },
  { path: "/leaderboard", label: "Leaderboard" },
  { path: "/rules", label: "Rules" },
  { path: "/organizer", label: "Organizer" },
  { path: "/settings", label: "Settings" },
  { path: "/profile", label: "Profile" },
];

function framePath(raw: string): string | null {
  let value = raw.trim();
  if (!value) return null;

  if (value.startsWith("http://") || value.startsWith("https://")) {
    try {
      const url = new URL(value);
      value = `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return null;
    }
  }

  if (!value.startsWith("/")) value = `/${value}`;
  if (value.startsWith("//")) return null;

  const pathname = value.split(/[?#]/)[0] ?? value;
  if (pathname === "/dev/frames" || pathname.startsWith("/dev/frames/")) return null;

  return value;
}

function useFitScale(stageRef: RefObject<HTMLDivElement | null>) {
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    const measure = () => {
      const style = getComputedStyle(el);
      const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const width = el.clientWidth - padX;
      const height = el.clientHeight - padY;
      if (width <= 0 || height <= 0) return;

      const naturalW = DESKTOP.w + PHONE.w + FRAME_GAP;
      const naturalH = PHONE.h + LABEL_BLOCK;
      const next = Math.min(width / naturalW, height / naturalH, 1);
      setScale(Math.max(0.2, Math.round(next * 100) / 100));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [stageRef]);

  return scale;
}

export function FramePreviewPage() {
  const [params, setParams] = useSearchParams();
  const requested = params.get("path") || "/";
  const path = framePath(requested) ?? "/";
  const [draft, setDraft] = useState(path);
  const [pathError, setPathError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [actualSize, setActualSize] = useState(false);
  const [eventPath, setEventPath] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const fitted = useFitScale(stageRef);
  const scale = actualSize ? 1 : fitted;

  const presets = useMemo(() => {
    if (!eventPath) return PRESETS;
    const pages = [...PRESETS];
    const eventsIndex = pages.findIndex((page) => page.path === "/events");
    pages.splice(eventsIndex + 1, 0, { path: eventPath, label: "Event" });
    return pages;
  }, [eventPath]);

  useEffect(() => {
    const previous = document.title;
    document.title = "Layout frames — Cent Companion";
    return () => {
      document.title = previous;
    };
  }, []);

  useEffect(() => {
    setDraft(path);
  }, [path]);

  useEffect(() => {
    let cancelled = false;
    api
      .getEvents()
      .then((data) => {
        const event = data.events.find((item) => item.id);
        if (!cancelled && event) setEventPath(`/events/${event.id}`);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  function openPath(next: string) {
    const safe = framePath(next);
    if (!safe) {
      setPathError("Use an app path such as /events. This preview cannot load itself.");
      return;
    }
    setPathError("");
    setParams({ path: safe });
  }

  return (
    <div className="cc-frames">
      <header className="cc-frames__bar">
        <div className="cc-frames__heading">
          <h1>Layout frames</h1>
          <p>
            Desktop is {DESKTOP.w}×{DESKTOP.h}. Phone is {PHONE.w}×{PHONE.h}, under the 640px breakpoint.
            Shown at {Math.round(scale * 100)}%.
          </p>
        </div>

        <nav className="cc-frames__pages" aria-label="Pages">
          {presets.map((page) => (
            <button
              key={page.path}
              type="button"
              className={`cc-frames__page${path === page.path ? " is-active" : ""}`}
              aria-current={path === page.path ? "page" : undefined}
              onClick={() => openPath(page.path)}
            >
              {page.label}
            </button>
          ))}
        </nav>

        <form
          className="cc-frames__path"
          onSubmit={(event) => {
            event.preventDefault();
            openPath(draft);
          }}
        >
          <label className="visually-hidden" htmlFor="cc-frames-path">
            App path
          </label>
          <input
            id="cc-frames-path"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            spellCheck={false}
            placeholder="/events"
          />
          <button type="submit" className="cc-frames__page">
            Open
          </button>
          <button
            type="button"
            className="cc-frames__page"
            onClick={() => setReloadKey((key) => key + 1)}
          >
            Reload
          </button>
          <button
            type="button"
            className={`cc-frames__page${actualSize ? " is-active" : ""}`}
            aria-pressed={actualSize}
            onClick={() => setActualSize((current) => !current)}
          >
            {actualSize ? "Fit window" : "Actual size"}
          </button>
        </form>
        {pathError ? <p className="cc-frames__error">{pathError}</p> : null}
      </header>

      <div className="cc-frames__stage" ref={stageRef}>
        {FRAMES.map((frame) => (
          <section key={frame.id} className="cc-frames__slot" style={{ width: frame.w * scale }}>
            <h2 className="cc-frames__label">
              {frame.label}
              <span>
                {frame.w}×{frame.h}
              </span>
            </h2>
            <div
              className="cc-frames__screen"
              style={{ width: frame.w * scale, height: frame.h * scale }}
            >
              <div
                className="cc-frames__scale"
                style={{
                  width: frame.w,
                  height: frame.h,
                  transform: `scale(${scale})`,
                }}
              >
                <iframe
                  key={`${frame.id}-${path}-${reloadKey}`}
                  title={`${frame.label} preview of ${path}`}
                  src={path}
                  style={{ width: frame.w, height: frame.h }}
                />
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
