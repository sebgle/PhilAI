"use client";

import { useEffect, useRef, useState } from "react";
import { WavRecorder } from "@/lib/wav-recorder";
import { startLiveSpeech } from "@/lib/live-speech";
import type { TranscribeResponse } from "@/lib/contract";

// 16 kHz mono WAV is ~32 KB/s and Vercel rejects request bodies over 4.5 MB,
// so recordings stop on their own at two minutes.
const MAX_SECONDS = 120;

type State = "idle" | "recording" | "transcribing";

// Tap to start, tap to stop. While recording, the browser's speech recognition
// types words live (onLive) and the box is read-only. On stop the live words
// are committed at once (onTranscript) so the box is editable again right
// away; when Muse's transcript of the recording arrives, onReplace swaps the
// live chunk for it. If Muse fails, the live text simply stays. The audio
// itself is never stored.
export function MicButton({
  onLive,
  onTranscript,
  onReplace,
}: {
  onLive: (text: string | null) => void;
  onTranscript: (text: string) => void;
  onReplace: (from: string, to: string) => void;
}) {
  const [state, setState] = useState<State>("idle");
  const [seconds, setSeconds] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<WavRecorder | null>(null);
  const stopLive = useRef<(() => string) | null>(null);
  const liveSession = useRef(0);

  async function start() {
    setError(null);
    setNote(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      return setError("This browser can't record audio. Try Chrome, or type instead.");
    }
    try {
      recorder.current = await WavRecorder.start();
    } catch {
      return setError("Microphone access was blocked. Allow it in your browser, or type instead.");
    }
    // Only pass live words along while this recording is still running.
    const session = ++liveSession.current;
    stopLive.current = startLiveSpeech((t) => { if (liveSession.current === session && recorder.current) onLive(t); });
    onLive("");
    setSeconds(0);
    setState("recording");
  }

  async function stop() {
    const rec = recorder.current;
    if (!rec) return;
    recorder.current = null;
    const liveText = (stopLive.current?.() ?? "").trim();
    stopLive.current = null;
    // Hand the words over now; the box is editable again from this moment.
    onLive(null);
    if (liveText) onTranscript(liveText);
    setState("transcribing");
    try {
      const form = new FormData();
      form.append("audio", await rec.stop(), "entry.wav");
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      if (!res.ok) throw new Error();
      const { text }: TranscribeResponse = await res.json();
      const final = text.trim();
      if (final && liveText) onReplace(liveText, final);
      else if (final) onTranscript(final);
      else if (!liveText) setError("We didn't catch any words. Try again a little closer to the mic.");
    } catch {
      if (liveText) setNote("Kept the live transcript; the full transcription didn't go through.");
      else setError("Transcription failed. Your recording wasn't saved. Try again, or type instead.");
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
  useEffect(
    () => () => {
      stopLive.current?.();
      void recorder.current?.stop();
    },
    [],
  );

  const left = MAX_SECONDS - seconds;
  const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;

  const label =
    state === "idle" ? "Speak instead" : state === "recording" ? `Stop recording, ${clock} left` : "Finishing transcript";
  // One line, to the right of Save: the mic, then a short status that trims
  // rather than wraps.
  const status =
    state === "recording"
      ? `${clock} · Listening. Audio isn't stored.`
      : state === "transcribing"
        ? "Finishing transcript…"
        : error ?? note;
  return (
    <div className="flex min-w-0 items-center gap-2 text-sm">
      <button
        type="button"
        onClick={state === "recording" ? stop : start}
        disabled={state === "transcribing"}
        aria-pressed={state === "recording"}
        aria-label={label}
        title={label}
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-50 ${
          state === "recording"
            ? "animate-pulse bg-terracotta/10 text-terracotta"
            : "text-muted hover:bg-hover hover:text-foreground"
        }`}
      >
        {state === "recording" ? <StopIcon /> : <MicIcon />}
      </button>
      {status && (
        <span className={`truncate ${error ? "text-red-600" : "text-muted"}`} title={status}>
          {status}
        </span>
      )}
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="5" y="5" width="14" height="14" rx="2" />
    </svg>
  );
}
