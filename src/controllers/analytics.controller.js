const AnalyticsEvent = require("../models/analyticsEvent.model");

const EVENT_TYPES = new Set([
  "page_view",
  "click",
  "api_call",
  "form_submit",
  "error",
  "session_start",
  "custom",
]);

const EVENT_STATUSES = new Set(["info", "pending", "success", "failed"]);
const GRANULARITIES = new Set(["auto", "hourly", "daily", "weekly", "monthly"]);

const TRACKED_SOURCE_APP = "MeraDevFrontend";
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
const DEFAULT_RANGE_MS = 24 * HOUR_MS;
const MAX_RANGE_MS = 180 * DAY_MS;
const MAX_QUERY_LIMIT = 120000;
const MAX_VISITOR_OVERVIEW = 220;
const MAX_VISITOR_PREVIEW_ACTIVITIES = 8;
const MAX_VISITOR_JOURNEY_ACTIVITIES = 450;
const MAX_PAGE_SEQUENCE_ITEMS = 140;

const normalizeText = (value, maxLength = 200) =>
  String(value || "")
    .trim()
    .slice(0, maxLength);

const normalizeDate = (value) => {
  const parsed = value ? new Date(value) : new Date();
  if (Number.isNaN(parsed.getTime())) return new Date();
  return parsed;
};

const parseOptionalDate = (value) => {
  const raw = normalizeText(value, 80);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const hasOwnerAccess = (req) => {
  const role = normalizeText(req?.user?.role, 20).toLowerCase();
  return role === "owner";
};

const toSerializableMetadata = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_error) {
    return {};
  }
};

const normalizeEventType = (value) => {
  const normalized = normalizeText(value, 40).toLowerCase();
  return EVENT_TYPES.has(normalized) ? normalized : "custom";
};

const normalizeStatus = (value) => {
  const normalized = normalizeText(value, 20).toLowerCase();
  return EVENT_STATUSES.has(normalized) ? normalized : "info";
};

const normalizeSourceApp = (value) =>
  normalizeText(value, 60) || TRACKED_SOURCE_APP;

const resolveTimezone = (value) => {
  const candidate = normalizeText(value, 60) || "UTC";
  try {
    new Intl.DateTimeFormat("en-IN", { timeZone: candidate }).format(new Date());
    return candidate;
  } catch (_error) {
    return "UTC";
  }
};

const resolveGranularity = (requested, rangeMs) => {
  const normalized = normalizeText(requested, 20).toLowerCase();
  if (normalized && normalized !== "auto" && GRANULARITIES.has(normalized)) {
    return normalized;
  }

  if (rangeMs <= 48 * HOUR_MS) return "hourly";
  if (rangeMs <= 60 * DAY_MS) return "daily";
  if (rangeMs <= 240 * DAY_MS) return "weekly";
  return "monthly";
};

const clampRange = ({ startAt, endAt }) => {
  let safeEnd = endAt || new Date();
  let safeStart = startAt || new Date(safeEnd.getTime() - DEFAULT_RANGE_MS);

  if (safeStart.getTime() > safeEnd.getTime()) {
    const tmp = safeStart;
    safeStart = safeEnd;
    safeEnd = tmp;
  }

  if (safeEnd.getTime() - safeStart.getTime() > MAX_RANGE_MS) {
    safeStart = new Date(safeEnd.getTime() - MAX_RANGE_MS);
  }

  return { startAt: safeStart, endAt: safeEnd };
};

const truncateToUtcHour = (date) =>
  new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      date.getUTCHours(),
      0,
      0,
      0,
    ),
  );

const truncateToUtcDay = (date) =>
  new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0),
  );

const startOfUtcIsoWeek = (date) => {
  const dayStart = truncateToUtcDay(date);
  const day = dayStart.getUTCDay() || 7;
  dayStart.setUTCDate(dayStart.getUTCDate() - day + 1);
  return dayStart;
};

const truncateToUtcMonth = (date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));

const alignToGranularity = (date, granularity) => {
  if (granularity === "hourly") return truncateToUtcHour(date);
  if (granularity === "daily") return truncateToUtcDay(date);
  if (granularity === "weekly") return startOfUtcIsoWeek(date);
  return truncateToUtcMonth(date);
};

const addBucketStep = (date, granularity) => {
  const next = new Date(date.getTime());
  if (granularity === "hourly") {
    next.setUTCHours(next.getUTCHours() + 1, 0, 0, 0);
    return next;
  }
  if (granularity === "daily") {
    next.setUTCDate(next.getUTCDate() + 1);
    next.setUTCHours(0, 0, 0, 0);
    return next;
  }
  if (granularity === "weekly") {
    next.setUTCDate(next.getUTCDate() + 7);
    next.setUTCHours(0, 0, 0, 0);
    return next;
  }
  next.setUTCMonth(next.getUTCMonth() + 1, 1);
  next.setUTCHours(0, 0, 0, 0);
  return next;
};

const formattersForTimezone = (timeZone) => ({
  hour: new Intl.DateTimeFormat("en-IN", {
    timeZone,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }),
  day: new Intl.DateTimeFormat("en-IN", {
    timeZone,
    day: "2-digit",
    month: "short",
  }),
  month: new Intl.DateTimeFormat("en-IN", {
    timeZone,
    month: "short",
    year: "numeric",
  }),
});

const createTimelineBucket = (startAt, endAt, granularity, formatters) => {
  let label = formatters.day.format(startAt);
  if (granularity === "hourly") {
    label = formatters.hour.format(startAt);
  } else if (granularity === "weekly") {
    const weekEnd = new Date(endAt.getTime() - 1);
    label = `${formatters.day.format(startAt)} - ${formatters.day.format(weekEnd)}`;
  } else if (granularity === "monthly") {
    label = formatters.month.format(startAt);
  }

  return {
    key: startAt.toISOString(),
    label,
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    total: 0,
    uniqueVisitors: 0,
    uniqueSessions: 0,
    pageViews: 0,
    clicks: 0,
    apiCalls: 0,
    forms: 0,
    errors: 0,
  };
};

const buildTimelineBuckets = ({ startAt, endAt, granularity, timeZone }) => {
  const formatters = formattersForTimezone(timeZone);
  const alignedStart = alignToGranularity(startAt, granularity);

  const buckets = [];
  const map = new Map();
  let cursor = alignedStart;
  let guard = 0;

  while (cursor.getTime() <= endAt.getTime() && guard < 1600) {
    const next = addBucketStep(cursor, granularity);
    const bucket = createTimelineBucket(cursor, next, granularity, formatters);
    buckets.push(bucket);
    map.set(bucket.key, bucket);
    cursor = next;
    guard += 1;
  }

  return { buckets, map };
};

const incrementBucket = (bucket, eventType, status) => {
  if (!bucket) return;
  bucket.total += 1;
  if (eventType === "page_view") bucket.pageViews += 1;
  if (eventType === "click") bucket.clicks += 1;
  if (eventType === "api_call") bucket.apiCalls += 1;
  if (eventType === "form_submit") bucket.forms += 1;
  if (eventType === "error" || status === "failed") bucket.errors += 1;
};

const normalizePath = (path) => {
  const value = normalizeText(path, 240);
  return value || "";
};

const normalizePathname = (path) => {
  const raw = normalizePath(path);
  if (!raw) return "";
  const noHash = raw.split("#")[0] || "";
  const [pathname] = noHash.split("?");
  return normalizeText(pathname || "", 240);
};

const humanizeSlug = (slug) =>
  normalizeText(slug, 100)
    .replace(/[\-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const getPathDescriptor = (path, metadata = {}) => {
  const routeKey = normalizeText(metadata?.routeKey, 60).toLowerCase();
  const route = normalizePathname(metadata?.route || path);
  const pathname = route || normalizePathname(path);

  if (!pathname || pathname === "/") {
    return {
      path: pathname || "/",
      label: "Home Page",
    };
  }

  if (routeKey === "service_details") {
    const name = normalizeText(metadata?.serviceName || metadata?.serviceTitle, 140);
    const serviceId = normalizeText(metadata?.serviceId, 80);
    if (name) {
      return {
        path: pathname,
        label: `Service Details: ${name}`,
      };
    }
    if (serviceId) {
      return {
        path: pathname,
        label: `Service Details: ${humanizeSlug(serviceId)}`,
      };
    }
  }

  if (routeKey === "service_category") {
    const categoryKey = normalizeText(metadata?.categoryKey, 80);
    if (categoryKey) {
      return {
        path: pathname,
        label: `Service Category: ${humanizeSlug(categoryKey)}`,
      };
    }
  }

  if (pathname === "/services") {
    return { path: pathname, label: "Services Page" };
  }
  if (pathname.startsWith("/services/category/")) {
    const categoryKey = pathname.split("/")[3] || "category";
    return {
      path: pathname,
      label: `Service Category: ${humanizeSlug(categoryKey)}`,
    };
  }
  if (pathname.startsWith("/services/")) {
    const serviceId = pathname.split("/")[2] || "service";
    return {
      path: pathname,
      label: `Service Details: ${humanizeSlug(serviceId)}`,
    };
  }
  if (pathname === "/partners") return { path: pathname, label: "Partners Page" };
  if (pathname === "/projects") return { path: pathname, label: "Projects Page" };
  if (pathname === "/about-us") return { path: pathname, label: "About Us Page" };
  if (pathname === "/contact-us") return { path: pathname, label: "Contact Us Page" };
  if (pathname === "/enquiry") return { path: pathname, label: "Enquiry Page" };
  if (pathname === "/technologies") return { path: pathname, label: "Technologies Page" };
  if (pathname === "/payment-policy") return { path: pathname, label: "Payment Policy Page" };
  if (pathname.startsWith("/profile/")) return { path: pathname, label: "Partner Profile Page" };

  return {
    path: pathname,
    label: `Visited ${pathname}`,
  };
};

const normalizeInternalHref = (value) => {
  const href = normalizeText(value, 260);
  if (!href) return "";
  if (href.startsWith("/")) return normalizePathname(href);
  return "";
};

const pickActivityMetadata = (metadata) => {
  const source = toSerializableMetadata(metadata);
  return {
    route: normalizeText(source.route, 180),
    routeKey: normalizeText(source.routeKey, 80),
    href: normalizeText(source.href, 260),
    serviceId: normalizeText(source.serviceId, 100),
    serviceName: normalizeText(source.serviceName, 160),
    categoryKey: normalizeText(source.categoryKey, 120),
    title: normalizeText(source.title, 160),
  };
};

const buildActivityLabel = ({
  eventType,
  status,
  path,
  action,
  label,
  metadata,
}) => {
  const descriptor = getPathDescriptor(path, metadata);
  const safeAction = normalizeText(action, 120);
  const safeLabel = normalizeText(label, 160);

  if (eventType === "api_call") return "";

  if (eventType === "page_view") {
    return `Visited ${descriptor.label}`;
  }

  if (eventType === "session_start") {
    return "Started session";
  }

  if (eventType === "form_submit") {
    return `Submitted form on ${descriptor.label}`;
  }

  if (eventType === "click") {
    const clickText = safeLabel || safeAction || "element";
    const destinationPath = normalizeInternalHref(metadata?.href);
    if (destinationPath) {
      const destination = getPathDescriptor(destinationPath, metadata);
      return `Clicked \"${clickText}\" and opened ${destination.label}`;
    }
    return `Clicked \"${clickText}\" on ${descriptor.label}`;
  }

  if (eventType === "error" || status === "failed") {
    return `Error on ${descriptor.label}`;
  }

  if (eventType === "custom") {
    if (safeAction === "heartbeat") return "";
    if (safeAction === "service_detail_impression") {
      const serviceName = normalizeText(
        metadata?.serviceName || metadata?.serviceTitle || safeLabel,
        160,
      );
      return serviceName
        ? `Viewed service details: ${serviceName}`
        : "Viewed service details";
    }

    const customLabel = safeLabel || safeAction;
    if (customLabel) {
      return `${customLabel} on ${descriptor.label}`;
    }

    return `Custom activity on ${descriptor.label}`;
  }

  return `Activity on ${descriptor.label}`;
};

const buildActivityEntry = (event) => {
  const eventType = normalizeEventType(event.eventType);
  const status = normalizeStatus(event.status);
  const path = normalizePath(event.path);
  const action = normalizeText(event.action, 180);
  const label = normalizeText(event.label, 240);
  const occurredAt = normalizeDate(event.occurredAt).toISOString();
  const metadata = pickActivityMetadata(event.metadata);

  const activityLabel = buildActivityLabel({
    eventType,
    status,
    path,
    action,
    label,
    metadata,
  });

  if (!activityLabel) return null;

  return {
    occurredAt,
    eventType,
    status,
    path,
    action,
    label,
    activityLabel,
    pageLabel: getPathDescriptor(path, metadata).label,
    metadata,
  };
};

const deriveVisitorKey = (event) => {
  const safeSessionId = normalizeText(event?.sessionId, 80);
  const safeVisitorId = normalizeText(event?.visitorId, 80);
  if (safeVisitorId) return safeVisitorId;
  if (safeSessionId) return `session:${safeSessionId}`;
  return "";
};

const formatVisitorDisplayId = (visitorKey) => {
  const safeKey = normalizeText(visitorKey, 120);
  if (!safeKey) return "Unknown Visitor";
  if (safeKey.startsWith("session:")) {
    return `Session • ${safeKey.slice(-8)}`;
  }
  return `Visitor • ${safeKey.slice(-8)}`;
};

const toDurationSeconds = (startMs, endMs) => {
  const safeStart = Number(startMs);
  const safeEnd = Number(endMs);
  if (!Number.isFinite(safeStart) || !Number.isFinite(safeEnd)) return 0;
  if (safeEnd <= safeStart) return 0;
  return Math.round((safeEnd - safeStart) / 1000);
};

const toTopList = (entries, keyName, limit = 10) =>
  [...entries]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => ({ [keyName]: key, count }));

const mapIncomingEvent = (rawEvent, req) => {
  const event = rawEvent && typeof rawEvent === "object" ? rawEvent : {};
  return {
    sourceApp: normalizeSourceApp(event.sourceApp),
    eventType: normalizeEventType(event.eventType),
    status: normalizeStatus(event.status),
    path: normalizePath(event.path),
    action: normalizeText(event.action, 180),
    category: normalizeText(event.category, 120),
    label: normalizeText(event.label, 240),
    sessionId: normalizeText(event.sessionId, 80),
    visitorId: normalizeText(event.visitorId, 80),
    metadata: toSerializableMetadata(event.metadata),
    occurredAt: normalizeDate(event.occurredAt),
    referrer: normalizeText(event.referrer || req.get("referer"), 320),
    userAgent: normalizeText(event.userAgent || req.get("user-agent"), 400),
  };
};

const collectFrontendEvent = async (req, res) => {
  try {
    const incoming = Array.isArray(req.body?.events)
      ? req.body.events
      : Array.isArray(req.body)
        ? req.body
        : [req.body];

    if (!incoming.length) {
      return res.status(400).json({ message: "No analytics events provided" });
    }

    const cappedEvents = incoming.slice(0, 200);
    const records = cappedEvents.map((item) => mapIncomingEvent(item, req));
    await AnalyticsEvent.insertMany(records, { ordered: false });

    return res.status(201).json({
      success: true,
      recorded: records.length,
    });
  } catch (err) {
    console.error("Collect analytics event error:", err);
    return res.status(400).json({ message: err.message || "Unable to record analytics events" });
  }
};

const buildMongoFilter = ({ startAt, endAt, eventType, status }) => {
  const filter = {
    sourceApp: TRACKED_SOURCE_APP,
    occurredAt: { $gte: startAt, $lte: endAt },
  };

  if (eventType !== "all") {
    filter.eventType = eventType;
  }

  if (status !== "all") {
    filter.status = status;
  }

  return filter;
};

const applyPathFilter = (events, pathFilter) => {
  if (pathFilter === "all") return events;
  return events.filter((event) => normalizePath(event.path) === pathFilter);
};

const buildVisitorJourney = ({ events, visitorKey }) => {
  const safeVisitorKey = normalizeText(visitorKey, 120);
  if (!safeVisitorKey || !events.length) {
    return null;
  }

  const sessionIds = new Set();
  const pageSet = new Set();
  const pageCounts = new Map();

  let firstSeenMs = null;
  let lastSeenMs = null;
  let totalEvents = 0;
  let pageViews = 0;
  let clicks = 0;
  let formSubmissions = 0;
  let errors = 0;

  const activities = [];

  const sortedDesc = [...events].sort(
    (a, b) => normalizeDate(b.occurredAt).getTime() - normalizeDate(a.occurredAt).getTime(),
  );

  sortedDesc.forEach((event) => {
    const eventType = normalizeEventType(event.eventType);
    const status = normalizeStatus(event.status);
    const safePath = normalizePath(event.path) || "(no-path)";
    const occurredAtMs = normalizeDate(event.occurredAt).getTime();
    const safeSessionId = normalizeText(event.sessionId, 80);

    totalEvents += 1;
    if (eventType === "page_view") {
      pageViews += 1;
      pageSet.add(safePath);
      pageCounts.set(safePath, (pageCounts.get(safePath) || 0) + 1);
    }
    if (eventType === "click") clicks += 1;
    if (eventType === "form_submit") formSubmissions += 1;
    if (eventType === "error" || status === "failed") errors += 1;

    if (safeSessionId) sessionIds.add(safeSessionId);

    firstSeenMs = firstSeenMs === null ? occurredAtMs : Math.min(firstSeenMs, occurredAtMs);
    lastSeenMs = lastSeenMs === null ? occurredAtMs : Math.max(lastSeenMs, occurredAtMs);

    if (activities.length < MAX_VISITOR_JOURNEY_ACTIVITIES) {
      const activity = buildActivityEntry(event);
      if (activity) activities.push(activity);
    }
  });

  const pageSequence = [];
  let lastPath = "";
  const sortedAsc = [...sortedDesc].reverse();
  sortedAsc.forEach((event) => {
    const eventType = normalizeEventType(event.eventType);
    if (eventType !== "page_view") return;

    const safePath = normalizePath(event.path);
    if (!safePath || safePath === lastPath) return;

    lastPath = safePath;
    if (pageSequence.length >= MAX_PAGE_SEQUENCE_ITEMS) return;

    const metadata = pickActivityMetadata(event.metadata);
    pageSequence.push({
      occurredAt: normalizeDate(event.occurredAt).toISOString(),
      path: safePath,
      pageLabel: getPathDescriptor(safePath, metadata).label,
    });
  });

  return {
    visitorKey: safeVisitorKey,
    displayId: formatVisitorDisplayId(safeVisitorKey),
    firstSeenAt: firstSeenMs ? new Date(firstSeenMs).toISOString() : "",
    lastSeenAt: lastSeenMs ? new Date(lastSeenMs).toISOString() : "",
    durationSeconds: toDurationSeconds(firstSeenMs, lastSeenMs),
    totalEvents,
    pageViews,
    clicks,
    formSubmissions,
    errors,
    sessionCount: sessionIds.size,
    uniquePages: pageSet.size,
    topPages: toTopList(pageCounts.entries(), "path", 12),
    pageSequence,
    activities,
  };
};

const resolveDashboardRequest = (query = {}) => {
  const timeZone = resolveTimezone(query.timezone);

  const eventTypeFilterRaw = normalizeText(query.eventType, 40).toLowerCase();
  const statusFilterRaw = normalizeText(query.status, 20).toLowerCase();
  const pathFilterRaw = normalizePath(query.path);

  const eventTypeFilter =
    eventTypeFilterRaw && eventTypeFilterRaw !== "all" && EVENT_TYPES.has(eventTypeFilterRaw)
      ? eventTypeFilterRaw
      : "all";

  const statusFilter =
    statusFilterRaw && statusFilterRaw !== "all" && EVENT_STATUSES.has(statusFilterRaw)
      ? statusFilterRaw
      : "all";

  const pathFilter = pathFilterRaw && pathFilterRaw.toLowerCase() !== "all" ? pathFilterRaw : "all";

  const requestedGranularity = normalizeText(query.chartGranularity, 20).toLowerCase();

  const { startAt, endAt } = clampRange({
    startAt: parseOptionalDate(query.startAt),
    endAt: parseOptionalDate(query.endAt),
  });

  const rangeMs = endAt.getTime() - startAt.getTime();
  const granularity = resolveGranularity(requestedGranularity, rangeMs);

  return {
    timeZone,
    eventTypeFilter,
    statusFilter,
    pathFilter,
    startAt,
    endAt,
    granularity,
  };
};

const summarizeAnalytics = ({
  events,
  startAt,
  endAt,
  timeZone,
  granularity,
  baseEventsForFilters,
  appliedPathFilter,
}) => {
  const sessionSet = new Set();
  const visitorSet = new Set();
  const engagedAudienceSet = new Set();
  const bucketAudienceMap = new Map();

  const visitorsLast1HourSet = new Set();
  const visitorsLast24HoursSet = new Set();
  const visitorsLast7DaysSet = new Set();
  const sessionsLast1HourSet = new Set();
  const sessionsLast24HoursSet = new Set();
  const sessionsLast7DaysSet = new Set();

  const eventTypeCounts = new Map();
  const statusCounts = new Map();
  const topPagesMap = new Map();
  const topActionsMap = new Map();
  const topApiMap = new Map();
  const pageTrafficMap = new Map();
  const visitorMap = new Map();

  let pageViews = 0;
  let clicks = 0;
  let apiCalls = 0;
  let forms = 0;
  let errors = 0;

  const now = endAt;
  const oneHourAgoMs = now.getTime() - HOUR_MS;
  const twentyFourHoursAgoMs = now.getTime() - DAY_MS;
  const sevenDaysAgoMs = now.getTime() - WEEK_MS;
  const fiveMinutesAgoMs = now.getTime() - 5 * 60 * 1000;

  let trafficLastHour = 0;
  let trafficLast5Minutes = 0;

  const { buckets, map } = buildTimelineBuckets({
    startAt,
    endAt,
    granularity,
    timeZone,
  });

  events.forEach((event) => {
    const eventType = normalizeEventType(event.eventType);
    const status = normalizeStatus(event.status);
    const occurredAt = normalizeDate(event.occurredAt);
    const occurredAtMs = occurredAt.getTime();

    const safePath = normalizePath(event.path) || "(no-path)";
    const safeAction = normalizeText(event.action, 180);
    const safeEndpoint = normalizeText(event?.metadata?.endpoint, 220);
    const safeSessionId = normalizeText(event.sessionId, 80);
    const audienceId = deriveVisitorKey(event);

    if (eventType === "page_view") pageViews += 1;
    if (eventType === "click") clicks += 1;
    if (eventType === "api_call") apiCalls += 1;
    if (eventType === "form_submit") forms += 1;
    if (eventType === "error" || status === "failed") errors += 1;

    if (occurredAtMs >= oneHourAgoMs) trafficLastHour += 1;
    if (occurredAtMs >= fiveMinutesAgoMs) trafficLast5Minutes += 1;

    if (occurredAtMs >= oneHourAgoMs && audienceId) visitorsLast1HourSet.add(audienceId);
    if (occurredAtMs >= twentyFourHoursAgoMs && audienceId) visitorsLast24HoursSet.add(audienceId);
    if (occurredAtMs >= sevenDaysAgoMs && audienceId) visitorsLast7DaysSet.add(audienceId);

    if (occurredAtMs >= oneHourAgoMs && safeSessionId) sessionsLast1HourSet.add(safeSessionId);
    if (occurredAtMs >= twentyFourHoursAgoMs && safeSessionId) sessionsLast24HoursSet.add(safeSessionId);
    if (occurredAtMs >= sevenDaysAgoMs && safeSessionId) sessionsLast7DaysSet.add(safeSessionId);

    topPagesMap.set(safePath, (topPagesMap.get(safePath) || 0) + 1);
    if (safeAction && eventType !== "api_call") {
      topActionsMap.set(safeAction, (topActionsMap.get(safeAction) || 0) + 1);
    }
    if (safeEndpoint) topApiMap.set(safeEndpoint, (topApiMap.get(safeEndpoint) || 0) + 1);

    eventTypeCounts.set(eventType, (eventTypeCounts.get(eventType) || 0) + 1);
    statusCounts.set(status, (statusCounts.get(status) || 0) + 1);

    const pageStats = pageTrafficMap.get(safePath) || {
      path: safePath,
      total: 0,
      pageViews: 0,
      clicks: 0,
      apiCalls: 0,
      forms: 0,
      errors: 0,
    };

    pageStats.total += 1;
    if (eventType === "page_view") pageStats.pageViews += 1;
    if (eventType === "click") pageStats.clicks += 1;
    if (eventType === "api_call") pageStats.apiCalls += 1;
    if (eventType === "form_submit") pageStats.forms += 1;
    if (eventType === "error" || status === "failed") pageStats.errors += 1;
    pageTrafficMap.set(safePath, pageStats);

    if (safeSessionId) sessionSet.add(safeSessionId);
    if (audienceId) visitorSet.add(audienceId);
    if (
      audienceId &&
      (eventType === "click" || eventType === "form_submit" || eventType === "page_view")
    ) {
      engagedAudienceSet.add(audienceId);
    }

    const bucketStart = alignToGranularity(occurredAt, granularity);
    const bucket = map.get(bucketStart.toISOString());
    incrementBucket(bucket, eventType, status);
    if (bucket) {
      const tracker = bucketAudienceMap.get(bucket.key) || {
        visitors: new Set(),
        sessions: new Set(),
      };
      if (audienceId) tracker.visitors.add(audienceId);
      if (safeSessionId) tracker.sessions.add(safeSessionId);
      bucketAudienceMap.set(bucket.key, tracker);
    }

    if (audienceId) {
      const visitor = visitorMap.get(audienceId) || {
        visitorKey: audienceId,
        firstSeenMs: occurredAtMs,
        lastSeenMs: occurredAtMs,
        totalEvents: 0,
        pageViews: 0,
        clicks: 0,
        formSubmissions: 0,
        errors: 0,
        sessionIds: new Set(),
        pageCounts: new Map(),
        recentActivities: [],
        lastActivity: null,
      };

      visitor.firstSeenMs = Math.min(visitor.firstSeenMs, occurredAtMs);
      visitor.lastSeenMs = Math.max(visitor.lastSeenMs, occurredAtMs);
      visitor.totalEvents += 1;
      if (eventType === "page_view") {
        visitor.pageViews += 1;
        visitor.pageCounts.set(safePath, (visitor.pageCounts.get(safePath) || 0) + 1);
      }
      if (eventType === "click") visitor.clicks += 1;
      if (eventType === "form_submit") visitor.formSubmissions += 1;
      if (eventType === "error" || status === "failed") visitor.errors += 1;
      if (safeSessionId) visitor.sessionIds.add(safeSessionId);

      if (visitor.recentActivities.length < MAX_VISITOR_PREVIEW_ACTIVITIES) {
        const activity = buildActivityEntry(event);
        if (activity) {
          visitor.recentActivities.push(activity);
          if (!visitor.lastActivity) {
            visitor.lastActivity = activity;
          }
        }
      }

      visitorMap.set(audienceId, visitor);
    }
  });

  const eventBreakdown = [...eventTypeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([eventType, count]) => ({ eventType, count }));

  const statusBreakdown = [...statusCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([status, count]) => ({ status, count }));

  const pageTraffic = [...pageTrafficMap.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 40);

  const pathFilterOptions = [
    ...baseEventsForFilters
      .reduce((acc, event) => {
        const path = normalizePath(event.path);
        if (!path) return acc;
        acc.set(path, (acc.get(path) || 0) + 1);
        return acc;
      }, new Map())
      .entries(),
  ]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 60)
    .map(([path, count]) => ({ path, count }));

  const recentEvents = [...events]
    .sort((a, b) => normalizeDate(b.occurredAt).getTime() - normalizeDate(a.occurredAt).getTime())
    .slice(0, 50)
    .map((event) => ({
      eventType: normalizeEventType(event.eventType),
      status: normalizeStatus(event.status),
      path: normalizePath(event.path),
      action: normalizeText(event.action, 180),
      label: normalizeText(event.label, 240),
      occurredAt: normalizeDate(event.occurredAt).toISOString(),
      sourceApp: normalizeSourceApp(event.sourceApp),
    }));

  const totalAudience = visitorSet.size;
  const engagedAudience = Math.min(totalAudience, engagedAudienceSet.size);
  const passiveAudience = Math.max(totalAudience - engagedAudience, 0);
  const engagementRate = totalAudience ? (engagedAudience / totalAudience) * 100 : 0;
  const searchIntensity = events.length ? (apiCalls / events.length) * 100 : 0;

  const timeline = buckets.map((bucket) => {
    const tracker = bucketAudienceMap.get(bucket.key);
    return {
      ...bucket,
      uniqueVisitors: tracker?.visitors?.size || 0,
      uniqueSessions: tracker?.sessions?.size || 0,
    };
  });

  const visitorOverviewItems = [...visitorMap.values()]
    .map((visitor) => ({
      visitorKey: visitor.visitorKey,
      displayId: formatVisitorDisplayId(visitor.visitorKey),
      firstSeenAt: new Date(visitor.firstSeenMs).toISOString(),
      lastSeenAt: new Date(visitor.lastSeenMs).toISOString(),
      durationSeconds: toDurationSeconds(visitor.firstSeenMs, visitor.lastSeenMs),
      totalEvents: visitor.totalEvents,
      pageViews: visitor.pageViews,
      clicks: visitor.clicks,
      formSubmissions: visitor.formSubmissions,
      errors: visitor.errors,
      sessionCount: visitor.sessionIds.size,
      uniquePages: visitor.pageCounts.size,
      topPages: toTopList(visitor.pageCounts.entries(), "path", 4),
      lastActivity: visitor.lastActivity,
      recentActivities: visitor.recentActivities,
    }))
    .sort(
      (a, b) =>
        normalizeDate(b.lastSeenAt).getTime() - normalizeDate(a.lastSeenAt).getTime(),
    );

  return {
    generatedAt: new Date().toISOString(),
    timezone: timeZone,
    filtersApplied: {
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      chartGranularity: granularity,
      path: appliedPathFilter,
    },
    summary: {
      totalEvents: events.length,
      uniqueSessions: sessionSet.size,
      uniqueVisitors: totalAudience,
      pageViews,
      clicks,
      apiCalls,
      formSubmissions: forms,
      errors,
      trafficLastHour,
      trafficLast5Minutes,
      engagedAudience,
      passiveAudience,
      engagementRate,
      searchIntensity,
      visitorsLast1Hour: visitorsLast1HourSet.size,
      visitorsLast24Hours: visitorsLast24HoursSet.size,
      visitorsLast7Days: visitorsLast7DaysSet.size,
      sessionsLast1Hour: sessionsLast1HourSet.size,
      sessionsLast24Hours: sessionsLast24HoursSet.size,
      sessionsLast7Days: sessionsLast7DaysSet.size,
    },
    cohortCounts: {
      visitorsLast1Hour: visitorsLast1HourSet.size,
      visitorsLast24Hours: visitorsLast24HoursSet.size,
      visitorsLast7Days: visitorsLast7DaysSet.size,
      sessionsLast1Hour: sessionsLast1HourSet.size,
      sessionsLast24Hours: sessionsLast24HoursSet.size,
      sessionsLast7Days: sessionsLast7DaysSet.size,
    },
    timeline,
    topPages: toTopList(topPagesMap.entries(), "path", 12),
    topActions: toTopList(topActionsMap.entries(), "action", 12),
    topApiEndpoints: toTopList(topApiMap.entries(), "endpoint", 12),
    eventBreakdown,
    statusBreakdown,
    pageTraffic,
    recentEvents,
    visitorOverview: {
      totalVisitors: visitorOverviewItems.length,
      truncated: visitorOverviewItems.length > MAX_VISITOR_OVERVIEW,
      items: visitorOverviewItems.slice(0, MAX_VISITOR_OVERVIEW),
    },
    availableFilters: {
      paths: pathFilterOptions,
      eventTypes: [...EVENT_TYPES],
      statuses: ["all", ...EVENT_STATUSES],
    },
  };
};

const getOwnerAnalyticsDashboard = async (req, res) => {
  if (!hasOwnerAccess(req)) {
    return res.status(403).json({ message: "Only owner can access analytics dashboard" });
  }

  try {
    const {
      timeZone,
      eventTypeFilter,
      statusFilter,
      pathFilter,
      startAt,
      endAt,
      granularity,
    } = resolveDashboardRequest(req.query || {});

    const mongoFilter = buildMongoFilter({
      startAt,
      endAt,
      eventType: eventTypeFilter,
      status: statusFilter,
    });

    const baseEvents = await AnalyticsEvent.find(mongoFilter)
      .select("eventType status path action label metadata sessionId visitorId occurredAt sourceApp")
      .sort({ occurredAt: -1 })
      .limit(MAX_QUERY_LIMIT)
      .lean();

    const filteredEvents = applyPathFilter(baseEvents, pathFilter);

    const analytics = summarizeAnalytics({
      events: filteredEvents,
      startAt,
      endAt,
      timeZone,
      granularity,
      baseEventsForFilters: baseEvents,
      appliedPathFilter: pathFilter,
    });

    return res.json({ analytics });
  } catch (err) {
    console.error("Owner analytics fetch error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

const getOwnerVisitorJourney = async (req, res) => {
  if (!hasOwnerAccess(req)) {
    return res.status(403).json({ message: "Only owner can access analytics dashboard" });
  }

  try {
    const visitorKey = normalizeText(req.query?.visitor, 120);
    if (!visitorKey) {
      return res.status(400).json({ message: "visitor query is required" });
    }

    const {
      timeZone,
      eventTypeFilter,
      statusFilter,
      pathFilter,
      startAt,
      endAt,
      granularity,
    } = resolveDashboardRequest(req.query || {});

    const mongoFilter = buildMongoFilter({
      startAt,
      endAt,
      eventType: eventTypeFilter,
      status: statusFilter,
    });

    const baseEvents = await AnalyticsEvent.find(mongoFilter)
      .select("eventType status path action label metadata sessionId visitorId occurredAt sourceApp")
      .sort({ occurredAt: -1 })
      .limit(MAX_QUERY_LIMIT)
      .lean();

    const pathFilteredEvents = applyPathFilter(baseEvents, pathFilter);
    const visitorEvents = pathFilteredEvents.filter((event) => deriveVisitorKey(event) === visitorKey);

    const visitorJourney = buildVisitorJourney({
      events: visitorEvents,
      visitorKey,
    });

    return res.json({
      visitorJourney,
      timezone: timeZone,
      filtersApplied: {
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        chartGranularity: granularity,
        path: pathFilter,
        eventType: eventTypeFilter,
        status: statusFilter,
      },
    });
  } catch (err) {
    console.error("Owner visitor journey fetch error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  collectFrontendEvent,
  getOwnerAnalyticsDashboard,
  getOwnerVisitorJourney,
};
