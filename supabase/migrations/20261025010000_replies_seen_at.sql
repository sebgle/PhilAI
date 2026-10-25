-- Notification bell: replies to your posts newer than this are "new".
-- Updated by the server (admin client) when you open /notifications.
alter table public.users
  add column replies_seen_at timestamptz not null default now();
