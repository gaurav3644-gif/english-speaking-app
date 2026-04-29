const elements = {
  accessCard: document.querySelector("#adminAccessCard"),
  accessTitle: document.querySelector("#adminAccessTitle"),
  accessMessage: document.querySelector("#adminAccessMessage"),
  dashboard: document.querySelector("#adminDashboard"),
  sessionMeta: document.querySelector("#adminSessionMeta"),
  generatedAt: document.querySelector("#adminGeneratedAt"),
  totalUsersValue: document.querySelector("#totalUsersValue"),
  activeSessionsValue: document.querySelector("#activeSessionsValue"),
  pendingOtpValue: document.querySelector("#pendingOtpValue"),
  storedEventsValue: document.querySelector("#storedEventsValue"),
  todayUsageValue: document.querySelector("#todayUsageValue"),
  todayUsageMeta: document.querySelector("#todayUsageMeta"),
  weekUsageValue: document.querySelector("#weekUsageValue"),
  weekUsageMeta: document.querySelector("#weekUsageMeta"),
  monthUsageValue: document.querySelector("#monthUsageValue"),
  monthUsageMeta: document.querySelector("#monthUsageMeta"),
  allTimeUsageValue: document.querySelector("#allTimeUsageValue"),
  allTimeUsageMeta: document.querySelector("#allTimeUsageMeta"),
  usersTableBody: document.querySelector("#adminUsersTableBody"),
  eventsList: document.querySelector("#adminEventsList"),
  logoutButton: document.querySelector("#adminLogoutButton")
};

function formatNumber(value) {
  return new Intl.NumberFormat("en-IN").format(Number(value || 0));
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDateTime(value) {
  const timestamp = Date.parse(value || "");
  if (!Number.isFinite(timestamp)) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(timestamp);
}

function pluralize(value, singular, plural = `${singular}s`) {
  const normalizedValue = Number(value || 0);
  return `${formatNumber(normalizedValue)} ${normalizedValue === 1 ? singular : plural}`;
}

function formatDurationCompact(totalSeconds) {
  const normalizedSeconds = Math.max(0, Math.round(Number(totalSeconds || 0)));
  const hours = Math.floor(normalizedSeconds / 3600);
  const minutes = Math.floor((normalizedSeconds % 3600) / 60);
  const seconds = normalizedSeconds % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return seconds > 0 ? `${seconds}s` : "0m";
}

function formatWindowSummary(valueElement, metaElement, summary) {
  if (valueElement) {
    valueElement.textContent = pluralize(summary?.attempts || 0, "attempt");
  }

  if (metaElement) {
    metaElement.textContent =
      `${pluralize(summary?.activeUsers || 0, "user")} | ` +
      `${pluralize(summary?.lessonsLoaded || 0, "lesson")} | ` +
      `${pluralize(summary?.logins || 0, "login")} | ` +
      `${formatDurationCompact(summary?.activeSeconds || 0)}`;
  }
}

function formatEventType(type) {
  return String(type || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatMetadata(metadata) {
  const entries = Object.entries(metadata || {}).filter(([, value]) => value !== "" && value != null);
  if (!entries.length) {
    return "No extra metadata";
  }

  return entries
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" | ");
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {})
    },
    ...options
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || `Request failed with status ${response.status}.`);
  }

  return payload;
}

function showAccessState(title, message) {
  if (elements.accessCard) {
    elements.accessCard.hidden = false;
  }
  if (elements.dashboard) {
    elements.dashboard.hidden = true;
  }
  if (elements.accessTitle) {
    elements.accessTitle.textContent = title;
  }
  if (elements.accessMessage) {
    elements.accessMessage.textContent = message;
  }
}

function showDashboard() {
  if (elements.accessCard) {
    elements.accessCard.hidden = true;
  }
  if (elements.dashboard) {
    elements.dashboard.hidden = false;
  }
}

function renderUsers(users = []) {
  if (!elements.usersTableBody) {
    return;
  }

  if (!Array.isArray(users) || !users.length) {
    elements.usersTableBody.innerHTML = '<tr><td colspan="10">No users have been created yet.</td></tr>';
    return;
  }

  elements.usersTableBody.innerHTML = users
    .map((user) => {
      const userMeta = [user.location, user.isAdmin ? "Admin" : ""].filter(Boolean).join(" | ");
      return `
        <tr>
          <td>
            <div class="admin-user-cell">
              <strong>${escapeHtml(user.name || "Unnamed user")}</strong>
              <span>${escapeHtml(userMeta || "No location")}</span>
            </div>
          </td>
          <td>${escapeHtml(user.contact || user.contactMasked || "Guest only")}</td>
          <td>${escapeHtml((user.authMethods || []).join(", ") || "guest")}</td>
          <td>${formatNumber(user.usage?.logins || 0)}</td>
          <td>${formatNumber(user.usage?.lessonsLoaded || 0)}</td>
          <td>${formatNumber(user.usage?.attempts || 0)}</td>
          <td>${formatNumber(user.usage?.correctAttempts || 0)}</td>
          <td>${escapeHtml(formatDurationCompact(user.usage?.activeSeconds || 0))}</td>
          <td>${escapeHtml(formatDateTime(user.lastLoginAt))}</td>
          <td>${escapeHtml(formatDateTime(user.lastSeenAt))}</td>
        </tr>
      `;
    })
    .join("");
}

function renderEvents(events = []) {
  if (!elements.eventsList) {
    return;
  }

  if (!Array.isArray(events) || !events.length) {
    elements.eventsList.innerHTML = '<p class="usage-leaderboard-empty">No events have been recorded yet.</p>';
    return;
  }

  elements.eventsList.innerHTML = events
    .map((event) => {
      const user = event.user || null;
      const userLabel = user?.name || user?.contact || user?.contactMasked || "Unknown user";
      const userMeta = [user?.location, user?.contactMasked].filter(Boolean).join(" | ");
      return `
        <article class="admin-event">
          <div class="admin-event-head">
            <div class="admin-event-copy">
              <strong>${escapeHtml(formatEventType(event.type))}</strong>
              <span>${escapeHtml(userLabel)}</span>
            </div>
            <span class="admin-event-time">${escapeHtml(formatDateTime(event.timestamp))}</span>
          </div>
          <p class="admin-event-meta">${escapeHtml(userMeta || "No user metadata")}</p>
          <p class="admin-event-meta">${escapeHtml(formatMetadata(event.metadata))}</p>
        </article>
      `;
    })
    .join("");
}

function renderDashboard(sessionPayload, dashboard) {
  if (elements.sessionMeta) {
    const user = sessionPayload?.user || {};
    const session = sessionPayload?.session || {};
    const metaParts = [
      user.name,
      user.contactMasked,
      user.location,
      session.createdAt ? `Session started ${formatDateTime(session.createdAt)}` : "",
      session.expiresAt ? `Expires ${formatDateTime(session.expiresAt)}` : ""
    ].filter(Boolean);
    elements.sessionMeta.textContent = metaParts.join(" | ");
  }

  if (elements.generatedAt) {
    elements.generatedAt.textContent = `Updated ${formatDateTime(dashboard?.generatedAt)}`;
  }

  if (elements.totalUsersValue) {
    elements.totalUsersValue.textContent = formatNumber(dashboard?.totals?.users || 0);
  }
  if (elements.activeSessionsValue) {
    elements.activeSessionsValue.textContent = formatNumber(dashboard?.totals?.activeSessions || 0);
  }
  if (elements.pendingOtpValue) {
    elements.pendingOtpValue.textContent = formatNumber(dashboard?.totals?.pendingOtpChallenges || 0);
  }
  if (elements.storedEventsValue) {
    elements.storedEventsValue.textContent = formatNumber(dashboard?.totals?.storedEvents || 0);
  }

  formatWindowSummary(elements.todayUsageValue, elements.todayUsageMeta, dashboard?.overall?.today);
  formatWindowSummary(elements.weekUsageValue, elements.weekUsageMeta, dashboard?.overall?.week);
  formatWindowSummary(elements.monthUsageValue, elements.monthUsageMeta, dashboard?.overall?.month);
  formatWindowSummary(elements.allTimeUsageValue, elements.allTimeUsageMeta, dashboard?.overall?.allTime);

  renderUsers(dashboard?.users);
  renderEvents(dashboard?.recentEvents);
}

async function logout() {
  try {
    await fetchJson("/api/auth/logout", {
      method: "POST"
    });
  } finally {
    window.location.href = "/";
  }
}

async function boot() {
  showAccessState(
    "Checking access",
    "Validating the current session before loading usage analytics."
  );

  try {
    const sessionPayload = await fetchJson("/api/auth/session");
    if (!sessionPayload?.authenticated) {
      showAccessState(
        "Sign in required",
        "Sign in on the main app first, then reopen the admin page."
      );
      return;
    }

    if (!sessionPayload?.user?.isAdmin) {
      showAccessState(
        "Access denied",
        "This signed-in account is not allowed to open the admin dashboard."
      );
      return;
    }

    const dashboard = await fetchJson("/api/admin/stats");
    renderDashboard(sessionPayload, dashboard);
    showDashboard();
  } catch (error) {
    showAccessState(
      "Admin dashboard unavailable",
      error instanceof Error ? error.message : "The admin dashboard could not be loaded."
    );
  }
}

elements.logoutButton?.addEventListener("click", () => {
  void logout();
});

void boot();
