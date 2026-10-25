-- Apply before deploying the insight matcher. Old matches remain as history:
-- saved library_items.match_id references and user feedback are never deleted.
alter table public.entries
  add column match_version int not null default 0,
  add column match_generation uuid,
  add column match_fallback boolean not null default false;
alter table public.matches add column generation uuid;
create index matches_generation_idx on public.matches(entry_id, generation);

-- One service-role-only transaction. Readers see either complete generation.
-- Lock the entry so concurrent generations cannot partially overwrite each other.
create function public.store_insight_matches(
  p_entry_id uuid, p_user_id uuid, p_text text, p_version int,
  p_analysis jsonb, p_rows jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  current_entry public.entries%rowtype;
  new_generation uuid := gen_random_uuid();
  item jsonb;
  old_feedback text;
  old_resonated boolean;
begin
  select * into current_entry from public.entries where id = p_entry_id for update;
  if not found or current_entry.user_id is distinct from p_user_id or current_entry.text is distinct from p_text then
    raise exception 'Entry changed or unavailable';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 9 then
    raise exception 'Invalid match rows';
  end if;
  for item in select value from jsonb_array_elements(p_rows) loop
    -- Carry passage feedback forward, including across different line matches.
    select m.feedback into old_feedback from public.matches m
      where m.entry_id = p_entry_id and m.passage_id = item->>'passage_id'
      and m.feedback is not null order by m.created_at desc limit 1;
    select coalesce(bool_or(m.resonated), false) into old_resonated from public.matches m
      where m.entry_id = p_entry_id and m.passage_id = item->>'passage_id';
    insert into public.matches(entry_id, generation, line_text, line_start, line_end,
      theme, passage_id, phrase_start, phrase_end, score, reason, rank, feedback, resonated)
    values(p_entry_id, new_generation, item->>'line_text', (item->>'line_start')::int,
      (item->>'line_end')::int, item->>'theme', item->>'passage_id',
      (item->>'phrase_start')::int, (item->>'phrase_end')::int, (item->>'score')::real,
      item->>'reason', (item->>'rank')::int, old_feedback, old_resonated);
  end loop;
  update public.entries set
    emotions = array(select jsonb_array_elements_text(p_analysis->'emotions')),
    themes = array(select jsonb_array_elements_text(p_analysis->'themes')),
    summary = p_analysis->>'summary', risk_flag = (p_analysis->>'risk_flag')::boolean,
    match_version = p_version, match_generation = new_generation,
    match_fallback = coalesce((p_analysis->>'fallback')::boolean, false)
    where id = p_entry_id;
  return new_generation;
end;
$$;
revoke all on function public.store_insight_matches(uuid, uuid, text, int, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.store_insight_matches(uuid, uuid, text, int, jsonb, jsonb) to service_role;
