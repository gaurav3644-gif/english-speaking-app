const state = {
  isAuthenticated: false,
  isAuthBusy: false,
  isAuthModalOpen: false,
  authMode: "guest",
  sessionUser: null,
  otpChallengeId: "",
  lesson: [],
  currentIndex: 0,
  correctCount: 0,
  completedCount: 0,
  hasTrackedLessonCompletion: false,
  isSubmitting: false,
  isRecording: false,
  isFinalizingRecording: false,
  hasOpenAiKey: false,
  selectedSourceLanguage: "indonesian",
  selectedDifficulty: "beginner",
  mediaRecorder: null,
  mediaStream: null,
  mediaChunks: [],
  liveConnection: null,
  liveTranscriptItems: new Map(),
  liveTranscriptOrder: [],
  liveFinalizeTimer: null,
  liveHardTimeout: null,
  liveCommitTimer: null,
  liveCommitInterval: null,
  browserSpeechRecognition: null,
  browserSpeechFinalText: "",
  browserSpeechInterimText: "",
  browserSpeechRestartTimer: null,
  browserSpeechShouldRestart: false,
  audioPlayer: null,
  narrationCache: new Map(),
  narrationPreloads: new Map(),
  autoAdvanceTimer: null,
  currentIdealAnswer: "",
  isIdealAnswerVisible: false
};

const elements = {
  appShell: document.querySelector("#appShell"),
  authOverlay: document.querySelector("#authOverlay"),
  closeAuthModalButton: document.querySelector("#closeAuthModalButton"),
  guestModeButton: document.querySelector("#guestModeButton"),
  otpModeButton: document.querySelector("#otpModeButton"),
  guestLoginForm: document.querySelector("#guestLoginForm"),
  guestNameInput: document.querySelector("#guestNameInput"),
  guestLocationInput: document.querySelector("#guestLocationInput"),
  guestLoginButton: document.querySelector("#guestLoginButton"),
  otpLoginForm: document.querySelector("#otpLoginForm"),
  otpContactInput: document.querySelector("#otpContactInput"),
  otpNameInput: document.querySelector("#otpNameInput"),
  otpLocationInput: document.querySelector("#otpLocationInput"),
  requestOtpButton: document.querySelector("#requestOtpButton"),
  otpCodeInput: document.querySelector("#otpCodeInput"),
  verifyOtpButton: document.querySelector("#verifyOtpButton"),
  otpHelperText: document.querySelector("#otpHelperText"),
  authStatusText: document.querySelector("#authStatusText"),
  sessionSummary: document.querySelector("#sessionSummary"),
  headerLoginButton: document.querySelector("#headerLoginButton"),
  heroPrimaryButton: document.querySelector("#heroPrimaryButton"),
  sessionUserName: document.querySelector("#sessionUserName"),
  sessionUserMeta: document.querySelector("#sessionUserMeta"),
  adminPageLink: document.querySelector("#adminPageLink"),
  logoutButton: document.querySelector("#logoutButton"),
  usageUserMeta: document.querySelector("#usageUserMeta"),
  usageLeaderboard: document.querySelector("#usageLeaderboard"),
  userLoginsMetric: document.querySelector("#userLoginsMetric"),
  userLessonsMetric: document.querySelector("#userLessonsMetric"),
  userAttemptsMetric: document.querySelector("#userAttemptsMetric"),
  userCorrectMetric: document.querySelector("#userCorrectMetric"),
  todayUsageValue: document.querySelector("#todayUsageValue"),
  todayUsageMeta: document.querySelector("#todayUsageMeta"),
  weekUsageValue: document.querySelector("#weekUsageValue"),
  weekUsageMeta: document.querySelector("#weekUsageMeta"),
  monthUsageValue: document.querySelector("#monthUsageValue"),
  monthUsageMeta: document.querySelector("#monthUsageMeta"),
  allTimeUsageValue: document.querySelector("#allTimeUsageValue"),
  allTimeUsageMeta: document.querySelector("#allTimeUsageMeta"),
  progressLabel: document.querySelector("#progressLabel"),
  lessonMeta: document.querySelector("#lessonMeta"),
  practiceTitle: document.querySelector("#practiceTitle"),
  sentenceLabel: document.querySelector("#sentenceLabel"),
  sourceSentence: document.querySelector("#sourceSentence"),
  sentenceTag: document.querySelector("#sentenceTag"),
  playButton: document.querySelector("#playButton"),
  skipButton: document.querySelector("#skipButton"),
  newLessonButton: document.querySelector("#newLessonButton"),
  sourceLanguageSelect: document.querySelector("#sourceLanguageSelect"),
  difficultySelect: document.querySelector("#difficultySelect"),
  recordButton: document.querySelector("#recordButton"),
  typedAnswer: document.querySelector("#typedAnswer"),
  submitTypedButton: document.querySelector("#submitTypedButton"),
  correctCount: document.querySelector("#correctCount"),
  completedCount: document.querySelector("#completedCount"),
  verdictValue: document.querySelector("#verdictValue"),
  statusBox: document.querySelector("#statusBox"),
  statusText: document.querySelector("#statusText"),
  transcriptText: document.querySelector("#transcriptText"),
  feedbackText: document.querySelector("#feedbackText"),
  idealAnswerText: document.querySelector("#idealAnswerText"),
  revealIdealAnswerButton: document.querySelector("#revealIdealAnswerButton"),
  voiceDisclosure: document.querySelector("#voiceDisclosure")
};

const SOURCE_LANGUAGE_UI = {
  indonesian: {
    label: "Indonesian",
    speechLang: "id-ID",
    feedbackSpeechRate: 1,
    voicePrefixes: ["id", "ms", "en-sg", "en-au", "en"],
    preferredTerms: [
      "indonesia",
      "bahasa",
      "female",
      "zira",
      "jenny",
      "samantha",
      "nova",
      "shimmer"
    ],
    transcriptPlaceholder: "Bahasa Inggris yang Anda ucapkan atau ketik akan muncul di sini.",
    feedbackPlaceholder: "Pelatih akan memberi tahu apakah maknanya sudah benar.",
    idealAnswerPlaceholder: "Contoh jawaban bahasa Inggris akan muncul setelah Anda mengirim jawaban.",
    waitingVerdict: "Menunggu",
    doneVerdict: "Selesai",
    verdictLabels: {
      correct: "Benar",
      close: "Hampir",
      incorrect: "Salah"
    }
  },
  hindi: {
    label: "Hindi",
    speechLang: "hi-IN",
    feedbackSpeechRate: 1,
    voicePrefixes: ["hi", "en-in", "en"],
    preferredTerms: [
      "female",
      "heera",
      "swara",
      "ananya",
      "neerja",
      "sara",
      "zira",
      "jenny",
      "nova",
      "shimmer"
    ],
    transcriptPlaceholder: "आपकी बोली या टाइप की गई अंग्रेज़ी यहाँ दिखाई देगी।",
    feedbackPlaceholder: "कोच बताएगा कि अर्थ सही है या नहीं।",
    idealAnswerPlaceholder: "आपके उत्तर भेजने के बाद अंग्रेज़ी का एक मॉडल उत्तर यहाँ दिखाई देगा।",
    waitingVerdict: "प्रतीक्षा",
    doneVerdict: "पूर्ण",
    verdictLabels: {
      correct: "सही",
      close: "करीब",
      incorrect: "गलत"
    }
  }
};

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatDateTime(value) {
  if (!value) {
    return "";
  }

  const parsedValue = new Date(value);
  if (Number.isNaN(parsedValue.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(parsedValue);
}

function setAuthModalOpen(isOpen) {
  state.isAuthModalOpen = Boolean(isOpen);
  document.body.classList.toggle("auth-modal-open", state.isAuthModalOpen);
  elements.appShell?.classList.toggle("is-auth-modal-open", state.isAuthModalOpen);

  if (elements.authOverlay) {
    elements.authOverlay.hidden = !state.isAuthModalOpen;
  }
}

function openAuthModal(mode = state.authMode) {
  setAuthMode(mode);
  setAuthModalOpen(true);
}

function closeAuthModal(options = {}) {
  const { force = false } = options;

  if (state.isAuthBusy && !force) {
    return;
  }

  setAuthModalOpen(false);
}

function setPracticeVisibility(isVisible) {
  if (elements.appShell) {
    const practiceStudio = document.querySelector("#practiceStudio");
    if (practiceStudio) {
      practiceStudio.hidden = !isVisible;
    }
  }
}

function scrollToPracticeStudio() {
  const practiceStudio = document.querySelector("#practiceStudio");
  practiceStudio?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function updateAuthCtas() {
  const signedIn = state.isAuthenticated;

  if (elements.headerLoginButton) {
    elements.headerLoginButton.hidden = signedIn;
  }

  if (elements.heroPrimaryButton) {
    elements.heroPrimaryButton.textContent = signedIn ? "Open practice" : "Log in to start";
  }
}

function setAuthStatus(message, tone = "neutral") {
  if (!elements.authStatusText) {
    return;
  }

  elements.authStatusText.textContent = message;
  elements.authStatusText.classList.remove("is-success", "is-danger");

  if (tone === "success") {
    elements.authStatusText.classList.add("is-success");
  } else if (tone === "danger") {
    elements.authStatusText.classList.add("is-danger");
  }
}

function setAuthBusy(isBusy) {
  state.isAuthBusy = Boolean(isBusy);

  const authControls = [
    elements.guestModeButton,
    elements.otpModeButton,
    elements.guestNameInput,
    elements.guestLocationInput,
    elements.guestLoginButton,
    elements.otpContactInput,
    elements.otpNameInput,
    elements.otpLocationInput,
    elements.requestOtpButton,
    elements.otpCodeInput,
    elements.verifyOtpButton,
    elements.closeAuthModalButton
  ];

  for (const control of authControls) {
    if (control) {
      control.disabled = state.isAuthBusy;
    }
  }
}

function setAuthMode(mode) {
  const normalizedMode = mode === "otp" ? "otp" : "guest";
  state.authMode = normalizedMode;

  elements.guestModeButton?.classList.toggle("is-active", normalizedMode === "guest");
  elements.otpModeButton?.classList.toggle("is-active", normalizedMode === "otp");

  if (elements.guestLoginForm) {
    elements.guestLoginForm.hidden = normalizedMode !== "guest";
  }

  if (elements.otpLoginForm) {
    elements.otpLoginForm.hidden = normalizedMode !== "otp";
  }
}

function updateSessionSummary() {
  const user = state.sessionUser;
  const isVisible = state.isAuthenticated && Boolean(user);

  if (elements.sessionSummary) {
    elements.sessionSummary.hidden = !isVisible;
  }

  if (elements.adminPageLink) {
    elements.adminPageLink.hidden = !user?.isAdmin;
  }

  if (!isVisible) {
    return;
  }

  if (elements.sessionUserName) {
    elements.sessionUserName.textContent = user.name || "Signed-in user";
  }

  if (elements.sessionUserMeta) {
    const metaParts = [];
    if (user.location) {
      metaParts.push(user.location);
    }
    if (user.contactMasked) {
      metaParts.push(user.contactMasked);
    }
    if (!metaParts.length) {
      metaParts.push("Guest session");
    }
    elements.sessionUserMeta.textContent = metaParts.join(" | ");
  }
}

function setUsageWindow(valueElement, metaElement, summary) {
  if (valueElement) {
    valueElement.textContent = pluralize(Number(summary?.attempts || 0), "attempt");
  }

  if (metaElement) {
    metaElement.textContent =
      `${pluralize(Number(summary?.activeUsers || 0), "user")} | ` +
      `${pluralize(Number(summary?.lessonsLoaded || 0), "lesson")} | ` +
      `${pluralize(Number(summary?.logins || 0), "login")}`;
  }
}

function renderUsageLeaderboard(topUsers = []) {
  if (!elements.usageLeaderboard) {
    return;
  }

  if (!Array.isArray(topUsers) || !topUsers.length) {
    elements.usageLeaderboard.innerHTML =
      '<p class="usage-leaderboard-empty">No usage data yet.</p>';
    return;
  }

  elements.usageLeaderboard.innerHTML = topUsers
    .map((user, index) => {
      const metaParts = [];
      if (user.location) {
        metaParts.push(user.location);
      }
      if (user.contactMasked) {
        metaParts.push(user.contactMasked);
      }

      const summaryText =
        `${pluralize(Number(user.usage?.attempts || 0), "attempt")} | ` +
        `${pluralize(Number(user.usage?.lessonsLoaded || 0), "lesson")} | ` +
        `${pluralize(Number(user.usage?.logins || 0), "login")}`;

      return `
        <article class="usage-leaderboard-item">
          <div class="usage-leaderboard-rank">${index + 1}</div>
          <div class="usage-leaderboard-copy">
            <strong>${user.name || "Unnamed user"}</strong>
            <span>${metaParts.join(" | ") || "Guest or OTP user"}</span>
          </div>
          <p class="usage-leaderboard-summary">${summaryText}</p>
        </article>
      `;
    })
    .join("");
}

function resetUsageDashboard() {
  if (elements.usageUserMeta) {
    elements.usageUserMeta.textContent = "Sign in to load your usage and app activity metrics.";
  }

  if (elements.userLoginsMetric) {
    elements.userLoginsMetric.textContent = "0";
  }
  if (elements.userLessonsMetric) {
    elements.userLessonsMetric.textContent = "0";
  }
  if (elements.userAttemptsMetric) {
    elements.userAttemptsMetric.textContent = "0";
  }
  if (elements.userCorrectMetric) {
    elements.userCorrectMetric.textContent = "0";
  }

  setUsageWindow(elements.todayUsageValue, elements.todayUsageMeta, {});
  setUsageWindow(elements.weekUsageValue, elements.weekUsageMeta, {});
  setUsageWindow(elements.monthUsageValue, elements.monthUsageMeta, {});
  setUsageWindow(elements.allTimeUsageValue, elements.allTimeUsageMeta, {});
  renderUsageLeaderboard([]);
}

function renderUsageDashboard(dashboard) {
  const currentUser = dashboard?.currentUser || {};
  const usage = currentUser.usage || {};

  if (elements.usageUserMeta) {
    const metaParts = [];
    if (currentUser.name) {
      metaParts.push(currentUser.name);
    }
    if (currentUser.location) {
      metaParts.push(currentUser.location);
    }
    if (currentUser.lastLoginAt) {
      metaParts.push(`Last login ${formatDateTime(currentUser.lastLoginAt)}`);
    }
    elements.usageUserMeta.textContent = metaParts.join(" | ") || "Usage dashboard loaded.";
  }

  if (elements.userLoginsMetric) {
    elements.userLoginsMetric.textContent = String(usage.logins || 0);
  }
  if (elements.userLessonsMetric) {
    elements.userLessonsMetric.textContent = String(usage.lessonsLoaded || 0);
  }
  if (elements.userAttemptsMetric) {
    elements.userAttemptsMetric.textContent = String(usage.attempts || 0);
  }
  if (elements.userCorrectMetric) {
    elements.userCorrectMetric.textContent = String(usage.correctAttempts || 0);
  }

  setUsageWindow(elements.todayUsageValue, elements.todayUsageMeta, dashboard?.overall?.today);
  setUsageWindow(elements.weekUsageValue, elements.weekUsageMeta, dashboard?.overall?.week);
  setUsageWindow(elements.monthUsageValue, elements.monthUsageMeta, dashboard?.overall?.month);
  setUsageWindow(elements.allTimeUsageValue, elements.allTimeUsageMeta, dashboard?.overall?.allTime);
  renderUsageLeaderboard(dashboard?.topUsers);
}

function resetSignedOutWorkspace() {
  stopPlayback();
  cleanupRecordingResources();
  clearNarrationCache();
  clearTimeout(state.autoAdvanceTimer);
  state.lesson = [];
  state.currentIndex = 0;
  state.correctCount = 0;
  state.completedCount = 0;
  state.hasTrackedLessonCompletion = false;
  state.hasOpenAiKey = false;
  state.isSubmitting = false;
  state.isRecording = false;
  state.isFinalizingRecording = false;
  state.currentIdealAnswer = "";
  state.isIdealAnswerVisible = false;

  if (elements.lessonMeta) {
    elements.lessonMeta.textContent = "Sign in to load a lesson.";
  }

  if (elements.sourceSentence) {
    elements.sourceSentence.textContent = "Sign in to unlock the practice studio.";
  }

  if (elements.sentenceTag) {
    elements.sentenceTag.textContent = "Authentication required.";
  }

  if (elements.verdictValue) {
    elements.verdictValue.textContent = "Locked";
  }

  if (elements.transcriptText) {
    elements.transcriptText.textContent = "Sign in to see the transcript.";
  }

  if (elements.feedbackText) {
    elements.feedbackText.textContent = "Sign in to receive AI feedback.";
  }

  if (elements.typedAnswer) {
    elements.typedAnswer.value = "";
  }

  updateCounters();
  updateProgressLabel();
  renderIdealAnswer();
  syncControlState();
}

function setAuthenticatedSession(sessionPayload) {
  const isAuthenticated = Boolean(sessionPayload?.authenticated);
  state.isAuthenticated = isAuthenticated;
  state.sessionUser = isAuthenticated ? sessionPayload.user || null : null;
  state.otpChallengeId = "";
  updateSessionSummary();
  updateAuthCtas();

  if (isAuthenticated) {
    setPracticeVisibility(true);
    closeAuthModal({ force: true });
    setAuthStatus("");
    return;
  }

  resetUsageDashboard();
  resetSignedOutWorkspace();
  setPracticeVisibility(false);
  closeAuthModal();
}

function currentSentence() {
  return state.lesson[state.currentIndex] || null;
}

function getSourceLanguageMeta(sourceLanguageId = state.selectedSourceLanguage) {
  const normalizedId = String(sourceLanguageId || "").trim().toLowerCase();
  return SOURCE_LANGUAGE_UI[normalizedId] || SOURCE_LANGUAGE_UI.indonesian;
}

function getSourceLanguageId(sourceLanguageId = state.selectedSourceLanguage) {
  return String(sourceLanguageId || "").trim().toLowerCase() || "indonesian";
}

function updateSourceLanguageUi(sourceLanguageId = state.selectedSourceLanguage) {
  const normalizedId = getSourceLanguageId(sourceLanguageId);
  const sourceLanguage = getSourceLanguageMeta(normalizedId);

  if (elements.sourceLanguageSelect) {
    elements.sourceLanguageSelect.value = normalizedId;
  }

  if (elements.practiceTitle) {
    elements.practiceTitle.textContent = `Translate the ${sourceLanguage.label} line into natural English`;
  }

  if (elements.sentenceLabel) {
    elements.sentenceLabel.textContent = `${sourceLanguage.label} prompt`;
  }

  if (elements.playButton) {
    elements.playButton.textContent = `Hear ${sourceLanguage.label}`;
  }

  updateFeedbackPlaceholders(normalizedId);
}

function updateFeedbackPlaceholders(sourceLanguageId = state.selectedSourceLanguage) {
  const sourceLanguage = getSourceLanguageMeta(sourceLanguageId);
  elements.transcriptText.textContent = sourceLanguage.transcriptPlaceholder;
  elements.feedbackText.textContent = sourceLanguage.feedbackPlaceholder;
  renderIdealAnswer(sourceLanguageId);
}

function renderIdealAnswer(sourceLanguageId = state.selectedSourceLanguage) {
  const hasIdealAnswer = Boolean(String(state.currentIdealAnswer || "").trim());
  const shouldShowAnswer = hasIdealAnswer && state.isIdealAnswerVisible;
  const placeholderText =
    "Submit your attempt first, then reveal the correct English answer only if you want to see it.";

  elements.idealAnswerText.textContent = shouldShowAnswer
    ? state.currentIdealAnswer
    : hasIdealAnswer
      ? "Correct English answer hidden. Use the button above to reveal it."
      : placeholderText;
  elements.idealAnswerText.classList.toggle("is-concealed", hasIdealAnswer && !shouldShowAnswer);

  if (elements.revealIdealAnswerButton) {
    elements.revealIdealAnswerButton.disabled =
      !hasIdealAnswer || state.isSubmitting || state.isRecording || state.isFinalizingRecording;
    elements.revealIdealAnswerButton.textContent = shouldShowAnswer
      ? "Hide English answer"
      : "Reveal English answer";
  }
}

function setIdealAnswer(idealAnswerText = "", sourceLanguageId = state.selectedSourceLanguage) {
  state.currentIdealAnswer = String(idealAnswerText || "").trim();
  state.isIdealAnswerVisible = false;
  renderIdealAnswer(sourceLanguageId);
}

function toggleIdealAnswerVisibility() {
  if (!state.currentIdealAnswer || state.isSubmitting || state.isRecording || state.isFinalizingRecording) {
    return;
  }

  state.isIdealAnswerVisible = !state.isIdealAnswerVisible;
  renderIdealAnswer();
}

function formatVerdictValue(verdict, score, sourceLanguageId = state.selectedSourceLanguage) {
  const sourceLanguage = getSourceLanguageMeta(sourceLanguageId);
  const normalizedVerdict = String(verdict || "").trim().toLowerCase();
  const translatedVerdict = sourceLanguage.verdictLabels?.[normalizedVerdict] || verdict || sourceLanguage.waitingVerdict;
  return typeof score === "number" ? `${translatedVerdict} - ${score}` : translatedVerdict;
}

function syncRecordButton() {
  elements.recordButton.classList.toggle("is-recording", state.isRecording);
  elements.recordButton.textContent = state.isRecording ? "Stop Recording" : "Start Recording";
}

function syncControlState() {
  const hasSentence = state.isAuthenticated && Boolean(currentSentence());
  const controlsLocked = state.isSubmitting || state.isRecording || state.isFinalizingRecording;
  const authLocked = !state.isAuthenticated;

  elements.playButton.disabled = authLocked || controlsLocked || !hasSentence;
  elements.skipButton.disabled = authLocked || controlsLocked || !hasSentence;
  elements.submitTypedButton.disabled = authLocked || controlsLocked || !hasSentence;
  elements.newLessonButton.disabled = authLocked || controlsLocked;
  elements.sourceLanguageSelect.disabled = authLocked || controlsLocked;
  elements.difficultySelect.disabled = authLocked || controlsLocked;
  elements.typedAnswer.disabled = authLocked || controlsLocked || !hasSentence;
  if (elements.revealIdealAnswerButton) {
    elements.revealIdealAnswerButton.disabled =
      authLocked || controlsLocked || !state.currentIdealAnswer;
  }
  elements.recordButton.disabled =
    authLocked || !hasSentence || state.isFinalizingRecording || (state.isSubmitting && !state.isRecording);

  syncRecordButton();
}

function setBusyState(isBusy) {
  state.isSubmitting = isBusy;
  syncControlState();
}

function setStatus(message, tone = "neutral") {
  elements.statusText.textContent = message;
  elements.statusBox.classList.remove("is-success", "is-warning", "is-danger");

  if (tone === "success") {
    elements.statusBox.classList.add("is-success");
  } else if (tone === "warning") {
    elements.statusBox.classList.add("is-warning");
  } else if (tone === "danger") {
    elements.statusBox.classList.add("is-danger");
  }
}

function updateCounters() {
  elements.correctCount.textContent = String(state.correctCount);
  elements.completedCount.textContent = String(state.completedCount);
}

function resetFeedbackArea() {
  const sourceLanguageId = getSourceLanguageId();
  const sourceLanguage = getSourceLanguageMeta(sourceLanguageId);
  elements.verdictValue.textContent = sourceLanguage.waitingVerdict;
  state.currentIdealAnswer = "";
  state.isIdealAnswerVisible = false;
  updateFeedbackPlaceholders(sourceLanguageId);
}

function updateProgressLabel() {
  const total = state.lesson.length;
  const position = Math.min(state.currentIndex + 1, total);
  elements.progressLabel.textContent = total
    ? `Sentence ${position} of ${total}`
    : "Sentence 0 of 0";
}

function getSentenceDisplayText(sentence) {
  if (!sentence) {
    return "";
  }

  const sourceLanguageId = getSourceLanguageId(
    sentence.sourceLanguage || state.selectedSourceLanguage
  );

  return String(
    sentence[sourceLanguageId] ||
      sentence.sourceText ||
      sentence.hindi ||
      sentence.indonesian ||
      ""
  ).trim();
}

function renderSentence() {
  const sentence = currentSentence();
  updateProgressLabel();
  updateCounters();
  updateSourceLanguageUi(sentence?.sourceLanguage || state.selectedSourceLanguage);

  if (!sentence) {
    if (state.isAuthenticated && !state.hasTrackedLessonCompletion) {
      state.hasTrackedLessonCompletion = true;
      void trackUsageEvent("lesson_completed", {
        correctCount: state.correctCount,
        completedCount: state.completedCount
      }, { refreshStats: true });
    }

    elements.sourceSentence.textContent = "Lesson complete";
    elements.sentenceTag.textContent = "Start a new lesson to practice again.";
    elements.verdictValue.textContent = getSourceLanguageMeta().doneVerdict;
    syncControlState();
    setStatus("You finished the lesson. Start a new set for more practice.", "success");
    return;
  }

  const sourceLanguageId = getSourceLanguageId(
    sentence.sourceLanguage || state.selectedSourceLanguage
  );
  const sourceLanguageLabel =
    String(sentence.sourceLanguageLabel || "").trim() ||
    getSourceLanguageMeta(sourceLanguageId).label;
  elements.sourceSentence.textContent = getSentenceDisplayText(sentence) || "Sentence unavailable";
  elements.sentenceTag.textContent = `${sourceLanguageLabel} - ${sentence.level} - ${sentence.category}`;
  elements.typedAnswer.value = "";
  resetFeedbackArea();
  syncControlState();
  primeNarrationAroundCurrentSentence();
}

async function fetchJson(url, options = {}) {
  const { suppressUnauthorizedReset = false, ...fetchOptions } = options;
  let response;

  try {
    response = await fetch(url, fetchOptions);
  } catch (error) {
    const rawMessage = String(error?.message || "").trim().toLowerCase();
    if (rawMessage.includes("failed to fetch") || rawMessage.includes("fetch failed")) {
      throw new Error("Could not reach the app server. Refresh the page and try again.");
    }

    throw error;
  }

  const payload = await response.json().catch(() => ({}));

  if (response.status === 401) {
    if (!suppressUnauthorizedReset) {
      setAuthenticatedSession(null);
      setAuthStatus(payload.error || "Session expired. Sign in again.", "danger");
      setStatus(payload.error || "Session expired. Sign in again.", "warning");
      openAuthModal("guest");
    }
    throw new Error(payload.error || "Sign in to continue.");
  }

  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }

  return payload;
}

async function trackUsageEvent(type, metadata = {}, options = {}) {
  const { refreshStats = false } = options;
  if (!state.isAuthenticated) {
    return;
  }

  let response;

  try {
    response = await fetch("/api/track", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        type,
        metadata
      })
    });
  } catch {
    return;
  }

  if (response.status === 401) {
    setAuthenticatedSession(null);
    setAuthStatus("Session expired. Sign in again.", "danger");
    setStatus("Session expired. Sign in again.", "warning");
    openAuthModal("guest");
    return;
  }

  if (response.ok && refreshStats) {
    void loadUsageDashboard();
  }
}

async function loadUsageDashboard() {
  if (!state.isAuthenticated) {
    resetUsageDashboard();
    return;
  }

  try {
    const payload = await fetchJson("/api/stats", { cache: "no-store" });
    renderUsageDashboard(payload);
  } catch (error) {
    if (state.isAuthenticated) {
      setStatus(error.message, "warning");
    }
  }
}

async function handleAuthenticatedStart(sessionPayload, successMessage, options = {}) {
  const { scrollToPractice = false } = options;
  setAuthenticatedSession(sessionPayload);
  await loadUsageDashboard();
  setStatus(successMessage || "Signed in. Loading your lesson...", "success");
  await loadLesson();
  if (scrollToPractice) {
    scrollToPracticeStudio();
  }
}

async function submitGuestLogin(event) {
  event.preventDefault();
  if (state.isAuthBusy) {
    return;
  }

  const name = elements.guestNameInput?.value.trim() || "";
  const location = elements.guestLocationInput?.value.trim() || "";

  setAuthBusy(true);
  setAuthStatus("Signing you in as a guest...");

  try {
    const payload = await fetchJson("/api/auth/guest", {
      suppressUnauthorizedReset: true,
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name,
        location
      })
    });
    await handleAuthenticatedStart(payload, "Guest session ready. Loading your first lesson...", {
      scrollToPractice: true
    });
  } catch (error) {
    setAuthStatus(error.message, "danger");
  } finally {
    setAuthBusy(false);
  }
}

async function requestOtp() {
  if (state.isAuthBusy) {
    return;
  }

  const contact = elements.otpContactInput?.value.trim() || "";
  const name = elements.otpNameInput?.value.trim() || "";
  const location = elements.otpLocationInput?.value.trim() || "";

  setAuthBusy(true);
  setAuthStatus("Requesting your OTP...");

  try {
    const payload = await fetchJson("/api/auth/otp/request", {
      suppressUnauthorizedReset: true,
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contact,
        name,
        location
      })
    });
    state.otpChallengeId = String(payload.challengeId || "").trim();

    if (elements.otpHelperText) {
      const helperParts = [payload.message || "OTP generated."];
      if (payload.devCode) {
        helperParts.push(`Dev OTP: ${payload.devCode}`);
      }
      elements.otpHelperText.textContent = helperParts.join(" ");
    }

    setAuthStatus("OTP generated. Check the server log, then enter the code here.", "success");
    elements.otpCodeInput?.focus();
  } catch (error) {
    setAuthStatus(error.message, "danger");
  } finally {
    setAuthBusy(false);
  }
}

async function verifyOtpLogin(event) {
  event.preventDefault();
  if (state.isAuthBusy) {
    return;
  }

  const contact = elements.otpContactInput?.value.trim() || "";
  const name = elements.otpNameInput?.value.trim() || "";
  const location = elements.otpLocationInput?.value.trim() || "";
  const code = elements.otpCodeInput?.value.trim() || "";

  setAuthBusy(true);
  setAuthStatus("Verifying your OTP...");

  try {
    const payload = await fetchJson("/api/auth/otp/verify", {
      suppressUnauthorizedReset: true,
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        challengeId: state.otpChallengeId,
        contact,
        name,
        location,
        code
      })
    });
    await handleAuthenticatedStart(payload, "OTP verified. Loading your first lesson...", {
      scrollToPractice: true
    });
  } catch (error) {
    setAuthStatus(error.message, "danger");
  } finally {
    setAuthBusy(false);
  }
}

async function logoutCurrentUser() {
  if (state.isAuthBusy) {
    return;
  }

  try {
    await fetch("/api/auth/logout", {
      method: "POST"
    });
  } catch {
    // Ignore network teardown issues and clear the local session state anyway.
  }

  setAuthenticatedSession(null);
  setAuthMode("guest");
  setAuthStatus("Signed out. Sign in again to continue.", "success");
  setStatus("Sign in to continue.", "warning");
  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

async function restoreSessionOrLockApp() {
  setPracticeVisibility(false);
  closeAuthModal();
  resetUsageDashboard();
  updateAuthCtas();
  setAuthStatus("");

  try {
    const payload = await fetchJson("/api/auth/session", { cache: "no-store" });
    if (!payload?.authenticated) {
      setAuthenticatedSession(null);
      return;
    }

    await handleAuthenticatedStart(payload, "Session restored. Loading your lesson...");
  } catch (error) {
    setAuthenticatedSession(null);
    setAuthStatus(error.message, "danger");
  }
}

function stopPlayback() {
  if (state.audioPlayer) {
    state.audioPlayer.pause();
    state.audioPlayer.src = "";
    state.audioPlayer = null;
  }

  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

function getNarrationCacheKey(sentenceId, sourceLanguageId) {
  const normalizedSentenceId = String(sentenceId || "").trim();
  const normalizedSourceLanguageId = getSourceLanguageId(sourceLanguageId);
  return normalizedSentenceId ? `${normalizedSourceLanguageId}:${normalizedSentenceId}` : "";
}

function clearNarrationCache() {
  for (const entry of state.narrationCache.values()) {
    if (entry?.audioUrl) {
      URL.revokeObjectURL(entry.audioUrl);
    }
  }

  state.narrationCache.clear();
  state.narrationPreloads.clear();
}

async function preloadNarrationForSentence(sentence) {
  if (!sentence || !state.hasOpenAiKey) {
    return null;
  }

  const sourceLanguageId = getSourceLanguageId(sentence.sourceLanguage);
  const cacheKey = getNarrationCacheKey(sentence.id, sourceLanguageId);
  if (!cacheKey) {
    return null;
  }

  if (state.narrationCache.has(cacheKey)) {
    return state.narrationCache.get(cacheKey);
  }

  if (state.narrationPreloads.has(cacheKey)) {
    return state.narrationPreloads.get(cacheKey);
  }

  const preloadPromise = (async () => {
    const response = await fetch(
      `/api/tts?id=${encodeURIComponent(sentence.id)}&language=${encodeURIComponent(sourceLanguageId)}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(errorPayload.error || "Unable to generate narration.");
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const cachedEntry = {
      audioUrl,
      sourceLanguageId,
      sentenceId: sentence.id
    };
    state.narrationCache.set(cacheKey, cachedEntry);
    return cachedEntry;
  })()
    .catch((error) => {
      state.narrationCache.delete(cacheKey);
      throw error;
    })
    .finally(() => {
      state.narrationPreloads.delete(cacheKey);
    });

  state.narrationPreloads.set(cacheKey, preloadPromise);
  return preloadPromise;
}

function primeNarrationAroundCurrentSentence() {
  if (!state.hasOpenAiKey) {
    return;
  }

  const current = currentSentence();
  const next = state.lesson[state.currentIndex + 1] || null;

  if (current) {
    void preloadNarrationForSentence(current).catch(() => {
      // Ignore warmup failures; explicit play will use fallback messaging.
    });
  }

  if (next) {
    void preloadNarrationForSentence(next).catch(() => {
      // Ignore warmup failures for future sentences.
    });
  }
}

async function playNarrationEntry(cachedEntry, sourceLanguageLabel) {
  const audio = new Audio(cachedEntry.audioUrl);
  state.audioPlayer = audio;
  audio.addEventListener("ended", () => {
    setStatus(`Now say the ${sourceLanguageLabel} sentence in English.`, "neutral");
  });
  await audio.play();
}

function findPreferredVoice(languagePrefixes, preferredTerms) {
  if (!window.speechSynthesis) {
    return null;
  }

  const normalizedPrefixes = languagePrefixes.map((prefix) => prefix.toLowerCase());
  const normalizedTerms = preferredTerms.map((term) => term.toLowerCase());
  const voices = window.speechSynthesis.getVoices();

  const matchingByLanguage = voices.filter((voice) =>
    normalizedPrefixes.some((prefix) => String(voice.lang || "").toLowerCase().startsWith(prefix))
  );

  for (const term of normalizedTerms) {
    const matchedVoice = matchingByLanguage.find((voice) =>
      String(voice.name || "").toLowerCase().includes(term)
    );

    if (matchedVoice) {
      return matchedVoice;
    }
  }

  return matchingByLanguage[0] || null;
}

async function playAiFeedbackAudio(feedbackMessage, sourceLanguageId) {
  if (!state.hasOpenAiKey) {
    return false;
  }

  let response;

  try {
    response = await fetch("/api/feedback-tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: feedbackMessage,
        language: sourceLanguageId
      })
    });
  } catch {
    return false;
  }

  if (!response.ok) {
    return false;
  }

  const audioBlob = await response.blob();
  if (!audioBlob.size) {
    return false;
  }

  const audioUrl = URL.createObjectURL(audioBlob);
  stopPlayback();

  return new Promise((resolve) => {
    const audio = new Audio(audioUrl);
    state.audioPlayer = audio;
    let settled = false;

    function cleanup(didSpeak) {
      if (settled) {
        return;
      }

      settled = true;
      URL.revokeObjectURL(audioUrl);
      if (state.audioPlayer === audio) {
        state.audioPlayer = null;
      }
      resolve(didSpeak);
    }

    audio.addEventListener("ended", () => {
      cleanup(true);
    });

    audio.addEventListener("error", () => {
      cleanup(false);
    });

    audio
      .play()
      .then(() => {
        // Playback started.
      })
      .catch(() => {
        cleanup(false);
      });
  });
}

async function speakFeedback(feedbackMessage, sourceLanguageId = state.selectedSourceLanguage) {
  const sourceLanguage = getSourceLanguageMeta(sourceLanguageId);
  const spokenText = String(feedbackMessage || "").trim();

  if (!spokenText) {
    return Promise.resolve(false);
  }

  stopPlayback();

  const didPlayAiFeedback = await playAiFeedbackAudio(spokenText, sourceLanguageId);
  if (didPlayAiFeedback) {
    return true;
  }

  if (!window.speechSynthesis) {
    return false;
  }

  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(spokenText);
    const preferredVoice = findPreferredVoice(
      sourceLanguage.voicePrefixes,
      sourceLanguage.preferredTerms
    );

    utterance.lang = sourceLanguage.speechLang;
    utterance.rate = sourceLanguage.feedbackSpeechRate || 1;
    utterance.pitch = 1;
    utterance.volume = 1;
    if (preferredVoice) {
      utterance.voice = preferredVoice;
      utterance.lang = preferredVoice.lang;
    }

    utterance.addEventListener("end", () => {
      resolve(true);
    });

    utterance.addEventListener("error", () => {
      resolve(false);
    });

    window.speechSynthesis.speak(utterance);
  });
}

function fallbackSpeakSourceLanguage(text, sourceLanguageId) {
  const sourceLanguage = getSourceLanguageMeta(sourceLanguageId);
  if (!window.speechSynthesis) {
    setStatus(
      `${sourceLanguage.label} audio could not be played. The text is still visible on screen.`,
      "warning"
    );
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  const preferredVoice = findPreferredVoice(
    sourceLanguage.voicePrefixes,
    sourceLanguage.preferredTerms
  );

  utterance.lang = sourceLanguage.speechLang;
  utterance.rate = 1.14;
  if (preferredVoice) {
    utterance.voice = preferredVoice;
    utterance.lang = preferredVoice.lang;
  }
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  setStatus(`Playing ${sourceLanguage.label} sentence with browser voice fallback.`, "warning");
}

async function playCurrentSentence(options = {}) {
  const sentence = currentSentence();
  if (!sentence || state.isSubmitting || state.isRecording || state.isFinalizingRecording) {
    return;
  }

  const { preferImmediate = false } = options;
  const sourceLanguageId = getSourceLanguageId(sentence.sourceLanguage);
  const sourceLanguage = getSourceLanguageMeta(sourceLanguageId);
  const fallbackText = getSentenceDisplayText(sentence);
  const cacheKey = getNarrationCacheKey(sentence.id, sourceLanguageId);
  stopPlayback();
  setStatus(`Playing the ${sourceLanguage.label} sentence...`, "neutral");

  try {
    if (preferImmediate && !state.narrationCache.has(cacheKey) && window.speechSynthesis) {
      void preloadNarrationForSentence(sentence).catch(() => {
        // Ignore warmup errors; fallback speech starts immediately.
      });
      fallbackSpeakSourceLanguage(fallbackText, sourceLanguageId);
      return;
    }

    const cachedEntry = await preloadNarrationForSentence(sentence);
    if (!cachedEntry) {
      throw new Error("Narration is unavailable.");
    }

    await playNarrationEntry(cachedEntry, sourceLanguage.label);
  } catch {
    fallbackSpeakSourceLanguage(fallbackText, sourceLanguageId);
  }
}

function pickRecordingMimeType() {
  if (!window.MediaRecorder) {
    return "";
  }

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus"
  ];

  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || "";
}

function clearLiveFinalizeTimers() {
  if (state.liveCommitTimer) {
    clearTimeout(state.liveCommitTimer);
    state.liveCommitTimer = null;
  }

  if (state.liveCommitInterval) {
    clearInterval(state.liveCommitInterval);
    state.liveCommitInterval = null;
  }

  if (state.liveFinalizeTimer) {
    clearTimeout(state.liveFinalizeTimer);
    state.liveFinalizeTimer = null;
  }

  if (state.liveHardTimeout) {
    clearTimeout(state.liveHardTimeout);
    state.liveHardTimeout = null;
  }
}

function clearBrowserSpeechRestartTimer() {
  if (state.browserSpeechRestartTimer) {
    clearTimeout(state.browserSpeechRestartTimer);
    state.browserSpeechRestartTimer = null;
  }
}

function resetBrowserSpeechTranscript() {
  state.browserSpeechFinalText = "";
  state.browserSpeechInterimText = "";
}

function buildBrowserTranscript() {
  return [state.browserSpeechFinalText, state.browserSpeechInterimText]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickPreferredTranscript() {
  const liveTranscript = buildLiveTranscript();
  const browserTranscript = buildBrowserTranscript();

  if (!liveTranscript) {
    return browserTranscript;
  }

  if (!browserTranscript) {
    return liveTranscript;
  }

  return browserTranscript.length > liveTranscript.length + 12 ? browserTranscript : liveTranscript;
}

function stopBrowserSpeechRecognition(options = {}) {
  const { resetTranscript = false, abort = false } = options;
  clearBrowserSpeechRestartTimer();
  state.browserSpeechShouldRestart = false;

  const recognition = state.browserSpeechRecognition;
  if (!recognition) {
    if (resetTranscript) {
      resetBrowserSpeechTranscript();
    }
    return;
  }

  if (abort) {
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    state.browserSpeechRecognition = null;

    try {
      recognition.abort();
    } catch {
      try {
        recognition.stop();
      } catch {
        // Ignore teardown errors.
      }
    }
  } else {
    try {
      recognition.stop();
    } catch {
      // Ignore repeated stop requests.
    }
  }

  if (resetTranscript) {
    resetBrowserSpeechTranscript();
  }
}

function supportsBrowserInterimTranscript() {
  return typeof window.SpeechRecognition === "function" || typeof window.webkitSpeechRecognition === "function";
}

function scheduleBrowserSpeechRestart() {
  clearBrowserSpeechRestartTimer();

  if (!state.browserSpeechShouldRestart || !state.isRecording || state.isFinalizingRecording) {
    return;
  }

  state.browserSpeechRestartTimer = window.setTimeout(() => {
    state.browserSpeechRestartTimer = null;

    if (!state.browserSpeechShouldRestart || !state.isRecording || state.isFinalizingRecording) {
      return;
    }

    startBrowserInterimTranscript();
  }, 180);
}

function startBrowserInterimTranscript() {
  if (!supportsBrowserInterimTranscript()) {
    return false;
  }

  if (state.browserSpeechRecognition) {
    return true;
  }

  const RecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new RecognitionCtor();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  recognition.lang = "en-IN";

  recognition.onresult = (event) => {
    const finalParts = [];
    let interimText = "";

    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      const transcript = String(result?.[0]?.transcript || "").trim();
      if (!transcript) {
        continue;
      }

      if (result.isFinal) {
        finalParts.push(transcript);
      } else {
        interimText = `${interimText} ${transcript}`.trim();
      }
    }

    if (finalParts.length) {
      state.browserSpeechFinalText = [state.browserSpeechFinalText, finalParts.join(" ")]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
    }

    state.browserSpeechInterimText = interimText;
    updateLiveTranscriptPreview();
  };

  recognition.onerror = (event) => {
    const errorCode = String(event.error || "").trim().toLowerCase();
    if (!errorCode || errorCode === "aborted") {
      return;
    }

    if (["not-allowed", "service-not-allowed", "audio-capture", "language-not-supported", "bad-grammar"].includes(errorCode)) {
      state.browserSpeechShouldRestart = false;
      setStatus(
        "Browser live transcript preview is unavailable here. The final transcript will still appear after you stop recording.",
        "warning"
      );
      return;
    }

    if (state.isRecording && !state.isFinalizingRecording && errorCode !== "no-speech") {
      setStatus("Live preview paused for a moment. Keep speaking in English.", "warning");
    }
  };

  recognition.onend = () => {
    if (state.browserSpeechRecognition === recognition) {
      state.browserSpeechRecognition = null;
    }

    scheduleBrowserSpeechRestart();
  };

  state.browserSpeechRecognition = recognition;
  state.browserSpeechShouldRestart = true;

  try {
    recognition.start();
    return true;
  } catch {
    state.browserSpeechRecognition = null;
    state.browserSpeechShouldRestart = false;
    return false;
  }
}

function stopMediaStreamTracks() {
  if (state.mediaStream) {
    for (const track of state.mediaStream.getTracks()) {
      track.stop();
    }
  }

  state.mediaStream = null;
}

function closeLiveConnection() {
  clearLiveFinalizeTimers();

  if (state.liveConnection?.dc) {
    try {
      state.liveConnection.dc.close();
    } catch {
      // Ignore close errors during teardown.
    }
  }

  if (state.liveConnection?.pc) {
    try {
      state.liveConnection.pc.close();
    } catch {
      // Ignore close errors during teardown.
    }
  }

  state.liveConnection = null;
}

function resetLiveTranscriptState() {
  state.liveTranscriptItems = new Map();
  state.liveTranscriptOrder = [];
}

function cleanupRecordingResources() {
  stopBrowserSpeechRecognition({ resetTranscript: true, abort: true });
  closeLiveConnection();
  stopMediaStreamTracks();
  state.mediaRecorder = null;
  state.mediaChunks = [];
  state.isFinalizingRecording = false;
  resetLiveTranscriptState();
}

function supportsLiveTranscription() {
  return state.hasOpenAiKey && typeof window.RTCPeerConnection === "function";
}

function upsertLiveTranscriptItem(itemId) {
  const normalizedId = String(itemId || "").trim();
  if (!normalizedId) {
    return null;
  }

  if (!state.liveTranscriptItems.has(normalizedId)) {
    state.liveTranscriptItems.set(normalizedId, {
      deltaText: "",
      finalText: ""
    });
  }

  return state.liveTranscriptItems.get(normalizedId);
}

function rememberTranscriptOrder(itemId, previousItemId) {
  const normalizedId = String(itemId || "").trim();
  if (!normalizedId) {
    return;
  }

  const order = state.liveTranscriptOrder.filter((value) => value !== normalizedId);
  const normalizedPreviousId = String(previousItemId || "").trim();

  if (!normalizedPreviousId) {
    order.unshift(normalizedId);
  } else {
    const previousIndex = order.indexOf(normalizedPreviousId);
    if (previousIndex === -1) {
      order.push(normalizedId);
    } else {
      order.splice(previousIndex + 1, 0, normalizedId);
    }
  }

  state.liveTranscriptOrder = order;
}

function buildLiveTranscript() {
  const orderedIds = [...state.liveTranscriptOrder];
  const seenIds = new Set(orderedIds);
  const transcriptParts = [];

  for (const itemId of orderedIds) {
    const item = state.liveTranscriptItems.get(itemId);
    const text = String(item?.finalText || item?.deltaText || "").trim();
    if (text) {
      transcriptParts.push(text);
    }
  }

  for (const [itemId, item] of state.liveTranscriptItems.entries()) {
    if (seenIds.has(itemId)) {
      continue;
    }

    const text = String(item.finalText || item.deltaText || "").trim();
    if (text) {
      transcriptParts.push(text);
    }
  }

  return transcriptParts.join(" ").replace(/\s+/g, " ").trim();
}

function updateLiveTranscriptPreview(fallbackText = "Listening for your English...") {
  const transcript = pickPreferredTranscript();
  elements.transcriptText.textContent = transcript || fallbackText;
}

function queueLiveFinalize(delayMs = 900) {
  if (!state.isFinalizingRecording) {
    return;
  }

  if (state.liveFinalizeTimer) {
    clearTimeout(state.liveFinalizeTimer);
  }

  state.liveFinalizeTimer = window.setTimeout(() => {
    void finalizeLiveTranscriptSubmission();
  }, delayMs);
}

function sendLiveEvent(event) {
  if (state.liveConnection?.dc?.readyState !== "open") {
    return false;
  }

  try {
    state.liveConnection.dc.send(JSON.stringify(event));
    return true;
  } catch {
    return false;
  }
}

function requestLiveBufferCommit(options = {}) {
  const { allowDuringFinalize = false } = options;
  const canCommit = state.isRecording || (allowDuringFinalize && state.isFinalizingRecording);

  if (!canCommit) {
    return false;
  }

  return sendLiveEvent({ type: "input_audio_buffer.commit" });
}

function scheduleLiveBufferCommit(delayMs = 0, options = {}) {
  if (state.liveCommitTimer) {
    clearTimeout(state.liveCommitTimer);
  }

  state.liveCommitTimer = window.setTimeout(() => {
    state.liveCommitTimer = null;
    const didCommit = requestLiveBufferCommit(options);

    if (!didCommit && typeof options.onFailure === "function") {
      options.onFailure();
      return;
    }

    if (didCommit && typeof options.onSuccess === "function") {
      options.onSuccess();
    }
  }, delayMs);
}

function stopLiveCommitLoop() {
  if (state.liveCommitInterval) {
    clearInterval(state.liveCommitInterval);
    state.liveCommitInterval = null;
  }
}

function startLiveCommitLoop() {
  stopLiveCommitLoop();

  state.liveCommitInterval = window.setInterval(() => {
    if (!state.isRecording || state.isFinalizingRecording) {
      stopLiveCommitLoop();
      return;
    }

    requestLiveBufferCommit();
  }, 1200);
}

function parseRealtimeErrorMessage(rawPayload, fallbackMessage) {
  try {
    const parsed = JSON.parse(rawPayload);
    return parsed.error || parsed.message || fallbackMessage;
  } catch {
    return String(rawPayload || fallbackMessage).trim() || fallbackMessage;
  }
}

function waitForDataChannelOpen(dataChannel, timeoutMs = 10000) {
  if (dataChannel.readyState === "open") {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error("Live transcript connection took too long to open."));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timeoutId);
      dataChannel.removeEventListener("open", handleOpen);
      dataChannel.removeEventListener("error", handleError);
    }

    function handleOpen() {
      cleanup();
      resolve();
    }

    function handleError() {
      cleanup();
      reject(new Error("Live transcript connection could not be opened."));
    }

    dataChannel.addEventListener("open", handleOpen);
    dataChannel.addEventListener("error", handleError);
  });
}

async function fetchRealtimeTranscriptionToken() {
  const sourceLanguageId = getSourceLanguageId();
  const payload = await fetchJson(
    `/api/realtime-transcription/token?language=${encodeURIComponent(sourceLanguageId)}`
  );

  if (!payload?.value) {
    throw new Error("Live transcript token was not returned by the server.");
  }

  return payload.value;
}

async function fetchRealtimeAnswer(offerSdp, ephemeralKey) {
  let response;

  try {
    response = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ephemeralKey}`,
        "Content-Type": "application/sdp"
      },
      body: offerSdp
    });
  } catch (error) {
    const rawMessage = String(error?.message || "").trim().toLowerCase();
    if (rawMessage.includes("failed to fetch") || rawMessage.includes("fetch failed")) {
      throw new Error("Could not reach OpenAI realtime transcription. Falling back to standard recording.");
    }

    throw error;
  }

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(
      parseRealtimeErrorMessage(responseText, "Live transcript setup failed.")
    );
  }

  return responseText;
}

async function finalizeLiveTranscriptSubmission() {
  if (!state.isFinalizingRecording || state.isSubmitting) {
    return;
  }

  const transcript = pickPreferredTranscript();
  closeLiveConnection();
  stopMediaStreamTracks();
  stopBrowserSpeechRecognition({ abort: true });
  state.isFinalizingRecording = false;
  syncControlState();

  if (!transcript) {
    resetLiveTranscriptState();
    resetBrowserSpeechTranscript();
    elements.transcriptText.textContent = "No speech was detected. Please try again.";
    setStatus("No speech was detected. Please try again.", "warning");
    return;
  }

  resetLiveTranscriptState();
  resetBrowserSpeechTranscript();
  elements.transcriptText.textContent = transcript;
  await submitAttempt({ type: "text", text: transcript });
}

function handleRealtimeTranscriptionEvent(rawMessage) {
  let event;
  try {
    event = JSON.parse(rawMessage);
  } catch {
    return;
  }

  if (!event?.type) {
    return;
  }

  if (event.type === "input_audio_buffer.committed") {
    upsertLiveTranscriptItem(event.item_id);
    rememberTranscriptOrder(event.item_id, event.previous_item_id || null);
    if (state.isFinalizingRecording) {
      queueLiveFinalize(900);
    }
    return;
  }

  if (event.type === "input_audio_buffer.speech_started") {
    upsertLiveTranscriptItem(event.item_id);
    if (state.liveCommitTimer && !state.isFinalizingRecording) {
      clearTimeout(state.liveCommitTimer);
      state.liveCommitTimer = null;
    }
    setStatus("Speech detected. Keep speaking in English.", "neutral");
    return;
  }

  if (event.type === "input_audio_buffer.speech_stopped") {
    if (state.isFinalizingRecording) {
      queueLiveFinalize(900);
    } else {
      setStatus("Processing the current speech turn...", "neutral");
      scheduleLiveBufferCommit(140);
    }
    return;
  }

  if (event.type === "conversation.item.input_audio_transcription.delta") {
    const item = upsertLiveTranscriptItem(event.item_id);
    if (!item) {
      return;
    }

    item.deltaText += String(event.delta || "");
    updateLiveTranscriptPreview();
    if (state.isFinalizingRecording) {
      queueLiveFinalize(800);
    }
    return;
  }

  if (event.type === "conversation.item.input_audio_transcription.completed") {
    const item = upsertLiveTranscriptItem(event.item_id);
    if (!item) {
      return;
    }

    item.finalText = String(event.transcript || "").trim();
    item.deltaText = item.finalText || item.deltaText;
    updateLiveTranscriptPreview();

    if (state.isFinalizingRecording) {
      queueLiveFinalize(500);
    } else {
      setStatus("Live transcript updated. Keep speaking or stop to submit.", "neutral");
    }
    return;
  }

  if (event.type === "conversation.item.input_audio_transcription.failed") {
    setStatus("Part of the live transcript could not be processed. Please try again.", "warning");
    if (state.isFinalizingRecording) {
      queueLiveFinalize(400);
    }
    return;
  }

  if (event.type === "error") {
    const message = String(event.error?.message || "Live transcript error.").trim();
    if ((state.isRecording || state.isFinalizingRecording) && /empty/i.test(message)) {
      return;
    }

    setStatus(message, "danger");
    return;
  }
}

async function submitAttempt(options) {
  const sentence = currentSentence();
  if (!sentence) {
    return;
  }

  const sourceLanguageId = getSourceLanguageId(sentence.sourceLanguage);

  setBusyState(true);
  setStatus("Checking your English with the AI coach...", "neutral");

  try {
    let payload;

    if (options.type === "audio") {
      payload = await fetchJson(
        `/api/attempt?id=${encodeURIComponent(sentence.id)}&language=${encodeURIComponent(sourceLanguageId)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": options.blob.type || "application/octet-stream"
          },
          body: options.blob
        }
      );
    } else {
      payload = await fetchJson(
        `/api/attempt?id=${encodeURIComponent(sentence.id)}&language=${encodeURIComponent(sourceLanguageId)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            attemptText: options.text
          })
        }
      );
    }

    const { transcript, evaluation } = payload;
    elements.transcriptText.textContent = transcript;
    elements.feedbackText.textContent = evaluation.feedback;
    setIdealAnswer(evaluation.idealAnswer, sourceLanguageId);
    elements.verdictValue.textContent = formatVerdictValue(
      evaluation.verdict,
      evaluation.score,
      sourceLanguageId
    );

    if (evaluation.passed) {
      state.correctCount += 1;
      state.completedCount += 1;
      updateCounters();
      setStatus("Correct enough to move on. Loading the next sentence...", "success");

      const sentenceId = sentence.id;
      speakFeedback(evaluation.feedback, sourceLanguageId)
        .then((didSpeak) => {
          if (currentSentence()?.id !== sentenceId) {
            return;
          }

          clearTimeout(state.autoAdvanceTimer);
          state.autoAdvanceTimer = window.setTimeout(() => {
            if (currentSentence()?.id === sentenceId) {
              advanceSentence();
            }
          }, didSpeak ? 400 : 1700);
        })
        .catch(() => {
          clearTimeout(state.autoAdvanceTimer);
          state.autoAdvanceTimer = window.setTimeout(() => {
            if (currentSentence()?.id === sentenceId) {
              advanceSentence();
            }
          }, 1700);
        });
    } else {
      setStatus("Not quite yet. Listen again and try another English version.", "warning");
      void speakFeedback(evaluation.feedback, sourceLanguageId);
    }
  } catch (error) {
    setStatus(error.message, "danger");
  } finally {
    setBusyState(false);
    void loadUsageDashboard();
  }
}

async function startUploadRecording() {
  try {
    stopPlayback();
    state.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = pickRecordingMimeType();
    state.mediaChunks = [];

    state.mediaRecorder = mimeType
      ? new MediaRecorder(state.mediaStream, { mimeType })
      : new MediaRecorder(state.mediaStream);

    state.mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) {
        state.mediaChunks.push(event.data);
      }
    });

    state.mediaRecorder.addEventListener("stop", async () => {
      const transcript = pickPreferredTranscript();
      const recorderMimeType = state.mediaRecorder?.mimeType || mimeType || "audio/webm";
      const audioBlob = new Blob(state.mediaChunks, { type: recorderMimeType });
      cleanupRecordingResources();
      syncControlState();

      if (transcript) {
        elements.transcriptText.textContent = transcript;
        await submitAttempt({ type: "text", text: transcript });
        return;
      }

      await submitAttempt({ type: "audio", blob: audioBlob });
    });

    state.mediaRecorder.start();
    state.isRecording = true;
    void trackUsageEvent("recording_started", { mode: "upload" }, { refreshStats: true });
    const hasPreview = startBrowserInterimTranscript();
    syncControlState();
    elements.transcriptText.textContent = hasPreview
      ? "Listening for your English..."
      : "Transcript will appear after you stop recording.";
    setStatus(
      hasPreview
        ? "Recording... words should appear while you speak."
        : "Recording... say the English translation now.",
      "neutral"
    );
  } catch {
    cleanupRecordingResources();
    syncControlState();
    setStatus("Microphone access was blocked. You can still type your answer below.", "danger");
  }
}

async function startLiveRecording() {
  stopPlayback();
  resetLiveTranscriptState();
  elements.transcriptText.textContent = "Connecting live transcript...";
  state.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

  const peerConnection = new RTCPeerConnection();
  const dataChannel = peerConnection.createDataChannel("oai-events");
  state.liveConnection = {
    pc: peerConnection,
    dc: dataChannel
  };

  dataChannel.addEventListener("message", (event) => {
    handleRealtimeTranscriptionEvent(event.data);
  });

  peerConnection.addEventListener("connectionstatechange", () => {
    if (
      ["failed", "disconnected"].includes(peerConnection.connectionState) &&
      (state.isRecording || state.isFinalizingRecording)
    ) {
      const transcript = pickPreferredTranscript();
      if (transcript) {
        state.isRecording = false;
        state.isFinalizingRecording = true;
        syncControlState();
        setStatus("Live transcript connection dropped. Using the transcript received so far.", "warning");
        queueLiveFinalize(200);
      } else {
        state.isRecording = false;
        cleanupRecordingResources();
        syncControlState();
        setStatus("Live transcript connection dropped. Please try again.", "danger");
      }
    }
  });

  for (const track of state.mediaStream.getAudioTracks()) {
    peerConnection.addTrack(track, state.mediaStream);
  }

  const ephemeralKey = await fetchRealtimeTranscriptionToken();
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  const answerSdp = await fetchRealtimeAnswer(offer.sdp, ephemeralKey);
  await peerConnection.setRemoteDescription({
    type: "answer",
    sdp: answerSdp
  });
  await waitForDataChannelOpen(dataChannel);

  state.isRecording = true;
  void trackUsageEvent("recording_started", { mode: "live" }, { refreshStats: true });
  const hasPreview = startBrowserInterimTranscript();
  syncControlState();
  startLiveCommitLoop();
  elements.transcriptText.textContent = hasPreview
    ? "Listening for your English..."
    : "Waiting for the live transcript...";
  setStatus(
    hasPreview
      ? "Live preview is active. OpenAI will finalize the transcript as you pause or stop."
      : "Live transcript is active. Say the English translation now.",
    "neutral"
  );
}

async function startRecording() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus("Microphone recording is not supported in this browser.", "danger");
    return;
  }

  if (supportsLiveTranscription()) {
    try {
      await startLiveRecording();
      return;
    } catch (error) {
      cleanupRecordingResources();
      syncControlState();
      elements.transcriptText.textContent = "Live transcript could not connect. Transcript will appear after you stop recording.";
      setStatus(`${error.message} Falling back to standard recording.`, "warning");
    }
  }

  await startUploadRecording();
}

function stopLiveRecording() {
  if (!state.liveConnection) {
    return;
  }

  const hasPreviewTranscript = Boolean(pickPreferredTranscript());
  state.isRecording = false;
  state.isFinalizingRecording = true;
  stopBrowserSpeechRecognition();

  if (state.mediaStream) {
    for (const track of state.mediaStream.getAudioTracks()) {
      track.enabled = false;
    }
  }

  syncControlState();
  setStatus("Finalizing your live transcript...", "neutral");
  updateLiveTranscriptPreview("Finalizing transcript...");
  clearLiveFinalizeTimers();

  if (hasPreviewTranscript) {
    queueLiveFinalize(250);
  }

  scheduleLiveBufferCommit(120, {
    allowDuringFinalize: true,
    onFailure: () => {
      queueLiveFinalize(120);
    },
    onSuccess: () => {
      queueLiveFinalize(hasPreviewTranscript ? 700 : 1200);
    }
  });

  state.liveHardTimeout = window.setTimeout(() => {
    void finalizeLiveTranscriptSubmission();
  }, hasPreviewTranscript ? 2200 : 5000);
}

function stopUploadRecording() {
  if (!state.mediaRecorder || state.mediaRecorder.state === "inactive") {
    return;
  }

  state.isRecording = false;
  stopBrowserSpeechRecognition();
  syncControlState();
  setStatus(
    pickPreferredTranscript() ? "Finalizing your transcript..." : "Uploading your audio...",
    "neutral"
  );
  state.mediaRecorder.stop();
}

function stopRecording() {
  if (state.liveConnection) {
    stopLiveRecording();
    return;
  }

  stopUploadRecording();
}

async function toggleRecording() {
  if (state.isSubmitting || state.isFinalizingRecording) {
    return;
  }

  clearTimeout(state.autoAdvanceTimer);

  if (state.isRecording) {
    stopRecording();
    return;
  }

  resetBrowserSpeechTranscript();
  const previewStarted = startBrowserInterimTranscript();
  if (previewStarted) {
    elements.transcriptText.textContent = "Listening for your English...";
  }

  await startRecording();
}

function advanceSentence() {
  clearTimeout(state.autoAdvanceTimer);
  stopPlayback();
  cleanupRecordingResources();
  state.isRecording = false;
  syncControlState();
  state.currentIndex += 1;
  renderSentence();

  if (currentSentence()) {
    void playCurrentSentence();
  }
}

async function loadLesson() {
  if (!state.isAuthenticated) {
    setStatus("Sign in to continue.", "warning");
    return;
  }

  stopPlayback();
  clearNarrationCache();
  clearTimeout(state.autoAdvanceTimer);
  cleanupRecordingResources();
  state.isRecording = false;
  state.correctCount = 0;
  state.completedCount = 0;
  state.currentIndex = 0;
  state.hasTrackedLessonCompletion = false;
  syncControlState();
  setBusyState(true);

  const requestedSourceLanguageId = getSourceLanguageId(
    elements.sourceLanguageSelect?.value || state.selectedSourceLanguage || "indonesian"
  );
  const requestedSourceLanguageLabel =
    elements.sourceLanguageSelect?.selectedOptions?.[0]?.textContent?.trim() || "Indonesian";
  const requestedDifficultyId = String(
    elements.difficultySelect?.value || state.selectedDifficulty || "beginner"
  )
    .trim()
    .toLowerCase() || "beginner";
  const requestedDifficultyLabel =
    elements.difficultySelect?.selectedOptions?.[0]?.textContent?.trim() || "Beginner";
  state.selectedSourceLanguage = requestedSourceLanguageId;
  state.selectedDifficulty = requestedDifficultyId;
  updateSourceLanguageUi(state.selectedSourceLanguage);
  let shouldAutoPlaySentence = false;
  setStatus(
    `Loading a ${requestedDifficultyLabel.toLowerCase()} ${requestedSourceLanguageLabel.toLowerCase()} lesson...`,
    "neutral"
  );

  try {
    const payload = await fetchJson(
      `/api/lesson?difficulty=${encodeURIComponent(requestedDifficultyId)}&language=${encodeURIComponent(requestedSourceLanguageId)}`,
      { cache: "no-store" }
    );
    const difficultyLabel = payload.difficulty?.label || requestedDifficultyLabel;
    const sourceLanguageLabel = payload.sourceLanguage?.label || requestedSourceLanguageLabel;
    state.lesson = payload.lesson;
    state.hasOpenAiKey = Boolean(payload.hasOpenAiKey);
    state.selectedSourceLanguage = payload.sourceLanguage?.id || requestedSourceLanguageId;
    state.selectedDifficulty = payload.difficulty?.id || requestedDifficultyId;
    elements.sourceLanguageSelect.value = state.selectedSourceLanguage;
    elements.difficultySelect.value = state.selectedDifficulty;
    updateSourceLanguageUi(state.selectedSourceLanguage);
    elements.lessonMeta.textContent =
      `${payload.lesson.length} ${difficultyLabel} prompts | ${sourceLanguageLabel} -> English | ${payload.models.grader}`;
    elements.voiceDisclosure.textContent = payload.hasOpenAiKey
      ? `AI ${sourceLanguageLabel} narration is active, browser speech reads feedback aloud, and supported browsers show an instant transcript preview while OpenAI finalizes the graded transcript.`
      : `OpenAI key not found. Browser speech fallback will be used for ${sourceLanguageLabel.toLowerCase()} narration, and transcript will appear after you stop recording.`;

    renderSentence();
    setStatus(
      `${difficultyLabel} ${sourceLanguageLabel} lesson ready. Listen carefully, then answer in English.`,
      "neutral"
    );
    void loadUsageDashboard();
    shouldAutoPlaySentence = Boolean(currentSentence());
  } catch (error) {
    state.lesson = [];
    state.hasOpenAiKey = false;
    renderSentence();
    setStatus(error.message, "danger");
  } finally {
    setBusyState(false);
    if (shouldAutoPlaySentence) {
      void playCurrentSentence();
    }
  }
}

function handleTypedSubmit() {
  if (state.isSubmitting || state.isRecording || state.isFinalizingRecording) {
    return;
  }

  const typedText = elements.typedAnswer.value.trim();
  if (!typedText) {
    setStatus("Type your English translation before submitting.", "warning");
    return;
  }

  clearTimeout(state.autoAdvanceTimer);
  void submitAttempt({ type: "text", text: typedText });
}

elements.playButton.addEventListener("click", () => {
  void playCurrentSentence({ preferImmediate: true });
});

elements.headerLoginButton?.addEventListener("click", () => {
  openAuthModal("guest");
});

elements.heroPrimaryButton?.addEventListener("click", () => {
  if (state.isAuthenticated) {
    scrollToPracticeStudio();
    return;
  }

  openAuthModal("guest");
});

elements.closeAuthModalButton?.addEventListener("click", () => {
  closeAuthModal();
});

elements.authOverlay?.addEventListener("click", (event) => {
  if (event.target === elements.authOverlay) {
    closeAuthModal();
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.isAuthModalOpen) {
    closeAuthModal();
  }
});

elements.guestModeButton?.addEventListener("click", () => {
  if (!state.isAuthBusy) {
    setAuthMode("guest");
    setAuthStatus("Sign in with your name and location to continue.");
  }
});

elements.otpModeButton?.addEventListener("click", () => {
  if (!state.isAuthBusy) {
    setAuthMode("otp");
    setAuthStatus("Request a one-time code to continue.");
  }
});

elements.guestLoginForm?.addEventListener("submit", (event) => {
  void submitGuestLogin(event);
});

elements.requestOtpButton?.addEventListener("click", () => {
  void requestOtp();
});

elements.otpLoginForm?.addEventListener("submit", (event) => {
  void verifyOtpLogin(event);
});

elements.logoutButton?.addEventListener("click", () => {
  void logoutCurrentUser();
});

elements.skipButton.addEventListener("click", () => {
  if (state.isSubmitting || state.isRecording || state.isFinalizingRecording) {
    return;
  }

  void trackUsageEvent("sentence_skipped", { sentenceId: currentSentence()?.id || "" }, { refreshStats: true });
  state.completedCount += 1;
  updateCounters();
  setStatus("Sentence skipped. Moving to the next one.", "warning");
  advanceSentence();
});

elements.difficultySelect.addEventListener("change", () => {
  if (state.isSubmitting || state.isRecording || state.isFinalizingRecording) {
    return;
  }

  void loadLesson();
});

elements.sourceLanguageSelect.addEventListener("change", () => {
  if (state.isSubmitting || state.isRecording || state.isFinalizingRecording) {
    return;
  }

  state.selectedSourceLanguage = getSourceLanguageId(elements.sourceLanguageSelect.value);
  updateSourceLanguageUi(state.selectedSourceLanguage);
  void loadLesson();
});

elements.newLessonButton.addEventListener("click", () => {
  if (state.isRecording || state.isFinalizingRecording) {
    return;
  }

  void loadLesson();
});

elements.recordButton.addEventListener("click", () => {
  void toggleRecording();
});

elements.submitTypedButton.addEventListener("click", handleTypedSubmit);
if (elements.revealIdealAnswerButton) {
  elements.revealIdealAnswerButton.addEventListener("click", toggleIdealAnswerVisibility);
}

window.addEventListener("beforeunload", () => {
  stopPlayback();
  clearNarrationCache();
  cleanupRecordingResources();
});

syncControlState();
updateSourceLanguageUi(state.selectedSourceLanguage);
setAuthMode("guest");
setAuthenticatedSession(null);
void restoreSessionOrLockApp();
