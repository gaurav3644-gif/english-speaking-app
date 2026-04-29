const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const STORE_PATH = path.join(__dirname, "data", "app-state.json");
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_TTL_SECONDS = Math.floor(SESSION_TTL_MS / 1000);
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const EVENT_RETENTION_MS = 366 * 24 * 60 * 60 * 1000;
const MAX_EVENT_COUNT = 50000;
const OTP_ECHO_TO_RESPONSE = process.env.OTP_ECHO_TO_RESPONSE === "1";
const DEFAULT_ADMIN_CONTACTS = ["gaurav3644@gmail.com"];

const BASE_USAGE_COUNTERS = Object.freeze({
  logins: 0,
  guestLogins: 0,
  otpLogins: 0,
  otpRequests: 0,
  lessonsLoaded: 0,
  attempts: 0,
  correctAttempts: 0,
  typedAttempts: 0,
  audioAttempts: 0,
  recordingsStarted: 0,
  lessonCompletions: 0,
  sentenceSkips: 0,
  narrationRequests: 0,
  feedbackAudioRequests: 0,
  realtimeTokens: 0
});

let cachedStore = null;

function createStoreError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function nowIso() {
  return new Date().toISOString();
}

function cloneUsageCounters(existing = {}) {
  return {
    ...BASE_USAGE_COUNTERS,
    ...existing
  };
}

function defaultStore() {
  return {
    version: 1,
    users: [],
    sessions: [],
    otpChallenges: [],
    events: []
  };
}

function ensureStoreShape(rawStore) {
  const store = rawStore && typeof rawStore === "object" ? rawStore : {};
  const normalizedStore = {
    version: 1,
    users: Array.isArray(store.users) ? store.users : [],
    sessions: Array.isArray(store.sessions) ? store.sessions : [],
    otpChallenges: Array.isArray(store.otpChallenges) ? store.otpChallenges : [],
    events: Array.isArray(store.events) ? store.events : []
  };

  normalizedStore.users = normalizedStore.users.map((user) => ({
    id: String(user.id || crypto.randomUUID()),
    name: String(user.name || "").trim(),
    location: String(user.location || "").trim(),
    contact: String(user.contact || "").trim(),
    guestKey: String(user.guestKey || "").trim(),
    authMethods: Array.isArray(user.authMethods) ? [...new Set(user.authMethods.map(String))] : [],
    createdAt: String(user.createdAt || nowIso()),
    lastLoginAt: String(user.lastLoginAt || user.createdAt || nowIso()),
    lastSeenAt: String(user.lastSeenAt || user.lastLoginAt || user.createdAt || nowIso()),
    usage: cloneUsageCounters(user.usage)
  }));

  return normalizedStore;
}

function loadStore() {
  if (cachedStore) {
    return cachedStore;
  }

  if (!fs.existsSync(STORE_PATH)) {
    cachedStore = defaultStore();
    return cachedStore;
  }

  try {
    const fileContents = fs.readFileSync(STORE_PATH, "utf8");
    cachedStore = ensureStoreShape(JSON.parse(fileContents));
  } catch {
    cachedStore = defaultStore();
  }

  return cachedStore;
}

function saveStore(store) {
  const normalizedStore = ensureStoreShape(store);
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  const tempPath = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(normalizedStore, null, 2), "utf8");
  fs.renameSync(tempPath, STORE_PATH);
  cachedStore = normalizedStore;
}

function normalizeText(value, maxLength = 80) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function normalizeContact(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "");
}

function getConfiguredAdminContacts() {
  return new Set(
    String(process.env.ADMIN_EMAILS || DEFAULT_ADMIN_CONTACTS.join(","))
      .split(",")
      .map((value) => normalizeContact(value))
      .filter(Boolean)
  );
}

function isAdminContact(contact) {
  return getConfiguredAdminContacts().has(normalizeContact(contact));
}

function buildUserSnapshot(user, options = {}) {
  const includeUsage = options.includeUsage === true;
  const includeRawContact = options.includeRawContact === true;

  const snapshot = {
    id: user.id,
    name: user.name,
    location: user.location,
    contactMasked: sanitizeContact(user.contact),
    authMethods: [...user.authMethods],
    isAdmin: isAdminContact(user.contact),
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    lastSeenAt: user.lastSeenAt
  };

  if (includeRawContact) {
    snapshot.contact = String(user.contact || "").trim();
  }

  if (includeUsage) {
    snapshot.usage = cloneUsageCounters(user.usage);
  }

  return snapshot;
}

function normalizeGuestKey(name, location) {
  return `${normalizeText(name, 80).toLowerCase()}::${normalizeText(location, 80).toLowerCase()}`;
}

function hashOtpCode(code) {
  return crypto.createHash("sha256").update(String(code || "")).digest("hex");
}

function generateOtpCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

function appendAuthMethod(user, method) {
  if (!user.authMethods.includes(method)) {
    user.authMethods.push(method);
  }
}

function sanitizeContact(contact) {
  const normalized = normalizeContact(contact);
  if (!normalized) {
    return "";
  }

  if (normalized.includes("@")) {
    const [localPart, domainPart] = normalized.split("@");
    const visibleLocal = localPart.slice(0, 2) || localPart.slice(0, 1) || "*";
    return `${visibleLocal}${"*".repeat(Math.max(localPart.length - visibleLocal.length, 2))}@${domainPart}`;
  }

  const lastFour = normalized.slice(-4);
  return `${"*".repeat(Math.max(normalized.length - 4, 4))}${lastFour}`;
}

function buildSessionPayload(user, session) {
  return {
    authenticated: true,
    user: buildUserSnapshot(user),
    session: {
      id: session.id,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt
    }
  };
}

function touchSessionAndUser(store, session, user, touchedAt) {
  session.lastSeenAt = touchedAt;
  user.lastSeenAt = touchedAt;
}

function pruneStore(store) {
  const now = Date.now();

  store.sessions = store.sessions.filter((session) => {
    const expiresAt = Date.parse(session.expiresAt || "");
    return Number.isFinite(expiresAt) && expiresAt > now;
  });

  store.otpChallenges = store.otpChallenges.filter((challenge) => {
    const expiresAt = Date.parse(challenge.expiresAt || "");
    const verifiedAt = Date.parse(challenge.verifiedAt || "");
    if (Number.isFinite(expiresAt) && expiresAt > now) {
      return true;
    }

    if (Number.isFinite(verifiedAt) && now - verifiedAt < 60 * 60 * 1000) {
      return true;
    }

    return false;
  });

  const retentionThreshold = now - EVENT_RETENTION_MS;
  store.events = store.events.filter((event) => {
    const timestamp = Date.parse(event.timestamp || "");
    return Number.isFinite(timestamp) && timestamp >= retentionThreshold;
  });

  if (store.events.length > MAX_EVENT_COUNT) {
    store.events = store.events.slice(store.events.length - MAX_EVENT_COUNT);
  }
}

function createSession(store, user) {
  const createdAt = nowIso();
  const session = {
    id: crypto.randomUUID(),
    userId: user.id,
    createdAt,
    lastSeenAt: createdAt,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString()
  };
  store.sessions.push(session);
  user.lastLoginAt = createdAt;
  user.lastSeenAt = createdAt;
  return session;
}

function getMetricDeltaForEvent(type, metadata = {}) {
  const counters = cloneUsageCounters();

  switch (type) {
    case "guest_login":
      counters.logins = 1;
      counters.guestLogins = 1;
      break;
    case "otp_request":
      counters.otpRequests = 1;
      break;
    case "otp_verified":
      counters.logins = 1;
      counters.otpLogins = 1;
      break;
    case "lesson_loaded":
      counters.lessonsLoaded = 1;
      break;
    case "attempt_submitted":
      counters.attempts = 1;
      if (metadata.inputMethod === "typed") {
        counters.typedAttempts = 1;
      }
      if (metadata.inputMethod === "audio") {
        counters.audioAttempts = 1;
      }
      if (metadata.passed) {
        counters.correctAttempts = 1;
      }
      break;
    case "recording_started":
      counters.recordingsStarted = 1;
      break;
    case "lesson_completed":
      counters.lessonCompletions = 1;
      break;
    case "sentence_skipped":
      counters.sentenceSkips = 1;
      break;
    case "narration_requested":
      counters.narrationRequests = 1;
      break;
    case "feedback_audio_requested":
      counters.feedbackAudioRequests = 1;
      break;
    case "realtime_token_issued":
      counters.realtimeTokens = 1;
      break;
    default:
      break;
  }

  return counters;
}

function applyUsageDelta(targetUsage, delta) {
  for (const [key, value] of Object.entries(delta)) {
    targetUsage[key] = Number(targetUsage[key] || 0) + Number(value || 0);
  }
}

function recordEventOnStore(store, { type, userId = "", metadata = {} }) {
  const event = {
    id: crypto.randomUUID(),
    type: String(type || "").trim(),
    userId: String(userId || "").trim(),
    timestamp: nowIso(),
    metadata: metadata && typeof metadata === "object" ? metadata : {}
  };

  if (!event.type) {
    return null;
  }

  store.events.push(event);

  if (event.userId) {
    const user = store.users.find((entry) => entry.id === event.userId);
    if (user) {
      applyUsageDelta(user.usage, getMetricDeltaForEvent(event.type, event.metadata));
      user.lastSeenAt = event.timestamp;
    }
  }

  return event;
}

function deriveDefaultNameFromContact(contact) {
  const normalized = normalizeContact(contact);
  if (normalized.includes("@")) {
    return normalizeText(normalized.split("@")[0], 60) || "OTP user";
  }

  const lastFour = normalized.slice(-4);
  return lastFour ? `User ${lastFour}` : "OTP user";
}

function findGuestUser(store, guestKey) {
  return store.users.find((user) => user.guestKey && user.guestKey === guestKey);
}

function findUserByContact(store, contact) {
  return store.users.find((user) => normalizeContact(user.contact) === contact);
}

function createGuestSession(profile) {
  const store = loadStore();
  pruneStore(store);

  const name = normalizeText(profile?.name, 80);
  const location = normalizeText(profile?.location, 80);

  if (!name) {
    throw createStoreError(400, "Guest name is required.");
  }

  if (!location) {
    throw createStoreError(400, "Guest location is required.");
  }

  const guestKey = normalizeGuestKey(name, location);
  let user = findGuestUser(store, guestKey);

  if (!user) {
    user = {
      id: crypto.randomUUID(),
      name,
      location,
      contact: "",
      guestKey,
      authMethods: ["guest"],
      createdAt: nowIso(),
      lastLoginAt: nowIso(),
      lastSeenAt: nowIso(),
      usage: cloneUsageCounters()
    };
    store.users.push(user);
  } else {
    user.name = name;
    user.location = location;
    appendAuthMethod(user, "guest");
  }

  const session = createSession(store, user);
  recordEventOnStore(store, {
    type: "guest_login",
    userId: user.id,
    metadata: {
      location
    }
  });
  saveStore(store);
  return {
    sessionId: session.id,
    session: buildSessionPayload(user, session)
  };
}

function createOtpChallenge(input) {
  const store = loadStore();
  pruneStore(store);

  const contact = normalizeContact(input?.contact);
  const name = normalizeText(input?.name, 80);
  const location = normalizeText(input?.location, 80);

  if (!contact || contact.length < 4) {
    throw createStoreError(400, "Phone number or email is required for OTP login.");
  }

  const code = generateOtpCode();
  const challenge = {
    id: crypto.randomUUID(),
    contact,
    codeHash: hashOtpCode(code),
    createdAt: nowIso(),
    expiresAt: new Date(Date.now() + OTP_TTL_MS).toISOString(),
    attempts: 0,
    maxAttempts: OTP_MAX_ATTEMPTS,
    nameHint: name,
    locationHint: location,
    verifiedAt: ""
  };

  store.otpChallenges.push(challenge);
  const existingUser = findUserByContact(store, contact);
  recordEventOnStore(store, {
    type: "otp_request",
    userId: existingUser?.id || "",
    metadata: {
      channel: contact.includes("@") ? "email" : "phone"
    }
  });
  saveStore(store);
  return {
    challengeId: challenge.id,
    expiresAt: challenge.expiresAt,
    code,
    delivery: "console",
    channel: contact.includes("@") ? "email" : "phone"
  };
}

function verifyOtpChallenge(input) {
  const store = loadStore();
  pruneStore(store);

  const challengeId = normalizeText(input?.challengeId, 120);
  const code = normalizeText(input?.code, 12);
  const name = normalizeText(input?.name, 80);
  const location = normalizeText(input?.location, 80);

  if (!challengeId) {
    throw createStoreError(400, "OTP challenge is missing.");
  }

  if (!code) {
    throw createStoreError(400, "OTP code is required.");
  }

  const challenge = store.otpChallenges.find((entry) => entry.id === challengeId);
  if (!challenge) {
    throw createStoreError(404, "OTP challenge not found. Request a new OTP.");
  }

  if (challenge.verifiedAt) {
    throw createStoreError(409, "This OTP has already been used. Request a new one.");
  }

  if (Date.parse(challenge.expiresAt || "") <= Date.now()) {
    throw createStoreError(410, "OTP expired. Request a new code.");
  }

  challenge.attempts = Number(challenge.attempts || 0) + 1;
  if (challenge.attempts > Number(challenge.maxAttempts || OTP_MAX_ATTEMPTS)) {
    saveStore(store);
    throw createStoreError(429, "Too many incorrect OTP attempts. Request a new code.");
  }

  if (challenge.codeHash !== hashOtpCode(code)) {
    saveStore(store);
    throw createStoreError(401, "Incorrect OTP code. Please try again.");
  }

  challenge.verifiedAt = nowIso();
  const contact = normalizeContact(challenge.contact);
  let user = findUserByContact(store, contact);

  if (!user) {
    user = {
      id: crypto.randomUUID(),
      name: name || challenge.nameHint || deriveDefaultNameFromContact(contact),
      location: location || challenge.locationHint || "",
      contact,
      guestKey: "",
      authMethods: ["otp"],
      createdAt: nowIso(),
      lastLoginAt: nowIso(),
      lastSeenAt: nowIso(),
      usage: cloneUsageCounters()
    };
    store.users.push(user);
  } else {
    user.contact = contact;
    if (name) {
      user.name = name;
    } else if (!user.name) {
      user.name = challenge.nameHint || deriveDefaultNameFromContact(contact);
    }

    if (location) {
      user.location = location;
    } else if (!user.location && challenge.locationHint) {
      user.location = challenge.locationHint;
    }

    appendAuthMethod(user, "otp");
  }

  const session = createSession(store, user);
  recordEventOnStore(store, {
    type: "otp_verified",
    userId: user.id,
    metadata: {
      channel: contact.includes("@") ? "email" : "phone"
    }
  });
  saveStore(store);
  return {
    sessionId: session.id,
    session: buildSessionPayload(user, session)
  };
}

function getSessionContext(sessionId, options = {}) {
  const normalizedSessionId = normalizeText(sessionId, 120);
  if (!normalizedSessionId) {
    return null;
  }

  const store = loadStore();
  pruneStore(store);

  const session = store.sessions.find((entry) => entry.id === normalizedSessionId);
  if (!session) {
    saveStore(store);
    return null;
  }

  const user = store.users.find((entry) => entry.id === session.userId);
  if (!user) {
    store.sessions = store.sessions.filter((entry) => entry.id !== normalizedSessionId);
    saveStore(store);
    return null;
  }

  if (options.touch !== false) {
    touchSessionAndUser(store, session, user, nowIso());
    saveStore(store);
  } else {
    saveStore(store);
  }

  return {
    sessionId: session.id,
    userId: user.id,
    session: buildSessionPayload(user, session)
  };
}

function clearSession(sessionId) {
  const normalizedSessionId = normalizeText(sessionId, 120);
  if (!normalizedSessionId) {
    return;
  }

  const store = loadStore();
  pruneStore(store);
  store.sessions = store.sessions.filter((entry) => entry.id !== normalizedSessionId);
  saveStore(store);
}

function recordUsageEvent(userId, type, metadata = {}) {
  const normalizedUserId = normalizeText(userId, 120);
  const normalizedType = normalizeText(type, 80);
  if (!normalizedUserId || !normalizedType) {
    return;
  }

  const store = loadStore();
  pruneStore(store);
  recordEventOnStore(store, {
    userId: normalizedUserId,
    type: normalizedType,
    metadata
  });
  saveStore(store);
}

function summarizeEvents(events, startTime) {
  const summary = cloneUsageCounters();
  const activeUsers = new Set();

  for (const event of events) {
    const timestamp = Date.parse(event.timestamp || "");
    if (!Number.isFinite(timestamp)) {
      continue;
    }

    if (typeof startTime === "number" && timestamp < startTime) {
      continue;
    }

    if (event.userId) {
      activeUsers.add(event.userId);
    }

    applyUsageDelta(summary, getEventMetricDeltaForEvent(event.type, event.metadata));
  }

  return {
    ...summary,
    activeUsers: activeUsers.size
  };
}

function getStartOfToday() {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  return value.getTime();
}

function getStartOfWeek() {
  const value = new Date();
  const currentDay = value.getDay();
  const distanceToMonday = (currentDay + 6) % 7;
  value.setDate(value.getDate() - distanceToMonday);
  value.setHours(0, 0, 0, 0);
  return value.getTime();
}

function getStartOfMonth() {
  const value = new Date();
  value.setDate(1);
  value.setHours(0, 0, 0, 0);
  return value.getTime();
}

function getUsageDashboard(userId) {
  const normalizedUserId = normalizeText(userId, 120);
  if (!normalizedUserId) {
    throw createStoreError(400, "User context is missing.");
  }

  const store = loadStore();
  pruneStore(store);

  const user = store.users.find((entry) => entry.id === normalizedUserId);
  if (!user) {
    saveStore(store);
    throw createStoreError(404, "User not found.");
  }

  const dashboard = {
    currentUser: buildUserSnapshot(user, { includeUsage: true }),
    topUsers: store.users
      .map((entry) => buildUserSnapshot(entry, { includeUsage: true }))
      .sort((left, right) => {
        const attemptDelta = Number(right.usage.attempts || 0) - Number(left.usage.attempts || 0);
        if (attemptDelta !== 0) {
          return attemptDelta;
        }

        const lessonDelta =
          Number(right.usage.lessonsLoaded || 0) - Number(left.usage.lessonsLoaded || 0);
        if (lessonDelta !== 0) {
          return lessonDelta;
        }

        return Number(right.usage.logins || 0) - Number(left.usage.logins || 0);
      })
      .slice(0, 6),
    overall: {
      today: summarizeEvents(store.events, getStartOfToday()),
      week: summarizeEvents(store.events, getStartOfWeek()),
      month: summarizeEvents(store.events, getStartOfMonth()),
      allTime: summarizeEvents(store.events)
    }
  };

  saveStore(store);
  return dashboard;
}

function summarizeUserRanking(left, right) {
  const attemptDelta = Number(right.usage?.attempts || 0) - Number(left.usage?.attempts || 0);
  if (attemptDelta !== 0) {
    return attemptDelta;
  }

  const lessonDelta =
    Number(right.usage?.lessonsLoaded || 0) - Number(left.usage?.lessonsLoaded || 0);
  if (lessonDelta !== 0) {
    return lessonDelta;
  }

  return Number(right.usage?.logins || 0) - Number(left.usage?.logins || 0);
}

function getAdminDashboard() {
  const store = loadStore();
  pruneStore(store);

  const usersById = new Map(store.users.map((entry) => [entry.id, entry]));
  const users = store.users
    .map((entry) => buildUserSnapshot(entry, { includeUsage: true, includeRawContact: true }))
    .sort(summarizeUserRanking);

  const recentEvents = [...store.events]
    .slice(-80)
    .reverse()
    .map((event) => {
      const user = usersById.get(event.userId);
      return {
        id: event.id,
        type: event.type,
        timestamp: event.timestamp,
        metadata: event.metadata && typeof event.metadata === "object" ? { ...event.metadata } : {},
        user: user ? buildUserSnapshot(user, { includeRawContact: true }) : null
      };
    });

  const dashboard = {
    generatedAt: nowIso(),
    totals: {
      users: store.users.length,
      activeSessions: store.sessions.length,
      pendingOtpChallenges: store.otpChallenges.length,
      storedEvents: store.events.length
    },
    overall: {
      today: summarizeEvents(store.events, getStartOfToday()),
      week: summarizeEvents(store.events, getStartOfWeek()),
      month: summarizeEvents(store.events, getStartOfMonth()),
      allTime: summarizeEvents(store.events)
    },
    users,
    recentEvents
  };

  saveStore(store);
  return dashboard;
}

module.exports = {
  OTP_ECHO_TO_RESPONSE,
  SESSION_TTL_SECONDS,
  clearSession,
  createGuestSession,
  createOtpChallenge,
  getAdminDashboard,
  getSessionContext,
  getUsageDashboard,
  recordUsageEvent,
  sanitizeContact,
  verifyOtpChallenge
};
