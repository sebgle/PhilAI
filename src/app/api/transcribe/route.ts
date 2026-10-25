// T10: POST /api/transcribe (multipart, field "audio") -> { text }
// Forwards the audio to Muse Voice Transcribe in memory. Nothing is written to
// disk or storage. Muse accepts mono 16-bit PCM WAV at 16 or 24 kHz, so the
// browser should record with src/lib/wav-recorder.ts. Other containers
// (webm/ogg/mp4 from MediaRecorder) are converted with ffmpeg when it is on
// PATH (local dev only); otherwise the route returns 415.
import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { createClient } from "@/lib/supabase/server";
import type { TranscribeResponse } from "@/lib/contract";

export const runtime = "nodejs";
export const maxDuration = 60;

const MUSE_ASR_URL = process.env.MUSE_ASR_URL ?? "https://api.meta.ai/v1/asr/transcribe";

function isWav(buf: Buffer) {
  return buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WAVE";
}

function ffmpegToWav(input: Buffer): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const p = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", "-f", "wav", "pipe:1"]);
    const chunks: Buffer[] = [];
    p.stdout.on("data", (c) => chunks.push(c));
    p.on("error", () => resolve(null));
    p.on("close", (code) => resolve(code === 0 ? Buffer.concat(chunks) : null));
    p.stdin.end(input);
  });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("audio");
  if (!(file instanceof Blob)) return NextResponse.json({ error: "missing audio field" }, { status: 400 });
  let wav: Buffer = Buffer.from(new Uint8Array(await file.arrayBuffer()));
  if (!isWav(wav)) {
    const converted = await ffmpegToWav(wav);
    if (!converted) return NextResponse.json({ error: "audio must be mono 16-bit PCM WAV at 16 or 24 kHz" }, { status: 415 });
    wav = converted;
  }
  if (wav.length > 32 * 1024 * 1024) return NextResponse.json({ error: "audio too large" }, { status: 413 });

  const key = process.env.MUSE_TRANSCRIBE_API_KEY ?? process.env.MUSE_SPARK_API_KEY ?? process.env.MUSE_API_KEY;
  const out = new FormData();
  out.append("request", new Blob([JSON.stringify({ mode: "PUSH_TO_TALK", model: "muse-voice-transcribe-1.0", audioEncoding: "WAV" })], { type: "application/json" }));
  out.append("audio", new Blob([new Uint8Array(wav)], { type: "audio/wav" }), "audio.wav");
  const res = await fetch(MUSE_ASR_URL, { method: "POST", headers: { authorization: `Bearer ${key}` }, body: out });
  if (!res.ok) {
    const detail = await res.text();
    console.error("[transcribe] muse", res.status, detail.slice(0, 300));
    return NextResponse.json({ error: "transcription failed" }, { status: 502 });
  }
  const data = (await res.json()) as { transcript?: string };
  const body: TranscribeResponse = { text: (data.transcript ?? "").trim() };
  return NextResponse.json(body);
}
