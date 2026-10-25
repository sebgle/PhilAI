-- Threaded replies and likes.
--
-- replies.parent_id: a reply can answer another reply in the same thread.
-- Null means a direct reply to the post. Removing a parent cascades to its
-- children, like removing a post does today. Clients get the column through
-- the same explicit grant list as the other reply columns (never user_id).
alter table public.replies
  add column parent_id uuid references public.replies (id) on delete cascade;
create index replies_parent_idx on public.replies (parent_id) where parent_id is not null;
grant select (parent_id) on public.replies to anon, authenticated;

-- likes: one per person per post or reply. Server-only like thread_aliases
-- and reports: RLS on, no policies, no grants. Pages count likes through the
-- admin client and tell the viewer only which ones are theirs.
create table public.likes (
  user_id uuid not null references public.users (id) on delete cascade,
  post_id uuid references public.posts (id) on delete cascade,
  reply_id uuid references public.replies (id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((post_id is null) <> (reply_id is null))
);
-- Partial unique indexes double as the lookup indexes for counting and for
-- the cascade from posts/replies/users.
create unique index likes_post_user_idx on public.likes (post_id, user_id) where post_id is not null;
create unique index likes_reply_user_idx on public.likes (reply_id, user_id) where reply_id is not null;
create index likes_user_idx on public.likes (user_id);

alter table public.likes enable row level security;
revoke all on public.likes from anon, authenticated;
