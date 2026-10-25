-- Alternates and "spoke to me".
--
-- rank: 0 is the passage shown for a line, 1 and 2 are the runners-up kept
-- so the reader can compare. Fallback (whole-entry) rows are all rank 0.
alter table public.matches
  add column rank int not null default 0 check (rank between 0 and 2);

-- resonated: the reader said this passage spoke to them. Independent of
-- feedback (saved / not_for_me): it is a signal for ranking, not a bookmark.
-- Owners may set it from the Matches screen, like feedback.
alter table public.matches
  add column resonated boolean not null default false;
grant update (resonated) on public.matches to authenticated;
-- Ranking reads a user's resonated rows by author; cheap to find them.
create index matches_resonated_idx on public.matches (entry_id) where resonated;
