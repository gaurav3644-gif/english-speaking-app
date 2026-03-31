# BolChaal English Lab

A small Hindi-to-English speaking practice website built with a plain Node server and OpenAI APIs.

## What it does

- Shows one Hindi sentence at a time.
- Narrates the Hindi sentence with OpenAI text-to-speech.
- Lets the learner answer by microphone or typed English.
- Uses OpenAI speech-to-text for spoken attempts.
- Uses structured JSON grading to decide whether the answer is correct enough to move forward.

## Setup

1. Copy `.env.example` to `.env`.
2. Put your OpenAI API key in `OPENAI_API_KEY`.
3. Start the app:

```bash
node server.js
```

4. Open `http://localhost:3000`.

## Default model choices

- Grading: `gpt-4o-mini`
- Speech to text: `gpt-4o-mini-transcribe`
- Text to speech: `gpt-4o-mini-tts`
- Default TTS voice: `shimmer`

You can change any of these in `.env`.

## Notes

- No external npm packages are required.
- If the OpenAI key is missing, the UI still loads and falls back to browser speech for Hindi narration.
- The microphone flow depends on browser support for `MediaRecorder` and user microphone permission.
