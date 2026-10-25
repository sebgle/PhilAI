"use client";

import { useEffect, useRef, useState } from "react";
import { WavRecorder } from "@/lib/wav-recorder";
import { liveSpeechSupported, startLiveSpeech } from "@/lib/live-speech";
import type { TranscribeResponse } from "@/lib/contract";

// 16 kHz mono WAV is ~32 KB/s and Vercel rejects request bodies over 4.5 MB,
// so recordings stop on their own at two minutes.
const MAX_SECONDS = 120;

type State = "idle" | "recording" | "transcribing";

// Tap to start, tap to stop. While recording, the browser's speech recognition
// types words live (onLive); on stop, Muse transcribes the whole recording and
// its text replaces the preview (onTranscript). If Muse fails, the live text
// is kept so nothing said is lost. The audio itself is never stored.
export function MicButton({
  onLive,
  onTranscript,
}: {
  onLive: (text: string | null) => void;
  onTranscript: (text: string) => void;
}) {
  const [state, setState] = useState<State>("idle");
  const [seconds, setSeconds] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<WavRecorder | null>(null);
  const stopLive = useRef<(() => string) | null>(null);

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
    stopLive.current = startLiveSpeech((t) => onLive(t));
    onLive("");
    setSeconds(0);
    setState("recording");
  }

  async function stop() {
    const rec = recorder.current;
    if (!rec) return;
    recorder.current = null;
    const liveText = stopLive.current?.() ?? "";
    stopLive.current = null;
    setState("transcribing");
    try {
      const form = new FormData();
      form.append("audio", await rec.stop(), "entry.wav");
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      if (!res.ok) throw new Error();
      const { text }: TranscribeResponse = await res.json();
      if (text.trim()) onTranscript(text.trim());
      else if (liveText) onTranscript(liveText);
      else setError("We didn't catch any words. Try again a little closer to the mic.");
    } catch {
      if (liveText) {
        onTranscript(liveText);
        setNote("Kept the live transcript; the full transcription didn't go through.");
      } else {
        setError("Transcription failed. Your recording wasn't saved. Try again, or type instead.");
      }
    } finally {
      onLive(null);
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
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <button
        type="button"
        onClick={state === "recording" ? stop : start}
        disabled={state === "transcribing"}
        aria-pressed={state === "recording"}
        aria-label={label}
        title={label}
        className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors disabled:opacity-50 ${
          state === "recording"
            ? "animate-pulse border-terracotta bg-terracotta/10 text-terracotta"
            : "border-rule text-muted hover:bg-hover hover:text-foreground"
        }`}
      >
        {state === "recording" ? <StopIcon /> : <MicIcon />}
      </button>
      {state === "recording" && <span className="tabular-nums text-muted">{clock}</span>}
      {state === "transcribing" && <span className="text-muted">Finishing transcript…</span>}
      {state === "recording" && (
        <span className="text-muted">
          {liveSpeechSupported() ? "Live preview by your browser; the final transcript comes from Muse. Audio isn't stored." : "Listening. Audio isn't stored."}
        </span>
      )}
      {note && <span className="text-muted">{note}</span>}
      {error && <span className="text-red-600">{error}</span>}
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
