-- Cache for LLM answers that depend only on the text sent: scrub and moderate.
-- The share preview and the post/reply routes run the same text through Muse
-- twice; the second time now reads the first answer. Server-only (RLS on, no
-- policies, no grants). Matches are already stored per entry in `matches`.
create table public.llm_cache (
  key text primary key,                   -- sha256 of kind + text
  kind text not null,                     -- 'scrub' | 'moderate'
  value jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.llm_cache enable row level security;
revoke all on public.llm_cache from anon, authenticated;
