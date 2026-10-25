// The Step 0 contract between the app (Sebastian) and matching/AI (teammate).
// Changing a field? Update this file, scripts/build-mocks.mjs and the shared/
// mocks in the same commit, and tell the other person.
import themes from "../../shared/themes.json";
import emotions from "../../shared/emotions.json";

export const THEMES = themes;
export type ThemeSlug = (typeof themes)[number]["slug"];

export const EMOTIONS = emotions;
export type Emotion = (typeof emotions)[number];

export type Passage = {
  id: string;
  author: string;
  work: string;
  year: number | null;
  text: string;
};

// One highlighted line of the entry linked to one passage. Offsets are
// character indexes, end exclusive. On fallback the line_* fields are null;
// phrase_* are null when the echoing phrase failed the exact-match check.
export type MatchLink = {
  line_text: string | null;
  line_start: number | null;
  line_end: number | null;
  theme: ThemeSlug;
  passage: Passage;
  phrase_start: number | null;
  phrase_end: number | null;
  reason: string;
  score: number;
  // The two runners-up for the same line, same shape, never nested further.
  // Absent on whole-entry fallback links and on the mocks.
  alternates?: MatchLink[];
  // The reader said this one spoke to them (matches.resonated).
  resonated?: boolean;
  connection_kind?: "recognition" | "distinction" | "reframe";
  quality_feedback?: "helped" | "related" | "misunderstood" | null;
};

// POST /match  { entry_id }  ->  MatchResponse
export type MatchResponse = {
  entry_id: string;
  emotions: Emotion[];
  themes: ThemeSlug[];
  risk_flag: boolean; // true: show 988 card, lock sharing, links may be empty
  fallback: boolean; // true: whole-entry match, no highlights
  links: MatchLink[]; // 0-3 primary cards; passages are unique, authors may repeat
};

// POST /scrub  { text }  ->  ScrubResponse
export type ScrubSpan = {
  start: number;
  end: number;
  type: "name" | "place" | "school" | "email" | "phone" | "other";
  value: string;
};
export type ScrubResponse = { text: string; spans: ScrubSpan[] };

// POST /transcribe  multipart form, field "audio"  ->  TranscribeResponse
// The audio is passed to Muse transcription and never stored.
export type TranscribeResponse = { text: string };

// POST /moderate  { text }  ->  ModerateResponse
export type ModerateResponse =
  | { status: "ok"; reason: null }
  | { status: "flagged"; reason: string };
