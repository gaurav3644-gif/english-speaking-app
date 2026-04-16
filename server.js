const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");

const sentenceBank = require("./data/sentences");

loadEnvironment();

const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const OPENAI_GRADER_MODEL = process.env.OPENAI_GRADER_MODEL || "gpt-4o-mini";
const OPENAI_TRANSCRIBE_MODEL =
  process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe";
const OPENAI_REALTIME_TRANSCRIBE_MODEL =
  process.env.OPENAI_REALTIME_TRANSCRIBE_MODEL || OPENAI_TRANSCRIBE_MODEL;
const OPENAI_TTS_MODEL = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
const OPENAI_TTS_VOICE = process.env.OPENAI_TTS_VOICE || "shimmer";

const PUBLIC_DIR = path.join(__dirname, "public");
const LESSON_SIZE = 10;
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const MAX_JSON_BYTES = 64 * 1024;
const MAX_SDP_BYTES = 256 * 1024;
const TTS_AUDIO_CACHE = new Map();

const DIFFICULTY_OPTIONS = [
  { id: "beginner", label: "Beginner" },
  { id: "intermediate", label: "Intermediate" },
  { id: "advanced", label: "Advanced" },
  { id: "pro", label: "Pro" }
];
const DEFAULT_DIFFICULTY_ID = DIFFICULTY_OPTIONS[0].id;
const DIFFICULTY_OPTIONS_BY_ID = new Map(
  DIFFICULTY_OPTIONS.map((option) => [option.id, option])
);
const SOURCE_LANGUAGE_OPTIONS = [
  {
    id: "indonesian",
    label: "Indonesian",
    sentenceKey: "indonesian",
    learnerLabel: "Indonesian-speaking",
    ttsInstructions:
      "Speak in clear Indonesian with a warm female teaching voice at a brisk pace so learners can repeat the line easily.",
    feedbackTtsInstructions:
      "Speak in clear Indonesian with a warm female coaching voice. This is short spoken feedback to a learner about whether their English translation was correct. Sound supportive, direct, and natural."
  },
  {
    id: "hindi",
    label: "Hindi",
    sentenceKey: "hindi",
    learnerLabel: "Hindi-speaking",
    ttsInstructions:
      "Speak in clear Hindi with a warm female teaching voice at a brisk pace so learners can repeat the line easily.",
    feedbackTtsInstructions:
      "Speak in clear Hindi with a warm female coaching voice. This is short spoken feedback to a learner about whether their English translation was correct. Sound supportive, direct, and natural."
  }
];
const DEFAULT_SOURCE_LANGUAGE_ID = SOURCE_LANGUAGE_OPTIONS[0].id;
const SOURCE_LANGUAGE_OPTIONS_BY_ID = new Map(
  SOURCE_LANGUAGE_OPTIONS.map((option) => [option.id, option])
);

const JSON_SCHEMA = {
  name: "translation_grade",
  strict: true,
  schema: {
    type: "object",
    properties: {
      passed: { type: "boolean" },
      verdict: {
        type: "string",
        enum: ["correct", "close", "incorrect"]
      },
      feedback: { type: "string" },
      idealAnswer: { type: "string" },
      score: {
        type: "integer",
        minimum: 0,
        maximum: 100
      }
    },
    required: ["passed", "verdict", "feedback", "idealAnswer", "score"],
    additionalProperties: false
  }
};

const CONTENT_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "application/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".svg", "image/svg+xml"],
  [".ico", "image/x-icon"]
]);

function loadEnvironment() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const envContent = fs.readFileSync(envPath, "utf8");

  for (const rawLine of envContent.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
  });
  response.end(body);
}

function sendText(response, statusCode, body, contentType = "text/plain; charset=utf-8") {
  response.writeHead(statusCode, {
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(body)
  });
  response.end(body);
}

function readRequestBody(request, limitBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;

    request.on("data", (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > limitBytes) {
        request.destroy();
        reject(createHttpError(413, "Request body is too large."));
        return;
      }
      chunks.push(chunk);
    });

    request.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    request.on("error", (error) => {
      reject(error);
    });
  });
}

function getMimeType(request) {
  return String(request.headers["content-type"] || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
}

function getAudioExtension(mimeType) {
  const audioExtensions = {
    "audio/webm": "webm",
    "audio/wav": "wav",
    "audio/wave": "wav",
    "audio/x-wav": "wav",
    "audio/mp4": "mp4",
    "audio/mpeg": "mp3",
    "audio/ogg": "ogg",
    "audio/mpga": "mpga",
    "audio/m4a": "m4a",
    "application/octet-stream": "webm"
  };

  return audioExtensions[mimeType] || "webm";
}

function shuffle(array) {
  const clone = [...array];
  for (let index = clone.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [clone[index], clone[randomIndex]] = [clone[randomIndex], clone[index]];
  }
  return clone;
}

function normalizeDifficultyId(value) {
  const normalizedValue = String(value || "").trim().toLowerCase();
  return DIFFICULTY_OPTIONS_BY_ID.has(normalizedValue)
    ? normalizedValue
    : DEFAULT_DIFFICULTY_ID;
}

function getDifficultyOption(value) {
  return DIFFICULTY_OPTIONS_BY_ID.get(normalizeDifficultyId(value));
}

function normalizeSourceLanguageId(value) {
  const normalizedValue = String(value || "").trim().toLowerCase();
  return SOURCE_LANGUAGE_OPTIONS_BY_ID.has(normalizedValue)
    ? normalizedValue
    : DEFAULT_SOURCE_LANGUAGE_ID;
}

function getSourceLanguageOption(value) {
  return SOURCE_LANGUAGE_OPTIONS_BY_ID.get(normalizeSourceLanguageId(value));
}

function getSentenceSourceText(sentence, sourceLanguageId) {
  const sourceLanguage = getSourceLanguageOption(sourceLanguageId);
  return String(
    sentence?.[sourceLanguage.sentenceKey] ||
      sentence?.[SOURCE_LANGUAGE_OPTIONS_BY_ID.get(DEFAULT_SOURCE_LANGUAGE_ID)?.sentenceKey] ||
      sentence?.hindi ||
      ""
  ).trim();
}

function getTtsCacheKey(sentenceId, sourceLanguageId) {
  const normalizedSentenceId = String(sentenceId || "").trim();
  const normalizedSourceLanguageId = normalizeSourceLanguageId(sourceLanguageId);
  return normalizedSentenceId ? `${normalizedSourceLanguageId}:${normalizedSentenceId}` : "";
}

function getSentenceDifficultyId(sentence) {
  return normalizeDifficultyId(sentence.difficulty || sentence.level);
}

function getLessonPool(difficultyId) {
  const difficulty = getDifficultyOption(difficultyId);
  const pool = sentenceBank.filter((sentence) => getSentenceDifficultyId(sentence) === difficulty.id);

  if (pool.length >= LESSON_SIZE) {
    return pool;
  }

  return sentenceBank.filter(
    (sentence) => getSentenceDifficultyId(sentence) === DEFAULT_DIFFICULTY_ID
  );
}

function buildLesson(
  difficultyId = DEFAULT_DIFFICULTY_ID,
  sourceLanguageId = DEFAULT_SOURCE_LANGUAGE_ID
) {
  const sourceLanguage = getSourceLanguageOption(sourceLanguageId);
  return shuffle(getLessonPool(difficultyId))
    .slice(0, LESSON_SIZE)
    .map((sentence) => ({
      id: sentence.id,
      hindi: sentence.hindi,
      indonesian: sentence.indonesian,
      sourceText: getSentenceSourceText(sentence, sourceLanguage.id),
      sourceLanguage: sourceLanguage.id,
      sourceLanguageLabel: sourceLanguage.label,
      level: sentence.level,
      category: sentence.category
    }));
}

function findSentence(sentenceId) {
  return sentenceBank.find((sentence) => sentence.id === sentenceId);
}

function requireApiKey() {
  if (!OPENAI_API_KEY) {
    throw createHttpError(
      500,
      "OPENAI_API_KEY is missing. Set it in your server environment variables (.env locally, Railway Variables in production)."
    );
  }
}

function apiUrl(endpoint) {
  return `${OPENAI_BASE_URL}${endpoint}`;
}

function normalizeOpenAiError(errorPayload, fallbackMessage) {
  try {
    const parsed = JSON.parse(errorPayload);
    return parsed.error?.message || fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

function normalizeOpenAiNetworkError(error, fallbackMessage) {
  const rawMessage = String(error?.message || "").trim().toLowerCase();
  if (!rawMessage) {
    return fallbackMessage;
  }

  if (rawMessage.includes("fetch failed") || rawMessage.includes("network")) {
    return `${fallbackMessage} OpenAI could not be reached. Check your internet connection, OPENAI_API_KEY, and OPENAI_BASE_URL.`;
  }

  return fallbackMessage;
}

async function callOpenAiJson(endpoint, payload) {
  requireApiKey();
  let response;

  try {
    response = await fetch(apiUrl(endpoint), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    throw createHttpError(
      502,
      normalizeOpenAiNetworkError(error, "OpenAI request failed.")
    );
  }

  const responseText = await response.text();
  if (!response.ok) {
    throw createHttpError(
      502,
      normalizeOpenAiError(responseText, "OpenAI request failed.")
    );
  }

  return JSON.parse(responseText);
}

async function synthesizeSourceSpeech(sentence, sourceLanguageId) {
  requireApiKey();
  const sourceLanguage = getSourceLanguageOption(sourceLanguageId);
  const cacheKey = getTtsCacheKey(sentence?.id, sourceLanguage.id);
  return synthesizeSpeechText(
    getSentenceSourceText(sentence, sourceLanguage.id),
    sourceLanguage.id,
    sourceLanguage.ttsInstructions,
    cacheKey
  );
}

async function synthesizeSpeechText(text, sourceLanguageId, instructions, cacheKey = "") {
  requireApiKey();
  const sourceLanguage = getSourceLanguageOption(sourceLanguageId);
  const inputText = String(text || "").trim();

  if (!inputText) {
    throw createHttpError(400, "Speech text is missing.");
  }

  if (cacheKey && TTS_AUDIO_CACHE.has(cacheKey)) {
    return TTS_AUDIO_CACHE.get(cacheKey);
  }

  let response;

  try {
    response = await fetch(apiUrl("/audio/speech"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: OPENAI_TTS_MODEL,
        voice: OPENAI_TTS_VOICE,
        input: inputText,
        instructions: String(instructions || sourceLanguage.ttsInstructions || "").trim(),
        response_format: "mp3"
      })
    });
  } catch (error) {
    throw createHttpError(
      502,
      normalizeOpenAiNetworkError(error, "OpenAI speech generation failed.")
    );
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());
  if (!response.ok) {
    throw createHttpError(
      502,
      normalizeOpenAiError(audioBuffer.toString("utf8"), "OpenAI speech generation failed.")
    );
  }

  if (cacheKey) {
    TTS_AUDIO_CACHE.set(cacheKey, audioBuffer);
  }

  return audioBuffer;
}

async function synthesizeFeedbackSpeech(text, sourceLanguageId) {
  const sourceLanguage = getSourceLanguageOption(sourceLanguageId);
  return synthesizeSpeechText(
    text,
    sourceLanguage.id,
    sourceLanguage.feedbackTtsInstructions
  );
}

async function transcribeLearnerAudio(audioBuffer, mimeType, sourceLanguageId) {
  requireApiKey();
  const sourceLanguage = getSourceLanguageOption(sourceLanguageId);

  const form = new FormData();
  const extension = getAudioExtension(mimeType);
  const audioBlob = new Blob([audioBuffer], {
    type: mimeType || "audio/webm"
  });

  form.append("file", audioBlob, `attempt.${extension}`);
  form.append("model", OPENAI_TRANSCRIBE_MODEL);
  form.append("response_format", "text");
  form.append(
    "prompt",
    `This audio contains a learner speaking an English translation of a ${sourceLanguage.label} sentence.`
  );

  let response;

  try {
    response = await fetch(apiUrl("/audio/transcriptions"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: form
    });
  } catch (error) {
    throw createHttpError(
      502,
      normalizeOpenAiNetworkError(error, "OpenAI transcription failed.")
    );
  }

  const transcript = (await response.text()).trim();
  if (!response.ok) {
    throw createHttpError(
      502,
      normalizeOpenAiError(transcript, "OpenAI transcription failed.")
    );
  }

  if (!transcript) {
    throw createHttpError(422, "No speech was detected. Please try again.");
  }

  return transcript;
}

async function createRealtimeTranscriptionToken(sourceLanguageId) {
  requireApiKey();
  const sourceLanguage = getSourceLanguageOption(sourceLanguageId);
  let response;

  try {
    response = await fetch(apiUrl("/realtime/transcription_sessions"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        input_audio_noise_reduction: {
          type: "near_field"
        },
        input_audio_transcription: {
          model: OPENAI_REALTIME_TRANSCRIBE_MODEL,
          language: "en",
          prompt:
            `The speaker is a ${sourceLanguage.learnerLabel} learner answering in English. Prefer natural English text, and ignore brief ${sourceLanguage.label} prompt bleed or background ${sourceLanguage.label} when possible.`
        },
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 250
        }
      })
    });
  } catch (error) {
    throw createHttpError(
      502,
      normalizeOpenAiNetworkError(error, "OpenAI realtime transcription token setup failed.")
    );
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw createHttpError(
      502,
      normalizeOpenAiError(JSON.stringify(payload || {}), "OpenAI realtime transcription token setup failed.")
    );
  }

  const clientSecret = payload?.client_secret?.value;
  const expiresAt = payload?.client_secret?.expires_at;

  if (!clientSecret) {
    throw createHttpError(502, "OpenAI did not return a realtime transcription client secret.");
  }

  return {
    value: clientSecret,
    expiresAt,
    sessionId: payload?.id || null
  };
}

async function gradeAttempt(sentence, transcript, sourceLanguageId) {
  const sourceLanguage = getSourceLanguageOption(sourceLanguageId);
  const payload = {
    model: OPENAI_GRADER_MODEL,
    messages: [
      {
        role: "system",
        content:
          `You are grading spoken English translations for a ${sourceLanguage.learnerLabel} learner. Accept natural paraphrases, contractions, minor filler words, and small speech-to-text errors when the meaning is still correct. Set passed to true only when the learner clearly communicated the right meaning and can move on. Use verdict close when the learner is partly right but should retry. Write feedback in ${sourceLanguage.label}. Keep feedback short, warm, and direct. Give one natural idealAnswer in simple English.`
      },
      {
        role: "user",
        content: JSON.stringify({
          source_language: sourceLanguage.label,
          target_language: "English",
          feedback_language: sourceLanguage.label,
          source_sentence: getSentenceSourceText(sentence, sourceLanguage.id),
          reference_translation: sentence.english,
          learner_transcript: transcript,
          level: sentence.level,
          category: sentence.category
        })
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: JSON_SCHEMA
    }
  };

  const result = await callOpenAiJson("/chat/completions", payload);
  const message = result.choices?.[0]?.message;

  if (message?.refusal) {
    throw createHttpError(502, "The grading model refused the request.");
  }

  if (!message?.content) {
    throw createHttpError(502, "The grading model returned an empty response.");
  }

  return JSON.parse(message.content);
}

async function handleLessonRequest(requestUrl, response) {
  const difficulty = getDifficultyOption(requestUrl.searchParams.get("difficulty"));
  const sourceLanguage = getSourceLanguageOption(requestUrl.searchParams.get("language"));

  sendJson(response, 200, {
    lesson: buildLesson(difficulty.id, sourceLanguage.id),
    difficulty: {
      id: difficulty.id,
      label: difficulty.label
    },
    sourceLanguage: {
      id: sourceLanguage.id,
      label: sourceLanguage.label
    },
    hasOpenAiKey: Boolean(OPENAI_API_KEY),
    models: {
      grader: OPENAI_GRADER_MODEL,
      transcribe: OPENAI_TRANSCRIBE_MODEL,
      realtimeTranscribe: OPENAI_REALTIME_TRANSCRIBE_MODEL,
      tts: OPENAI_TTS_MODEL
    }
  });
}

async function handleTextToSpeechRequest(requestUrl, response) {
  const sentenceId = requestUrl.searchParams.get("id");
  const sentence = findSentence(sentenceId);
  const sourceLanguage = getSourceLanguageOption(requestUrl.searchParams.get("language"));

  if (!sentence) {
    throw createHttpError(404, "Sentence not found.");
  }

  const audioBuffer = await synthesizeSourceSpeech(sentence, sourceLanguage.id);
  response.writeHead(200, {
    "Content-Type": "audio/mpeg",
    "Content-Length": audioBuffer.length,
    "Cache-Control": "no-store"
  });
  response.end(audioBuffer);
}

async function handleFeedbackTextToSpeechRequest(request, response) {
  const bodyBuffer = await readRequestBody(request, MAX_JSON_BYTES);
  const parsedBody = JSON.parse(bodyBuffer.toString("utf8"));
  const sourceLanguage = getSourceLanguageOption(parsedBody.language);
  const feedbackText = String(parsedBody.text || "").trim();

  if (!feedbackText) {
    throw createHttpError(400, "Feedback text is missing.");
  }

  const audioBuffer = await synthesizeFeedbackSpeech(feedbackText, sourceLanguage.id);
  response.writeHead(200, {
    "Content-Type": "audio/mpeg",
    "Content-Length": audioBuffer.length,
    "Cache-Control": "no-store"
  });
  response.end(audioBuffer);
}

async function handleRealtimeTranscriptionTokenRequest(requestUrl, response) {
  const sourceLanguage = getSourceLanguageOption(requestUrl.searchParams.get("language"));
  const token = await createRealtimeTranscriptionToken(sourceLanguage.id);
  sendJson(response, 200, token);
}

async function handleAttemptRequest(request, requestUrl, response) {
  const sentenceId = requestUrl.searchParams.get("id");
  const sentence = findSentence(sentenceId);
  const sourceLanguage = getSourceLanguageOption(requestUrl.searchParams.get("language"));

  if (!sentence) {
    throw createHttpError(404, "Sentence not found.");
  }

  const mimeType = getMimeType(request);
  let transcript = "";

  if (mimeType === "application/json") {
    const bodyBuffer = await readRequestBody(request, MAX_JSON_BYTES);
    const parsedBody = JSON.parse(bodyBuffer.toString("utf8"));
    transcript = String(parsedBody.attemptText || "").trim();

    if (!transcript) {
      throw createHttpError(400, "Typed English answer is missing.");
    }
  } else {
    const audioBuffer = await readRequestBody(request, MAX_AUDIO_BYTES);
    if (!audioBuffer.length) {
      throw createHttpError(400, "Audio input is missing.");
    }

    transcript = await transcribeLearnerAudio(
      audioBuffer,
      mimeType || "audio/webm",
      sourceLanguage.id
    );
  }

  const evaluation = await gradeAttempt(sentence, transcript, sourceLanguage.id);

  sendJson(response, 200, {
    sentenceId,
    transcript,
    evaluation
  });
}

function getStaticPathname(requestUrl) {
  if (requestUrl.pathname === "/") {
    return path.join(PUBLIC_DIR, "index.html");
  }

  const relativePath = requestUrl.pathname.replace(/^[/\\]+/, "");
  return path.resolve(PUBLIC_DIR, relativePath);
}

async function serveStaticFile(requestUrl, response) {
  const filePath = getStaticPathname(requestUrl);

  if (
    filePath !== path.join(PUBLIC_DIR, "index.html") &&
    !filePath.startsWith(`${PUBLIC_DIR}${path.sep}`)
  ) {
    throw createHttpError(403, "Forbidden.");
  }

  let fileStats;
  try {
    fileStats = await fs.promises.stat(filePath);
  } catch {
    throw createHttpError(404, "File not found.");
  }

  if (fileStats.isDirectory()) {
    throw createHttpError(404, "File not found.");
  }

  const extension = path.extname(filePath).toLowerCase();
  const contentType = CONTENT_TYPES.get(extension) || "application/octet-stream";

  response.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": fileStats.size
  });

  fs.createReadStream(filePath).pipe(response);
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  try {
    if (request.method === "GET" && requestUrl.pathname === "/api/lesson") {
      await handleLessonRequest(requestUrl, response);
      return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/api/tts") {
      await handleTextToSpeechRequest(requestUrl, response);
      return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/api/feedback-tts") {
      await handleFeedbackTextToSpeechRequest(request, response);
      return;
    }

    if (
      request.method === "POST" &&
      requestUrl.pathname === "/api/realtime-transcription/token"
    ) {
      await handleRealtimeTranscriptionTokenRequest(requestUrl, response);
      return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/api/attempt") {
      await handleAttemptRequest(request, requestUrl, response);
      return;
    }

    if (request.method !== "GET") {
      throw createHttpError(405, "Method not allowed.");
    }

    await serveStaticFile(requestUrl, response);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    const message = error.message || "Unexpected server error.";

    if (requestUrl.pathname.startsWith("/api/")) {
      sendJson(response, statusCode, { error: message });
      return;
    }

    sendText(response, statusCode, message);
  }
});

server.listen(PORT, () => {
  console.log(`English speaking practice app running at http://localhost:${PORT}`);
});
