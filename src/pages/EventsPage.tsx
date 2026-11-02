import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { api, type EventItem } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { useGeo } from "../hooks/useGeo";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { Page } from "../components/Motion";
import { SkeletonCard } from "../components/Skeleton";
import { useIntlLocale } from "../lib/formatLocale";
import { eventTypeLabel } from "../lib/eventDisplay";

const FILTER_STORAGE_KEY = "cc_events_filter";
const SORT_STORAGE_KEY = "cc_events_sort";

type EventsFilter =
  | "all"
  | "competitive"
  | "my_local_league"
  | "casual"
  | "near_me";

type EventsSort = "date" | "date_desc" | "type" | "name" | "distance";

const NEAR_ME_RADIUS_KM = 75;
const eventPriority: Record<string, number> = {
  lv2: 4,
  lv1: 3,
  local_league: 2,
  casual: 1,
};
const badgeOrder: Array<NonNullable<EventItem["eventType"]>> = [
  "casual",
  "local_league",
  "lv1",
  "lv2",
];
const loggedInUpcomingTypes: Array<NonNullable<EventItem["eventType"]>> = [
  "local_league",
  "lv1",
  "lv2",
];
const loggedOutUpcomingTypes: Array<NonNullable<EventItem["eventType"]>> = [
  "lv1",
  "lv2",
];

type LatLng = { lat: number; lon: number };
type DayPopoverState = {
  dateKey: string;
  top: number;
  left: number;
  align: "left" | "right";
  cellTop: number;
  cellLeft: number;
  cellWidth: number;
  cellHeight: number;
};

const cityCoordsCache = new Map<string, LatLng>();

function haversineDistanceKm(a: LatLng, b: LatLng) {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const y = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return earthRadiusKm * y;
}

async function geocodePlace(place: string): Promise<LatLng | null> {
  const normalized = place.trim().toLowerCase();
  if (!normalized) return null;
  const cached = cityCoordsCache.get(normalized);
  if (cached) return cached;

  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(place)}`,
    {
      headers: {
        Accept: "application/json",
      },
    },
  );
  if (!res.ok) return null;
  const rows = (await res.json()) as Array<{ lat: string; lon: string }>;
  const first = rows[0];
  if (!first) return null;
  const parsed = { lat: Number(first.lat), lon: Number(first.lon) };
  if (Number.isNaN(parsed.lat) || Number.isNaN(parsed.lon)) return null;
  cityCoordsCache.set(normalized, parsed);
  return parsed;
}

function eventTypeChip(type?: EventItem["eventType"]) {
  switch (type) {
    case "lv2":
      return "sc-chip--red";
    case "lv1":
      return "sc-chip--gold";
    case "local_league":
      return "sc-chip--cyan";
    default:
      return "sc-chip--primary";
  }
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function EventsPage() {
  const { t } = useTranslation("events");
  const locale = useIntlLocale();
  const { user } = useAuth();
  const geo = useGeo();
  const reduced = useReducedMotion();

  const FILTER_OPTIONS: Array<{ value: EventsFilter; label: string; short: string }> = [
    { value: "all", label: t("filter.all"), short: t("filter.allShort") },
    { value: "competitive", label: t("filter.competitive"), short: t("filter.competitiveShort") },
    { value: "my_local_league", label: t("filter.league"), short: t("filter.leagueShort") },
    { value: "casual", label: t("filter.casual"), short: t("filter.casual") },
    { value: "near_me", label: t("filter.nearMe"), short: t("filter.nearMe") },
  ];

  const SORT_OPTIONS: Array<{ value: EventsSort; label: string }> = [
    { value: "date", label: t("sort.soonest") },
    { value: "date_desc", label: t("sort.latest") },
    { value: "type", label: t("sort.type") },
    { value: "name", label: t("sort.name") },
    { value: "distance", label: t("sort.nearest") },
  ];

  const weekdays = t("list.weekdays").split(",");
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<EventsFilter>(() => {
    const saved = localStorage.getItem(FILTER_STORAGE_KEY) as EventsFilter | null;
    if (saved && ["all", "competitive", "my_local_league", "casual", "near_me"].includes(saved)) {
      return saved;
    }
    return "all";
  });
  const [selectedSort, setSelectedSort] = useState<EventsSort>(() => {
    const savedFilter = localStorage.getItem(FILTER_STORAGE_KEY) as EventsFilter | null;
    const saved = localStorage.getItem(SORT_STORAGE_KEY) as EventsSort | null;
    if (saved === "distance" && savedFilter !== "near_me") return "date";
    if (saved && ["date", "date_desc", "type", "name", "distance"].includes(saved)) {
      return saved;
    }
    return "date";
  });
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [monthDirection, setMonthDirection] = useState<1 | -1>(1);
  const [hoveredDateKey, setHoveredDateKey] = useState<string | null>(null);
  const [lockedDateKey, setLockedDateKey] = useState<string | null>(null);
  const [lockingDateKey, setLockingDateKey] = useState<string | null>(null);
  const [popover, setPopover] = useState<DayPopoverState | null>(null);
  const [closestGuestLeagueCity, setClosestGuestLeagueCity] = useState<
    string | null
  >(null);
  const [eventDistances, setEventDistances] = useState<Map<number, number>>(
    new Map(),
  );
  const [nearMeLoading, setNearMeLoading] = useState(false);
  const userPickedFilter = useRef(false);
  const hoverTimer = useRef<number | null>(null);
  const clearHoverTimer = () => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
  };
  const calendarWrapRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLoadingEvents(true);
    api
      .getEvents()
      .then((d) => setEvents(d.events))
      .catch(() => {})
      .finally(() => setLoadingEvents(false));
  }, []);

  const pickFilter = (filter: EventsFilter) => {
    userPickedFilter.current = true;
    setSelectedFilter(filter);
    localStorage.setItem(FILTER_STORAGE_KEY, filter);
    if (filter === "near_me") {
      setSelectedSort("distance");
      localStorage.setItem(SORT_STORAGE_KEY, "distance");
    } else if (selectedSort === "distance") {
      setSelectedSort("date");
      localStorage.setItem(SORT_STORAGE_KEY, "date");
    }
  };

  const pickSort = (sort: EventsSort) => {
    setSelectedSort(sort);
    localStorage.setItem(SORT_STORAGE_KEY, sort);
  };

  const shiftMonth = (delta: -1 | 1) => {
    setMonthDirection(delta);
    setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));
  };

  useEffect(() => {
    if (user || userPickedFilter.current) return;
    if (geo.loading) return;
    if (geo.denied || geo.lat == null || geo.lon == null) {
      if (!userPickedFilter.current) setSelectedFilter("all");
      return;
    }
    const localLeagueCities = Array.from(
      new Set(
        events
          .filter((ev) => ev.eventType === "local_league" && !!ev.city)
          .map((ev) => ev.city as string),
      ),
    );
    if (localLeagueCities.length === 0) {
      if (!userPickedFilter.current) setSelectedFilter("all");
      return;
    }

    let cancelled = false;
    const findClosest = async () => {
      let winner: { city: string; distance: number } | null = null;
      for (const city of localLeagueCities) {
        const coords = await geocodePlace(city);
        if (!coords) continue;
        const distance = haversineDistanceKm(
          { lat: geo.lat!, lon: geo.lon! },
          coords,
        );
        if (!winner || distance < winner.distance) {
          winner = { city, distance };
        }
      }
      if (!cancelled) {
        if (winner) {
          setClosestGuestLeagueCity(winner.city);
        } else if (!userPickedFilter.current) {
          setSelectedFilter("all");
        }
      }
    };
    void findClosest();
    return () => {
      cancelled = true;
    };
  }, [events, geo.denied, geo.lat, geo.lon, geo.loading, user]);

  useEffect(() => {
    if (selectedFilter !== "near_me" || geo.lat == null || geo.lon == null) {
      setEventDistances(new Map());
      setNearMeLoading(false);
      return;
    }

    let cancelled = false;
    setNearMeLoading(true);
    const loadDistances = async () => {
      const next = new Map<number, number>();
      for (const ev of events) {
        if (ev.approvalStatus && ev.approvalStatus !== "approved") continue;
        const place = ev.city?.trim() || ev.location?.trim();
        if (!place) continue;
        const coords = await geocodePlace(place);
        if (!coords) continue;
        next.set(
          ev.id,
          haversineDistanceKm({ lat: geo.lat!, lon: geo.lon! }, coords),
        );
      }
      if (!cancelled) {
        setEventDistances(next);
        setNearMeLoading(false);
      }
    };
    void loadDistances();
    return () => {
      cancelled = true;
    };
  }, [selectedFilter, geo.lat, geo.lon, events]);

  const filteredEvents = useMemo(() => {
    return events
      .filter((ev) => {
        if (ev.approvalStatus && ev.approvalStatus !== "approved") return false;
        if (selectedFilter === "all") return true;
        if (selectedFilter === "competitive")
          return ev.eventType === "lv1" || ev.eventType === "lv2";
        if (selectedFilter === "casual") return ev.eventType === "casual";
        if (selectedFilter === "my_local_league") {
          if (user?.localLeagueCity) {
            return (
              ev.eventType === "local_league" &&
              ev.city === user.localLeagueCity
            );
          }
          if (!user && closestGuestLeagueCity) {
            return (
              ev.eventType === "local_league" &&
              ev.city === closestGuestLeagueCity
            );
          }
          return false;
        }
        if (selectedFilter === "near_me") {
          const distance = eventDistances.get(ev.id);
          return distance != null && distance <= NEAR_ME_RADIUS_KM;
        }
        return true;
      })
      .sort((a, b) => {
        const sortBy =
          selectedSort === "distance" && selectedFilter !== "near_me" && eventDistances.size === 0
            ? "date"
            : selectedSort;

        if (sortBy === "distance") {
          const da = eventDistances.get(a.id) ?? Number.POSITIVE_INFINITY;
          const db = eventDistances.get(b.id) ?? Number.POSITIVE_INFINITY;
          if (da !== db) return da - db;
          return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
        }
        if (sortBy === "name") {
          return a.title.localeCompare(b.title);
        }
        if (sortBy === "type") {
          const pa = eventPriority[a.eventType ?? "casual"] ?? 0;
          const pb = eventPriority[b.eventType ?? "casual"] ?? 0;
          if (pa !== pb) return pb - pa;
          return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
        }
        if (sortBy === "date_desc") {
          return new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime();
        }
        return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
      });
  }, [
    closestGuestLeagueCity,
    eventDistances,
    events,
    selectedFilter,
    selectedSort,
    user,
    user?.localLeagueCity,
  ]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, EventItem[]>();
    for (const ev of filteredEvents) {
      const key = toDateKey(new Date(ev.startsAt));
      const list = map.get(key) ?? [];
      list.push(ev);
      map.set(key, list);
    }
    return map;
  }, [filteredEvents]);

  const sidebarUpcoming = useMemo(() => {
    const now = Date.now();
    const allowedTypes = new Set(
      user ? loggedInUpcomingTypes : loggedOutUpcomingTypes,
    );
    return events
      .filter(
        (ev) =>
          (!ev.approvalStatus || ev.approvalStatus === "approved") &&
          ev.status !== "cancelled" &&
          ev.status !== "completed" &&
          new Date(ev.startsAt).getTime() >= now &&
          !!ev.eventType &&
          allowedTypes.has(ev.eventType),
      )
      .sort(
        (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
      )
      .slice(0, 10);
  }, [events, user]);

  const monthDays = useMemo(() => {
    const monthStart = new Date(
      monthDate.getFullYear(),
      monthDate.getMonth(),
      1,
    );
    const monthEnd = new Date(
      monthDate.getFullYear(),
      monthDate.getMonth() + 1,
      0,
    );
    const startWeekday = monthStart.getDay();
    const totalCells = Math.ceil((startWeekday + monthEnd.getDate()) / 7) * 7;
    return Array.from({ length: totalCells }, (_, idx) => {
      const day = new Date(monthStart);
      day.setDate(idx - startWeekday + 1);
      return day;
    });
  }, [monthDate]);

  const activeDateKey = lockedDateKey ?? popover?.dateKey ?? hoveredDateKey;
  const activeDayEvents = activeDateKey
    ? (eventsByDay.get(activeDateKey) ?? [])
    : [];

  useEffect(() => {
    if (!popover || !calendarWrapRef.current || !popoverRef.current) return;
    const wrap = calendarWrapRef.current;
    const pop = popoverRef.current;
    const pad = 8;
    const width = pop.offsetWidth;
    const height = pop.offsetHeight;

    let nextLeft = popover.cellLeft;
    if (nextLeft + width > wrap.clientWidth - pad) {
      nextLeft = Math.max(pad, popover.cellLeft + popover.cellWidth - width);
    }
    if (nextLeft < pad) nextLeft = pad;

    let nextTop = popover.cellTop + popover.cellHeight + pad;
    if (nextTop + height > wrap.clientHeight - pad) {
      nextTop = Math.max(pad, popover.cellTop - height - pad);
    }

    const nextAlign = nextLeft === popover.cellLeft ? "left" : "right";
    if (
      nextLeft !== popover.left ||
      nextTop !== popover.top ||
      nextAlign !== popover.align
    ) {
      setPopover((prev) =>
        prev
          ? {
              ...prev,
              left: nextLeft,
              top: nextTop,
              align: nextAlign,
            }
          : prev,
      );
    }
  }, [activeDayEvents.length, monthDate, popover]);

  const onDayEnter = (key: string, event: MouseEvent<HTMLButtonElement>) => {
    const cellLeft = event.currentTarget.offsetLeft;
    const cellTop = event.currentTarget.offsetTop;
    const cellWidth = event.currentTarget.offsetWidth;
    const cellHeight = event.currentTarget.offsetHeight;
    const computedLeft = cellLeft;
    const computedTop = cellTop + cellHeight + 8;

    setHoveredDateKey(key);
    setPopover({
      dateKey: key,
      top: computedTop,
      left: computedLeft,
      align: "left",
      cellTop,
      cellLeft,
      cellWidth,
      cellHeight,
    });
    setLockingDateKey(key);
    clearHoverTimer();
    hoverTimer.current = window.setTimeout(() => {
      setLockedDateKey(key);
      setLockingDateKey(null);
    }, 2000);
  };

  const onDayLeave = () => {
    setLockingDateKey(null);
    clearHoverTimer();
    if (!lockedDateKey) {
      setHoveredDateKey(null);
      setPopover(null);
    }
  };

  const closePopover = () => {
    clearHoverTimer();
    setLockingDateKey(null);
    setLockedDateKey(null);
    setHoveredDateKey(null);
    setPopover(null);
  };

  return (
    <Page className="cc-events-page">
      <section className="cc-section cc-events-page__section">
        <div className="sc-container">
          <header className="cc-events-phone-hero">
            <h1>{t("list.title")}</h1>
            <Link to="/join" className="sc-btn sc-btn--sm cc-events-phone-hero__join">
              <i className="ph ph-hash" aria-hidden="true" />
              {t("list.haveJoinCode")}
            </Link>
          </header>

          <div className="cc-h cc-events-desktop-head">
            <div>
              <h2 style={{ marginTop: 12 }} className="cc-events-title">
                {t("list.calendarTitle")}
              </h2>
            </div>
          </div>
          <div className="cc-events-toolbar">
            <div className="cc-events-toolbar__selects" role="group" aria-label={t("list.filterAria")}>
              <label className="cc-events-toolbar__field">
                <span className="cc-events-toolbar__label">{t("list.filter")}</span>
                <select
                  className="sc-input cc-events-toolbar__select"
                  value={selectedFilter}
                  onChange={(e) => pickFilter(e.target.value as EventsFilter)}
                  aria-label={t("list.filterAriaShort")}
                >
                  {FILTER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.short}
                    </option>
                  ))}
                </select>
              </label>
              <label className="cc-events-toolbar__field">
                <span className="cc-events-toolbar__label">{t("list.sort")}</span>
                <select
                  className="sc-input cc-events-toolbar__select"
                  value={selectedSort}
                  onChange={(e) => pickSort(e.target.value as EventsSort)}
                  aria-label={t("list.sortAria")}
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option
                      key={opt.value}
                      value={opt.value}
                      disabled={opt.value === "distance" && selectedFilter !== "near_me"}
                    >
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div
              className="sc-row cc-events-filters"
              role="group"
              aria-label={t("list.filterAriaPanel")}
            >
              {FILTER_OPTIONS.map(({ value: filter, label }) => (
                <button
                  key={filter}
                  className={`sc-btn sc-btn--sm cc-filter-btn${selectedFilter === filter ? "" : " sc-btn--ghost"}`}
                  type="button"
                  aria-pressed={selectedFilter === filter}
                  onClick={() => pickFilter(filter)}
                >
                  {selectedFilter === filter && !reduced && (
                    <motion.span
                      layoutId="cc-events-filter"
                      className="cc-filter-btn__indicator"
                      transition={{ duration: 0.22, ease: [0, 0.8, 0.26, 0.99] }}
                    />
                  )}
                  {filter === "near_me" && <i className="ph ph-map-pin" aria-hidden="true" />}{" "}
                  {label}
                </button>
              ))}
            </div>

            <label className="cc-events-toolbar__field cc-events-toolbar__field--desktop-sort">
              <span className="cc-events-toolbar__label">{t("list.sort")}</span>
              <select
                className="sc-input cc-events-toolbar__select"
                value={selectedSort}
                onChange={(e) => pickSort(e.target.value as EventsSort)}
                aria-label={t("list.sortAria")}
              >
                {SORT_OPTIONS.map((opt) => (
                  <option
                    key={opt.value}
                    value={opt.value}
                    disabled={opt.value === "distance" && selectedFilter !== "near_me"}
                  >
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {!user && selectedFilter === "my_local_league" && (
            <p className="sc-body-sm cc-events-hint">
              {geo.denied
                ? t("list.locationDenied")
                : closestGuestLeagueCity
                  ? t("list.showingNearest", { city: closestGuestLeagueCity })
                  : geo.loading
                    ? t("list.findingLeague")
                    : t("list.findingLeagueShort")}
            </p>
          )}
          {selectedFilter === "near_me" && (
            <p className="sc-body-sm cc-events-hint">
              {geo.denied
                ? t("list.nearMeDenied")
                : geo.loading || nearMeLoading
                  ? t("list.findingNear")
                  : t("list.withinKm", { km: NEAR_ME_RADIUS_KM })}
            </p>
          )}
          {!loadingEvents && (
            <p className="sc-body-sm cc-events-count" aria-live="polite">
              {t("list.count", { count: filteredEvents.length, n: filteredEvents.length })}
            </p>
          )}

          <div className="cc-events-list-panel">
            {loadingEvents ? (
              <div className="cc-events-phone-list">
                <SkeletonCard />
                <SkeletonCard />
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="cc-events-phone-empty">
                <p>
                  {selectedFilter === "near_me" && (geo.denied || geo.loading || nearMeLoading)
                    ? t("list.waitingLocation")
                    : t("list.empty")}
                </p>
              </div>
            ) : (
              <div className="cc-events-phone-list" role="list">
                {filteredEvents.map((ev) => {
                  const distance = eventDistances.get(ev.id);
                  const startsAt = new Date(ev.startsAt);
                  return (
                    <Link
                      key={ev.id}
                      to={`/events/${ev.id}`}
                      className="cc-events-phone-row"
                      role="listitem"
                    >
                      <div className="cc-events-phone-row__body">
                        <div className="cc-events-phone-row__top">
                          <span className="cc-events-phone-row__title">{ev.title}</span>
                          <span className={`sc-chip ${eventTypeChip(ev.eventType)}`}>
                            {eventTypeLabel(ev.eventType)}
                          </span>
                        </div>
                        <span className="cc-events-phone-row__meta">
                          {startsAt.toLocaleDateString(locale, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                          {" · "}
                          {startsAt.toLocaleTimeString(locale, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <span className="cc-events-phone-row__meta">
                          {ev.storeName}
                          {ev.city ? ` · ${ev.city}` : ""}
                          {selectedFilter === "near_me" && distance != null
                            ? ` · ${Math.round(distance)} km`
                            : ""}
                        </span>
                        <span className="cc-events-phone-row__meta cc-events-phone-row__meta--soft">
                          {ev.maxPlayers
                            ? t("list.registeredOf", { n: ev.registrationCount ?? 0, max: ev.maxPlayers })
                            : t("list.registered", { n: ev.registrationCount ?? 0 })}
                          {ev.format ? ` · ${ev.format}` : ""}
                        </span>
                      </div>
                      <i
                        className="ph ph-caret-right cc-events-phone-row__chevron"
                        aria-hidden="true"
                      />
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div className="cc-events-layout">
          <article className="sc-card cc-events-calendar-panel">
            <div
              className="sc-row"
              style={{ justifyContent: "space-between", marginBottom: 16 }}
            >
              <button
                className="sc-btn sc-btn--sm sc-btn--ghost"
                type="button"
                onClick={() => shiftMonth(-1)}
              >
                <i className="ph ph-caret-left" /> {t("list.prev")}
              </button>
              <h3 className="sc-card__title" style={{ margin: 0 }}>
                {monthDate.toLocaleDateString(locale, {
                  month: "long",
                  year: "numeric",
                })}
              </h3>
              <button
                className="sc-btn sc-btn--sm sc-btn--ghost"
                type="button"
                onClick={() => shiftMonth(1)}
              >
                {t("list.next")} <i className="ph ph-caret-right" />
              </button>
            </div>
            <div
              className="cc-calendar-wrap"
              ref={calendarWrapRef}
              onMouseLeave={closePopover}
            >
              <AnimatePresence mode="wait" custom={monthDirection}>
                <motion.div
                  key={`${monthDate.getFullYear()}-${monthDate.getMonth()}`}
                  className="cc-calendar-month"
                  custom={monthDirection}
                  initial={reduced ? false : { opacity: 0, x: monthDirection * 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reduced ? undefined : { opacity: 0, x: monthDirection * -40 }}
                  transition={{ duration: reduced ? 0 : 0.28, ease: [0, 0.8, 0.26, 0.99] }}
                >
              <div className="cc-calendar" style={{ marginBottom: 16 }}>
                {weekdays.map((w) => (
                  <div key={w} className="cc-calendar__weekday">
                    {w}
                  </div>
                ))}
                {monthDays.map((day) => {
                  const key = toDateKey(day);
                  const dayEvents = eventsByDay.get(key) ?? [];
                  const dayTypes = badgeOrder.filter((type) =>
                    dayEvents.some((ev) => ev.eventType === type),
                  );
                  const outsideMonth = day.getMonth() !== monthDate.getMonth();
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`cc-calendar__day ${outsideMonth ? "cc-calendar__day--muted" : ""} ${activeDateKey === key ? "cc-calendar__day--active" : ""} ${lockingDateKey === key ? "cc-calendar__day--locking" : ""}`}
                      onMouseEnter={(e) => onDayEnter(key, e)}
                      onMouseLeave={onDayLeave}
                      onClick={() => setLockedDateKey(key)}
                    >
                      <span className="cc-calendar__lockfill" />
                      <span>{day.getDate()}</span>
                      {dayEvents.length > 0 && (
                        <div className="cc-calendar__badges" aria-hidden="true">
                          {dayTypes.map((type) => (
                            <span
                              key={`${key}-${type}`}
                              className={`cc-ev-badge cc-ev-badge--${type}`}
                              title={type}
                            >
                              {type === "casual" && "C"}
                              {type === "local_league" && "LL"}
                              {type === "lv1" && "1"}
                              {type === "lv2" && "2"}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
                </motion.div>
              </AnimatePresence>
              {popover && (
                <div
                  ref={popoverRef}
                  className={`cc-day-popover ${popover.align === "right" ? "cc-day-popover--right" : ""} ${lockedDateKey ? "cc-day-popover--interactive" : ""}`}
                  style={{ top: popover.top, left: popover.left }}
                  onMouseEnter={() => {
                    if (lockedDateKey) clearHoverTimer();
                  }}
                  onMouseLeave={onDayLeave}
                >
                  <p className="sc-body-sm" style={{ marginBottom: 8 }}>
                    {t("list.dayEvents", {
                      count: activeDayEvents.length,
                      n: activeDayEvents.length,
                      date: new Date(popover.dateKey).toLocaleDateString(locale),
                    })}
                    {lockedDateKey && ` ${t("list.dayLocked")}`}
                  </p>
                  {activeDayEvents.length === 0 && (
                    <p className="sc-body-sm">{t("list.noEventsDay")}</p>
                  )}
                  <div className="sc-stack" style={{ gap: 10 }}>
                    {activeDayEvents.map((ev) => (
                      <article key={ev.id} className="cc-day-popover__item">
                        <div
                          className="sc-row"
                          style={{
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <strong>{ev.title}</strong>
                          <span className="sc-chip sc-chip--gold">
                            {(ev.eventType ?? "casual").toUpperCase()}
                          </span>
                        </div>
                        <p className="sc-body-sm" style={{ margin: "4px 0" }}>
                          {new Date(ev.startsAt).toLocaleTimeString(locale, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          - {ev.storeName}
                          {(ev.registrationCount ?? 0) > 0 && (
                            <> · {t("list.registered", { n: ev.registrationCount })}</>
                          )}
                        </p>
                        <Link
                          to={`/events/${ev.id}`}
                          className="sc-btn sc-btn--sm"
                        >
                          {t("list.detailsSignup")}
                        </Link>
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </article>

          <aside className="cc-events-sidebar" aria-label={t("list.sidebarAria")}>
            <h3 className="sc-card__title" style={{ margin: 0 }}>{t("list.comingUp")}</h3>
            {loadingEvents ? (
              <SkeletonCard />
            ) : sidebarUpcoming.length === 0 ? (
              <p className="sc-body-sm">{t("list.noUpcoming")}</p>
            ) : (
              sidebarUpcoming.map((ev) => {
                const startsAt = new Date(ev.startsAt);
                return (
                  <Link key={ev.id} to={`/events/${ev.id}`} className="cc-events-sidebar__item">
                    <strong>{ev.title}</strong>
                    <span>
                      {startsAt.toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric" })}
                      {" · "}
                      {startsAt.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span>{ev.storeName}{ev.city ? ` · ${ev.city}` : ""}</span>
                  </Link>
                );
              })
            )}
          </aside>
          </div>
        </div>
      </section>
    </Page>
  );
}
