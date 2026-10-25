"use client";

import { useEffect, useRef, useState } from "react";
import { WavRecorder } from "@/lib/wav-recorder";
import type { TranscribeResponse } from "@/lib/contract";

// 16 kHz mono WAV is ~32 KB/s and Vercel rejects request bodies over 4.5 MB,
// so recordings stop on their own at two minutes.
const MAX_SECONDS = 120;

type State = "idle" | "recording" | "transcribing";

// Tap to start, tap to stop. The transcript is handed to the Write screen for
// editing; the audio itself is never stored.
export function MicButton({ onTranscript }: { onTranscript: (text: string) => void }) {
  const [state, setState] = useState<State>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<WavRecorder | null>(null);

  async function start() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      return setError("This browser can't record audio. Try Chrome, or type instead.");
    }
    try {
      recorder.current = await WavRecorder.start();
      setSeconds(0);
      setState("recording");
    } catch {
      setError("Microphone access was blocked. Allow it in your browser, or type instead.");
    }
  }

  async function stop() {
    const rec = recorder.current;
    if (!rec) return;
    recorder.current = null;
    setState("transcribing");
    try {
      const form = new FormData();
      form.append("audio", await rec.stop(), "entry.wav");
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      if (!res.ok) throw new Error();
      const { text }: TranscribeResponse = await res.json();
      if (text.trim()) onTranscript(text.trim());
      else setError("We didn't catch any words. Try again a little closer to the mic.");
    } catch {
      setError("Transcription failed. Your recording wasn't saved. Try again, or type instead.");
    } finally {
      setState("idle");
    }
  }

  // Tick the timer while recording and stop at the cap.
  useEffect(() => {
    if (state !== "recording") return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [state]);
  useEffect(() => {
    if (state === "recording" && seconds >= MAX_SECONDS) stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, state]);

  // Release the microphone if the user leaves mid-recording.
  useEffect(() => () => void recorder.current?.stop(), []);

  const left = MAX_SECONDS - seconds;
  const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <button
        type="button"
        onClick={state === "recording" ? stop : start}
        disabled={state === "transcribing"}
        aria-pressed={state === "recording"}
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 disabled:opacity-50 ${
          state === "recording"
            ? "border-red-500 text-red-600 dark:text-red-400"
            : "border-rule hover:bg-hover"
        }`}
      >
        <span
          aria-hidden
          className={`h-2.5 w-2.5 rounded-full ${state === "recording" ? "animate-pulse bg-red-500" : "bg-hover"}`}
        />
        {state === "idle" && "Speak instead"}
        {state === "recording" && `Stop · ${clock} left`}
        {state === "transcribing" && "Transcribing…"}
      </button>
      {state === "recording" && <span className="text-muted">Listening. Audio is transcribed, then discarded.</span>}
      {error && <span className="text-red-600">{error}</span>}
    </div>
  );
}
