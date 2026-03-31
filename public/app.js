const state = {
  lesson: [],
  currentIndex: 0,
  correctCount: 0,
  completedCount: 0,
  isSubmitting: false,
  isRecording: false,
  isFinalizingRecording: false,
  hasOpenAiKey: false,
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
  browserSpeechRecognition: null,
  browserSpeechFinalText: "",
  browserSpeechInterimText: "",
  browserSpeechRestartTimer: null,
  browserSpeechShouldRestart: false,
  audioPlayer: null,
  autoAdvanceTimer: null
};

const elements = {
  progressLabel: document.querySelector("#progressLabel"),
  lessonMeta: document.querySelector("#lessonMeta"),
  hindiSentence: document.querySelector("#hindiSentence"),
  sentenceTag: document.querySelector("#sentenceTag"),
  playButton: document.querySelector("#playButton"),
  skipButton: document.querySelector("#skipButton"),
  newLessonButton: document.querySelector("#newLessonButton"),
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
  voiceDisclosure: document.querySelector("#voiceDisclosure")
};

function currentSentence() {
  return state.lesson[state.currentIndex] || null;
}

function syncRecordButton() {
  elements.recordButton.classList.toggle("is-recording", state.isRecording);
  elements.recordButton.textContent = state.isRecording ? "Stop Recording" : "Start Recording";
}

function syncControlState() {
  const hasSentence = Boolean(currentSentence());
  const controlsLocked = state.isSubmitting || state.isRecording || state.isFinalizingRecording;

  elements.playButton.disabled = controlsLocked || !hasSentence;
  elements.skipButton.disabled = controlsLocked || !hasSentence;
  elements.submitTypedButton.disabled = controlsLocked || !hasSentence;
  elements.newLessonButton.disabled = controlsLocked;
  elements.difficultySelect.disabled = controlsLocked;
  elements.typedAnswer.disabled = controlsLocked || !hasSentence;
  elements.recordButton.disabled =
    !hasSentence || state.isFinalizingRecording || (state.isSubmitting && !state.isRecording);

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
  elements.verdictValue.textContent = "Waiting";
  elements.transcriptText.textContent = "Your spoken or typed English will appear here.";
  elements.feedbackText.textContent = "The coach will tell you if the meaning is correct.";
  elements.idealAnswerText.textContent =
    "A model answer will appear after you submit your attempt.";
}

function updateProgressLabel() {
  const total = state.lesson.length;
  const position = Math.min(state.currentIndex + 1, total);
  elements.progressLabel.textContent = total
    ? `Sentence ${position} of ${total}`
    : "Sentence 0 of 0";
}

function renderSentence() {
  const sentence = currentSentence();
  updateProgressLabel();
  updateCounters();

  if (!sentence) {
    elements.hindiSentence.textContent = "Lesson complete";
    elements.sentenceTag.textContent = "Start a new lesson to practice again.";
    elements.verdictValue.textContent = "Done";
    syncControlState();
    setStatus("You finished the lesson. Start a new set for more practice.", "success");
    return;
  }

  elements.hindiSentence.textContent = sentence.hindi;
  elements.sentenceTag.textContent = `${sentence.level} - ${sentence.category}`;
  elements.typedAnswer.value = "";
  resetFeedbackArea();
  syncControlState();
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }

  return payload;
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

function speakEnglishFeedback(statusMessage, feedbackMessage) {
  const combinedText = [statusMessage, feedbackMessage]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(". ");

  if (!combinedText || !window.speechSynthesis) {
    return Promise.resolve(false);
  }

  stopPlayback();

  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(combinedText);
    const preferredVoice = findPreferredVoice(
      ["en-us", "en-gb", "en-in", "en"],
      ["female", "zira", "aria", "jenny", "sara", "libby", "samantha", "victoria", "nova", "shimmer"]
    );

    utterance.lang = "en-US";
    utterance.rate = 1;
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

function fallbackSpeakHindi(text) {
  if (!window.speechSynthesis) {
    setStatus("Hindi audio could not be played. The text is still visible on screen.", "warning");
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  const preferredVoice = findPreferredVoice(
    ["hi", "en-in", "en"],
    ["female", "heera", "swara", "ananya", "neerja", "sara", "zira", "jenny", "nova", "shimmer"]
  );

  utterance.lang = "hi-IN";
  utterance.rate = 1.14;
  if (preferredVoice) {
    utterance.voice = preferredVoice;
    utterance.lang = preferredVoice.lang;
  }
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  setStatus("Playing Hindi sentence with browser voice fallback.", "warning");
}

async function playCurrentSentence() {
  const sentence = currentSentence();
  if (!sentence || state.isSubmitting || state.isRecording || state.isFinalizingRecording) {
    return;
  }

  stopPlayback();
  setStatus("Playing the Hindi sentence...", "neutral");

  try {
    const response = await fetch(`/api/tts?id=${encodeURIComponent(sentence.id)}`);
    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(errorPayload.error || "Unable to generate narration.");
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    state.audioPlayer = audio;
    audio.addEventListener("ended", () => {
      URL.revokeObjectURL(audioUrl);
      setStatus("Now say the sentence in English.", "neutral");
    });
    await audio.play();
  } catch {
    fallbackSpeakHindi(sentence.hindi);
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

  state.liveConnection.dc.send(JSON.stringify(event));
  return true;
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
  const payload = await fetchJson("/api/realtime-transcription/token");

  if (!payload?.value) {
    throw new Error("Live transcript token was not returned by the server.");
  }

  return payload.value;
}

async function fetchRealtimeAnswer(offerSdp, ephemeralKey) {
  const response = await fetch("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ephemeralKey}`,
      "Content-Type": "application/sdp"
    },
    body: offerSdp
  });

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
    setStatus("Speech detected. Keep speaking in English.", "neutral");
    return;
  }

  if (event.type === "input_audio_buffer.speech_stopped") {
    if (state.isFinalizingRecording) {
      queueLiveFinalize(900);
    } else {
      setStatus("Processing the current speech turn...", "neutral");
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
    if (state.isFinalizingRecording && /empty/i.test(message)) {
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

  setBusyState(true);
  setStatus("Checking your English with the AI coach...", "neutral");

  try {
    let payload;

    if (options.type === "audio") {
      payload = await fetchJson(`/api/attempt?id=${encodeURIComponent(sentence.id)}`, {
        method: "POST",
        headers: {
          "Content-Type": options.blob.type || "application/octet-stream"
        },
        body: options.blob
      });
    } else {
      payload = await fetchJson(`/api/attempt?id=${encodeURIComponent(sentence.id)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          attemptText: options.text
        })
      });
    }

    const { transcript, evaluation } = payload;
    elements.transcriptText.textContent = transcript;
    elements.feedbackText.textContent = evaluation.feedback;
    elements.idealAnswerText.textContent = evaluation.idealAnswer;
    elements.verdictValue.textContent = `${evaluation.verdict} - ${evaluation.score}`;

    if (evaluation.passed) {
      state.correctCount += 1;
      state.completedCount += 1;
      updateCounters();
      setStatus("Correct enough to move on. Loading the next sentence...", "success");

      const sentenceId = sentence.id;
      speakEnglishFeedback(elements.statusText.textContent, evaluation.feedback)
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
      void speakEnglishFeedback(elements.statusText.textContent, evaluation.feedback);
    }
  } catch (error) {
    setStatus(error.message, "danger");
  } finally {
    setBusyState(false);
  }
}

async function startUploadRecording() {
  try {
    stopPlayback();
    state.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = pickRecordingMimeType();
    state.mediaChunks = [];
    resetBrowserSpeechTranscript();

    state.mediaRecorder = mimeType
      ? new MediaRecorder(state.mediaStream, { mimeType })
      : new MediaRecorder(state.mediaStream);

    state.mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) {
        state.mediaChunks.push(event.data);
      }
    });

    state.mediaRecorder.addEventListener("stop", async () => {
      const recorderMimeType = state.mediaRecorder?.mimeType || mimeType || "audio/webm";
      const audioBlob = new Blob(state.mediaChunks, { type: recorderMimeType });
      cleanupRecordingResources();
      syncControlState();
      await submitAttempt({ type: "audio", blob: audioBlob });
    });

    state.mediaRecorder.start();
    state.isRecording = true;
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
  resetBrowserSpeechTranscript();
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
  const hasPreview = startBrowserInterimTranscript();
  syncControlState();
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

  state.liveCommitTimer = window.setTimeout(() => {
    sendLiveEvent({ type: "input_audio_buffer.commit" });
    queueLiveFinalize(1200);
  }, 180);

  state.liveHardTimeout = window.setTimeout(() => {
    void finalizeLiveTranscriptSubmission();
  }, 5000);
}

function stopUploadRecording() {
  if (!state.mediaRecorder || state.mediaRecorder.state === "inactive") {
    return;
  }

  state.isRecording = false;
  stopBrowserSpeechRecognition();
  syncControlState();
  setStatus("Uploading your audio...", "neutral");
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
  stopPlayback();
  clearTimeout(state.autoAdvanceTimer);
  cleanupRecordingResources();
  state.isRecording = false;
  state.correctCount = 0;
  state.completedCount = 0;
  state.currentIndex = 0;
  syncControlState();
  setBusyState(true);

  const requestedDifficultyId = String(
    elements.difficultySelect?.value || state.selectedDifficulty || "beginner"
  )
    .trim()
    .toLowerCase() || "beginner";
  const requestedDifficultyLabel =
    elements.difficultySelect?.selectedOptions?.[0]?.textContent?.trim() || "Beginner";
  state.selectedDifficulty = requestedDifficultyId;
  setStatus(`Loading a ${requestedDifficultyLabel.toLowerCase()} lesson...`, "neutral");

  try {
    const payload = await fetchJson(
      `/api/lesson?difficulty=${encodeURIComponent(requestedDifficultyId)}`
    );
    const difficultyLabel = payload.difficulty?.label || requestedDifficultyLabel;
    state.lesson = payload.lesson;
    state.hasOpenAiKey = Boolean(payload.hasOpenAiKey);
    state.selectedDifficulty = payload.difficulty?.id || requestedDifficultyId;
    elements.difficultySelect.value = state.selectedDifficulty;
    elements.lessonMeta.textContent = `${payload.lesson.length} ${difficultyLabel} prompts | ${payload.models.grader}`;
    elements.voiceDisclosure.textContent = payload.hasOpenAiKey
      ? "AI Hindi narration is active, browser speech reads feedback aloud, and supported browsers show an instant transcript preview while OpenAI finalizes the graded transcript."
      : "OpenAI key not found. Browser speech fallback will be used for narration, and transcript will appear after you stop recording.";

    renderSentence();
    setStatus(`${difficultyLabel} lesson ready. Listen carefully, then answer in English.`, "neutral");
    void playCurrentSentence();
  } catch (error) {
    state.lesson = [];
    state.hasOpenAiKey = false;
    renderSentence();
    setStatus(error.message, "danger");
  } finally {
    setBusyState(false);
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
  void playCurrentSentence();
});

elements.skipButton.addEventListener("click", () => {
  if (state.isSubmitting || state.isRecording || state.isFinalizingRecording) {
    return;
  }

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

window.addEventListener("beforeunload", () => {
  stopPlayback();
  cleanupRecordingResources();
});

syncControlState();
void loadLesson();


