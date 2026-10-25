-- PhilAI initial schema (Step 0 contract).
-- Access model: the browser reads its own private rows and public rows through RLS.
-- Every write to posts/replies/reports, and everything touching user_id on them,
-- goes through server functions using the service role (that is where scrub,
-- moderation and the safety flag live). See README "Data model".

create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------
-- Handles: random "quiet-heron-41" names, generated on sign-up.
-- ---------------------------------------------------------------------------

create or replace function public.random_handle()
returns text
language sql
volatile
set search_path = ''
as $$
  select (array['quiet','gentle','restless','wandering','hidden','silver','amber','distant',
                'patient','tender','hollow','bright','soft','lucid','faded','still'])[1 + floor(random() * 16)::int]
      || '-' ||
         (array['heron','willow','lantern','sparrow','harbor','ember','meadow','comet',
                'fern','river','moth','cedar','tide','finch','ash','orchard'])[1 + floor(random() * 16)::int]
      || '-' || lpad(floor(random() * 100)::int::text, 2, '0');
$$;

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text not null unique,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  h text;
begin
  loop
    h := public.random_handle();
    exit when not exists (select 1 from public.users where handle = h);
  end loop;
  insert into public.users (id, handle) values (new.id, h);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Forums: one per theme. Slugs match shared/themes.json and are the theme tags
-- used everywhere else (entries.themes, passages.themes, matches.theme).
-- ---------------------------------------------------------------------------

create table public.forums (
  id text primary key,            -- theme slug, e.g. 'belonging'
  name text not null,
  description text not null
);

insert into public.forums (id, name, description) values
  ('belonging',  'Belonging',  'Finding your people, or feeling like you haven''t yet.'),
  ('loneliness', 'Loneliness', 'Being alone, and being lonely in a crowd.'),
  ('grief',      'Grief',      'Loss of people, places, and versions of yourself.'),
  ('love',       'Love',       'Romantic, platonic, familial, unrequited.'),
  ('longing',    'Longing',    'Wanting what''s out of reach.'),
  ('home',       'Home',       'The places that made you, and leaving them.'),
  ('family',     'Family',     'Parents, siblings, and the ties you didn''t choose.'),
  ('identity',   'Identity',   'Who you are, and who you''re performing.'),
  ('freedom',    'Freedom',    'Independence, escape, and its costs.'),
  ('ambition',   'Ambition',   'Striving, pressure, and what success is for.'),
  ('fear',       'Fear',       'Anxiety, dread, and the things that keep you up.'),
  ('hope',       'Hope',       'Holding on to something better.'),
  ('change',     'Change',     'Transitions, growing up, and starting over.'),
  ('mortality',  'Mortality',  'Time passing and the shortness of life.'),
  ('meaning',    'Meaning',    'Purpose, and whether any of it matters.'),
  ('regret',     'Regret',     'What you did, and what you didn''t.');

-- ---------------------------------------------------------------------------
-- Journal + matching.
-- Embedding dimension 384 assumes all-MiniLM-L6-v2 or gte-small. If the team
-- picks a different embedding model, change every vector(384) before loading data.
-- ---------------------------------------------------------------------------

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users (id) on delete cascade,
  text text not null,
  prompt text,
  emotions text[] not null default '{}',
  themes text[] not null default '{}',
  summary text,
  embedding extensions.vector(384),
  risk_flag boolean not null default false,
  created_at timestamptz not null default now()
);
create index entries_user_created_idx on public.entries (user_id, created_at desc);

create table public.passages (
  id text primary key,            -- stable id from the library build, e.g. 'p_0412'
  author text not null,
  work text not null,
  year int,
  text text not null,
  emotions text[] not null default '{}',
  themes text[] not null default '{}',
  summary text,
  embedding extensions.vector(384)
);
create index passages_author_idx on public.passages (author);
create index passages_embedding_idx on public.passages
  using hnsw (embedding extensions.vector_cosine_ops);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries (id) on delete cascade,
  line_text text,                 -- null on whole-entry fallback
  line_start int,
  line_end int,
  theme text references public.forums (id),
  passage_id text not null references public.passages (id),
  phrase_start int,               -- null when the echoing phrase failed verification
  phrase_end int,
  score real,
  reason text,
  feedback text check (feedback in ('saved', 'not_for_me')),
  created_at timestamptz not null default now()
);
create index matches_entry_idx on public.matches (entry_id);

-- ---------------------------------------------------------------------------
-- Personal library.
-- ---------------------------------------------------------------------------

create table public.library_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users (id) on delete cascade,
  kind text not null check (kind in ('passage', 'author', 'book', 'quote')),
  passage_id text references public.passages (id),  -- kind = 'passage'
  match_id uuid references public.matches (id) on delete set null, -- private: the line it matched
  ref text,                       -- kind = 'author' (author name) or a book/quote reference
  text text,                      -- hand-added book title or quote text
  created_at timestamptz not null default now()
);
create index library_items_user_idx on public.library_items (user_id, kind);

-- ---------------------------------------------------------------------------
-- Community. user_id is server-only: clients get column-level SELECT grants
-- that exclude it, and posts store no link to the entry they came from.
-- Aliases are fresh per thread: one alias per (thread, user), reused for that
-- user's replies in the same thread.
-- ---------------------------------------------------------------------------

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  forum_id text not null references public.forums (id),
  user_id uuid not null references public.users (id) on delete cascade,
  alias text not null,
  line_text text not null check (char_length(line_text) <= 280),
  passage_id text not null references public.passages (id),
  phrase_start int,
  phrase_end int,
  status text not null default 'visible' check (status in ('visible', 'hidden', 'removed')),
  is_seeded boolean not null default false,   -- demo seed posts, labelled if asked
  created_at timestamptz not null default now()
);
create index posts_forum_created_idx on public.posts (forum_id, created_at desc);
create index posts_passage_idx on public.posts (passage_id);

create table public.replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  alias text not null,
  text text not null check (char_length(text) <= 2000),
  status text not null default 'visible' check (status in ('visible', 'hidden', 'removed')),
  created_at timestamptz not null default now()
);
create index replies_post_created_idx on public.replies (post_id, created_at);

create table public.thread_aliases (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  alias text not null,
  primary key (post_id, user_id),
  unique (post_id, alias)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts (id) on delete cascade,
  reply_id uuid references public.replies (id) on delete cascade,
  reporter_id uuid references public.users (id) on delete set null,
  reason text,
  created_at timestamptz not null default now(),
  check ((post_id is null) <> (reply_id is null))
);

-- ---------------------------------------------------------------------------
-- Row Level Security.
-- ---------------------------------------------------------------------------

alter table public.users          enable row level security;
alter table public.forums         enable row level security;
alter table public.entries        enable row level security;
alter table public.passages       enable row level security;
alter table public.matches        enable row level security;
alter table public.library_items  enable row level security;
alter table public.posts          enable row level security;
alter table public.replies        enable row level security;
alter table public.thread_aliases enable row level security;
alter table public.reports        enable row level security;

-- users: owner only
create policy "users: read own" on public.users
  for select to authenticated using (id = (select auth.uid()));

-- forums, passages: everyone
create policy "forums: read all" on public.forums
  for select to anon, authenticated using (true);
create policy "passages: read all" on public.passages
  for select to anon, authenticated using (true);

-- entries: owner only (full CRUD so the journal works without a server hop)
create policy "entries: read own" on public.entries
  for select to authenticated using (user_id = (select auth.uid()));
create policy "entries: insert own" on public.entries
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "entries: update own" on public.entries
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "entries: delete own" on public.entries
  for delete to authenticated using (user_id = (select auth.uid()));

-- matches: owner (via entry) can read and set feedback; rows are written by the matcher
create policy "matches: read own" on public.matches
  for select to authenticated
  using (exists (select 1 from public.entries e where e.id = entry_id and e.user_id = (select auth.uid())));
create policy "matches: update own feedback" on public.matches
  for update to authenticated
  using (exists (select 1 from public.entries e where e.id = entry_id and e.user_id = (select auth.uid())))
  with check (exists (select 1 from public.entries e where e.id = entry_id and e.user_id = (select auth.uid())));
revoke update on public.matches from anon, authenticated;
grant update (feedback) on public.matches to authenticated;

-- library_items: owner only
create policy "library: read own" on public.library_items
  for select to authenticated using (user_id = (select auth.uid()));
create policy "library: insert own" on public.library_items
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "library: delete own" on public.library_items
  for delete to authenticated using (user_id = (select auth.uid()));

-- posts / replies: read visible rows, never user_id. Writes are server-only.
create policy "posts: read visible" on public.posts
  for select to anon, authenticated using (status = 'visible');
create policy "replies: read visible" on public.replies
  for select to anon, authenticated using (status = 'visible');

revoke all on public.posts, public.replies from anon, authenticated;
grant select (id, forum_id, alias, line_text, passage_id, phrase_start, phrase_end, is_seeded, created_at)
  on public.posts to anon, authenticated;
grant select (id, post_id, alias, text, created_at)
  on public.replies to anon, authenticated;

-- thread_aliases, reports: server only (RLS on, no policies, no grants)
revoke all on public.thread_aliases, public.reports from anon, authenticated;
