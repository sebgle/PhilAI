"use client";
// Live words while recording, from the browser's built-in speech recognition
// (Chrome, Edge, Safari). It's only a preview: Muse's transcript of the full
// recording replaces it when recording stops. In Chrome the preview audio is
// processed by Google's speech service; Firefox has no support and simply
// shows no preview.

type Result = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<Result> };
type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: RecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  stop(): void;
};
type RecognitionCtor = new () => Recognition;

function ctor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const liveSpeechSupported = () => ctor() !== null;

// Starts recognition and reports the running transcript (finished phrases plus
// the phrase in progress). Chrome ends a session after a pause, so it restarts
// until stop() is called. Returns stop(), which resolves with the last text.
export function startLiveSpeech(onText: (text: string) => void): (() => string) | null {
  const Ctor = ctor();
  if (!Ctor) return null;

  let finished = "";
  let interim = "";
  let stopped = false;
  const current = () => `${finished}${interim}`.replace(/\s+/g, " ").trim();

  const rec = new Ctor();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = navigator.language || "en-US";
  rec.onresult = (e) => {
    interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finished += `${r[0].transcript} `;
      else interim += r[0].transcript;
    }
    onText(current());
  };
  rec.onerror = (e) => {
    // "no-speech" and "aborted" are routine; anything else ends the preview.
    if (e.error !== "no-speech" && e.error !== "aborted") stopped = true;
  };
  rec.onend = () => {
    if (!stopped) {
      try { rec.start(); } catch { /* already restarting */ }
    }
  };
  try {
    rec.start();
  } catch {
    return null;
  }

  return () => {
    stopped = true;
    rec.stop();
    return current();
  };
}
