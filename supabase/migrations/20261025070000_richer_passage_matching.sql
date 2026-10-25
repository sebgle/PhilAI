-- Apply after 20261025060000_insight_matches.sql, before deploying version 3.
-- Adds richer passage search and private, context-specific quality feedback.
alter table public.passages
  add column central_idea text,
  add column tension text,
  add column perspective text,
  add column profile_evidence text,
  add column insight_search tsvector generated always as (
    to_tsvector('english'::regconfig, coalesce(central_idea, '') || ' ' || coalesce(tension, '') || ' ' || coalesce(perspective, ''))
  ) stored;
alter table public.passages add constraint passage_profile_evidence_valid check (
  profile_evidence is null or (char_length(profile_evidence) >= 12 and position(profile_evidence in text) > 0)
);
-- Editing a quotation invalidates annotations reviewed against its previous text.
create function public.clear_changed_passage_insights() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.text is distinct from old.text then
    new.central_idea := null; new.tension := null; new.perspective := null; new.profile_evidence := null;
  end if;
  return new;
end;
$$;
create trigger clear_changed_passage_insights before update of text on public.passages
for each row execute function public.clear_changed_passage_insights();
revoke all on function public.clear_changed_passage_insights() from public, anon, authenticated;

create index passages_insight_search_idx on public.passages using gin(insight_search);

create function public.search_passage_insights(query_text text, match_count int default 12)
returns table(id text, author text, work text, year int, text text, emotions text[], themes text[], summary text, similarity float)
language sql stable set search_path = '' as $$
  with terms as (
    select string_agg(quote_literal(term), ' | ') as query
    from unnest(tsvector_to_array(to_tsvector('english'::regconfig, left(query_text, 600)))) term
  ), q as (select to_tsquery('english'::regconfig, query) as query from terms)
  select p.id, p.author, p.work, p.year, p.text, p.emotions, p.themes, p.summary,
    ts_rank_cd(p.insight_search, q.query, 32)::float
  from public.passages p cross join q
  where p.embedding is not null and p.profile_evidence is not null and p.insight_search @@ q.query
  order by ts_rank_cd(p.insight_search, q.query, 32) desc, p.id
  limit greatest(1, least(match_count, 30));
$$;
revoke all on function public.search_passage_insights(text, int) from public, anon, authenticated;
grant execute on function public.search_passage_insights(text, int) to service_role;

create table public.match_quality_feedback (
  user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  entry_id uuid not null references public.entries(id) on delete cascade,
  passage_id text not null references public.passages(id) on delete cascade,
  context_text text not null check(char_length(context_text) between 1 and 2000),
  rating text not null check(rating in ('helped', 'related', 'misunderstood')),
  updated_at timestamptz not null default now(),
  primary key(user_id, entry_id, passage_id)
);
alter table public.match_quality_feedback enable row level security;
create policy "quality feedback: owner reads" on public.match_quality_feedback for select to authenticated
  using(user_id = (select auth.uid()));
create policy "quality feedback: owner inserts" on public.match_quality_feedback for insert to authenticated
  with check(user_id = (select auth.uid()) and exists(
    select 1 from public.entries e join public.matches m on m.entry_id = e.id
    where e.id = match_quality_feedback.entry_id and e.user_id = (select auth.uid()) and m.passage_id = match_quality_feedback.passage_id
  ));
create policy "quality feedback: owner updates" on public.match_quality_feedback for update to authenticated
  using(user_id = (select auth.uid()))
  with check(user_id = (select auth.uid()) and exists(
    select 1 from public.entries e join public.matches m on m.entry_id = e.id
    where e.id = match_quality_feedback.entry_id and e.user_id = (select auth.uid()) and m.passage_id = match_quality_feedback.passage_id
  ));
create policy "quality feedback: owner deletes" on public.match_quality_feedback for delete to authenticated
  using(user_id = (select auth.uid()));
grant select, insert, update, delete on public.match_quality_feedback to authenticated;
grant all on public.match_quality_feedback to service_role;
create index match_quality_feedback_recent_idx on public.match_quality_feedback(user_id, updated_at desc);
alter table public.matches add column connection_kind text not null default 'recognition'
  check(connection_kind in ('recognition', 'distinction', 'reframe'));

create or replace function public.store_insight_matches(
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
      theme, passage_id, phrase_start, phrase_end, score, reason, rank, feedback, resonated, connection_kind)
    values(p_entry_id, new_generation, item->>'line_text', (item->>'line_start')::int,
      (item->>'line_end')::int, item->>'theme', item->>'passage_id',
      (item->>'phrase_start')::int, (item->>'phrase_end')::int, (item->>'score')::real,
      item->>'reason', (item->>'rank')::int, old_feedback, old_resonated, coalesce(item->>'connection_kind', 'recognition'));
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

-- 24 editorial annotations grounded in the checked-in source text.
-- Skip an annotation if the database quotation differs from the reviewed text.
update public.passages p set central_idea = a.central_idea, tension = a.tension,
  perspective = a.perspective, profile_evidence = a.evidence
from (values
  (E'p_105_1dc3f305', E'I am half agony, half hope. Tell me not that I am too late, that such precious feelings are gone for ever.', E'Hope can coexist with anguish when a relationship may still be recovered.', E'Wanting another chance while fearing it is already too late.', E'Mixed hope and pain need not cancel each other.', E'I am half agony, half hope. Tell me not that I am too late, that such precious feelings are gone for ever.'),
  (E'p_1260_59826312', E'And I do not want a stranger—unsympathising, alien, different from me; I want my kindred: those with whom I have full fellow-feeling.', E'Belonging involves mutual understanding, not merely another person being present.', E'Wanting companionship without feeling understood by the available company.', E'Distinguish company from kinship and shared feeling.', E'And I do not want a stranger—unsympathising, alien, different from me; I want my kindred: those with whom I have full fellow-feeling.'),
  (E'p_205_e612206b', E'I love to be alone. I never found the companion that was so companionable as solitude.', E'Solitude can itself be a satisfying form of companionship.', E'Being alone need not mean feeling deprived of connection.', E'Distinguish chosen solitude from unwanted loneliness.', E'I love to be alone. I never found the companion that was so companionable as solitude.'),
  (E'p_205_9abed0cd', E'I learned this, at least, by my experiment; that if one advances confidently in the direction of his dreams, and endeavors to live the life which he has imagined, he will meet with a success unexpected in common hours.', E'Moving toward an imagined life can reveal unexpected forms of success.', E'Pursuing a personal dream without knowing exactly what it will bring.', E'Success can emerge from living deliberately rather than following a preset milestone.', E'I learned this, at least, by my experiment; that if one advances confidently in the direction of his dreams, and endeavors to live the life which he h'),
  (E'p_205_f6226ba4', E'Rather than love, than money, than fame, give me truth. I sat at a table where were rich food and wine in abundance, and obsequious attendance, but sincerity and truth were not; and I went away hungry from the inhospitable board.', E'External abundance cannot compensate for an absence of sincerity.', E'Receiving luxury, attention, or status while an essential need remains unmet.', E'Distinguish the appearance of being satisfied from what actually nourishes you.', E'Rather than love, than money, than fame, give me truth. I sat at a table where were rich food and wine in abundance, and obsequious attendance, but si'),
  (E'p_205_c64bb865', E'I went to the woods because I wished to live deliberately, to front only the essential facts of life, and see if I could not learn what it had to teach, and not, when I came to die, discover that I had not lived.', E'Living deliberately requires confronting what is essential in life.', E'Being occupied with life while uncertain whether one is truly living it.', E'Ask what makes a life lived rather than merely passed through.', E'I went to the woods because I wished to live deliberately, to front only the essential facts of life, and see if I could not learn what it had to teac'),
  (E'p_921_b1618d93', E'I can be perfectly happy by myself. With freedom, flowers, books, and the moon, who could not be perfectly happy?', E'Freedom and simple pleasures can make being alone fulfilling.', E'Expecting happiness to depend on company while enjoying an independent life.', E'Ordinary things can provide enough satisfaction without a grand achievement.', E'I can be perfectly happy by myself. With freedom, flowers, books, and the moon, who could not be perfectly happy?'),
  (E'p_145_04fbb9c9', E'I cannot bear to think that any one should die and leave no love behind.”', E'Love left behind matters when imagining the end of a life.', E'Fearing a life that ends without lasting affection.', E'Consider emotional legacy rather than public accomplishment.', E'I cannot bear to think that any one should die and leave no love behind.”'),
  (E'p_18269_06ccb609', E'Time heals griefs and quarrels, for we change and are no longer the same persons.', E'Time changes the person who carries a grief or quarrel.', E'Pain persists while the self experiencing it gradually changes.', E'Healing may involve becoming different rather than simply forgetting.', E'Time heals griefs and quarrels, for we change and are no longer the same persons.'),
  (E'p_2944_28f2257c', E'But we see them exchange a glance, or betray a deep emotion, and we are no longer strangers. We understand them, and take the warmest interest in the development of the romance. All mankind love a lover.', E'Recognizing another person''s deep feeling can turn a stranger into someone understood.', E'Separation from unfamiliar people alongside the capacity to recognize their emotions.', E'Shared feeling can create a bridge before personal familiarity.', E'But we see them exchange a glance, or betray a deep emotion, and we are no longer strangers. We understand them, and take the warmest interest in the '),
  (E'p_12242_0c6a7207', E'I''m nobody!  Who are you?\nAre you nobody, too?\nThen there ''s a pair of us -- don''t tell!\nThey ''d banish us, you know.', E'Two outsiders can find companionship through their shared lack of public recognition.', E'Feeling like nobody while finding someone who shares that experience.', E'Belonging can arise through mutual recognition rather than becoming important.', E'I''m nobody!  Who are you?\nAre you nobody, too?\nThen there ''s a pair of us -- don''t tell!\nThey ''d banish us, you know.'),
  (E'p_12242_079e3015', E'Success is counted sweetest\nBy those who ne''er succeed.\nTo comprehend a nectar\nRequires sorest need.', E'Lack can intensify how much success is valued.', E'Longing for an achievement that feels sweeter from a distance.', E'Wanting success and experiencing it are different positions from which to judge its worth.', E'Success is counted sweetest\nBy those who ne''er succeed.\nTo comprehend a nectar\nRequires sorest need.'),
  (E'p_1041_3d77cccf', E'All days are nights to see till I see thee,\nAnd nights bright days when dreams do show thee me.', E'Longing for an absent loved person can transform the experience of day and night.', E'Physical absence feels dark while an imagined encounter brings brightness.', E'Emotional presence can matter more to experience than physical surroundings.', E'All days are nights to see till I see thee,\nAnd nights bright days when dreams do show thee me.'),
  (E'p_58585_6cc5a163', E'And the selfsame well from which your laughter rises was oftentimes filled with your tears.', E'Laughter and tears can arise from the same emotional source.', E'Experiencing joy in a life that has also held sorrow.', E'Joy and grief need not be mutually exclusive or disloyal to one another.', E'And the selfsame well from which your laughter rises was oftentimes filled with your tears.'),
  (E'p_23_7ce60994', E'I prefer to be true to myself, even at the hazard of incurring the ridicule of others, rather than to be false, and incur my own abhorrence.', E'Being true to oneself can matter more than avoiding ridicule.', E'Choosing between others'' approval and one''s own self-respect.', E'Consider the inward cost of an outwardly acceptable performance.', E'I prefer to be true to myself, even at the hazard of incurring the ridicule of others, rather than to be false, and incur my own abhorrence.'),
  (E'p_110_4b17f04e', E'The daylight has nothing to show me, since you are not here, and I don’t like to see the rooks and starlings in the field, because I grieve and grieve to miss you who used to see them with me.', E'A loved person''s absence changes the meaning of familiar surroundings.', E'Everyday sights continue but the person who shared them is missing.', E'Missing someone can include missing the shared way of seeing ordinary life.', E'The daylight has nothing to show me, since you are not here, and I don’t like to see the rooks and starlings in the field, because I grieve and grieve'),
  (E'p_2814_bdf7679a', E'Our path through life is strewn with many such sad memories: and were we to brood upon them always we could not find the heart to go on bravely with our work among the living.', E'Remembering loss and continuing life can pull in different directions.', E'Sad memories deserve attention but constant brooding can make ongoing life harder.', E'Continuing with life need not require denying that the memories are sad.', E'Our path through life is strewn with many such sad memories: and were we to brood upon them always we could not find the heart to go on bravely with o'),
  (E'p_4217_b18f45af', E'But I will tell you also what I do not fear. I do not fear to be alone or to be spurned for another or to leave whatever I have to leave. And I am not afraid to make a mistake, even a great mistake, a lifelong mistake, and perhaps as long as eternity too.', E'Independence may require accepting solitude, rejection, and the possibility of mistakes.', E'Wanting freedom without certainty of approval or a mistake-free future.', E'The willingness to risk error can be part of choosing one''s own life.', E'But I will tell you also what I do not fear. I do not fear to be alone or to be spurned for another or to leave whatever I have to leave. And I am not'),
  (E'p_4217_c462f560', E'So be it. Welcome, O life! I go to encounter for the millionth time the reality of experience and to forge in the smithy of my soul the uncreated conscience of my race.', E'Identity can be formed through encountering life and creating something of one''s own.', E'Entering an uncertain future with a wish to shape who one becomes.', E'Identity can be something made through experience rather than found ready-made.', E'So be it. Welcome, O life! I go to encounter for the millionth time the reality of experience and to forge in the smithy of my soul the uncreated cons'),
  (E'p_135_cf63ddd1', E'On the day when a woman as she passes before you emits light as she walks, you are lost, you love.', E'Love can make another person appear transformed in perception.', E'An ordinary encounter suddenly becomes emotionally overwhelming.', E'The felt brightness of someone may reveal a change in the observer''s feelings.', E'On the day when a woman as she passes before you emits light as she walks, you are lost, you love.'),
  (E'p_135_4be02f59', E'I belong to no family. I do not belong to yours. I do not belong to any family of men. In houses where people are among themselves, I am superfluous.', E'Being physically among families can sharpen a feeling of having no place of one''s own.', E'Being present in other people''s homes but feeling superfluous.', E'Proximity to a group is different from having a recognized place within it.', E'I belong to no family. I do not belong to yours. I do not belong to any family of men. In houses where people are among themselves, I am superfluous.'),
  (E'p_28054_ad1b0177', E'I have a longing for life, and I go on living in spite of logic. Though I may not believe in the order of the universe, yet I love the sticky little leaves as they open in spring. I love the blue sky, I love some people, whom one loves you know sometimes without knowing why.', E'Attachment to particular people and small living things can persist alongside doubt about the universe.', E'Intellectual uncertainty coexists with affection for ordinary life.', E'Loving concrete parts of life need not wait for a complete explanation of existence.', E'I have a longing for life, and I go on living in spite of logic. Though I may not believe in the order of the universe, yet I love the sticky little l'),
  (E'p_58585_8012715b', E'To measure you by your smallest deed is to reckon the power of ocean by the frailty of its foam.', E'One small deed cannot adequately measure a whole person.', E'Reducing one''s identity or worth to a single action.', E'Distinguish a moment of behavior from the full scale of a life or person.', E'To measure you by your smallest deed is to reckon the power of ocean by the frailty of its foam.'),
  (E'p_216_b02f58de', E'33. 1. He who knows other men is discerning; he who knows himself is\nintelligent.  He who overcomes others is strong; he who overcomes\nhimself is mighty.  He who is satisfied with his lot is rich; he who\ngoes on acting with energy has a (firm) will.', E'Self-knowledge, self-mastery, and contentment offer measures of strength and wealth.', E'Measuring oneself through external power and possessions instead of inward capacities.', E'Consider whether enoughness and strength are being measured by the right standard.', E'33. 1. He who knows other men is discerning; he who knows himself is\nintelligent.  He who overcomes others is strong; he who overcomes\nhimself is migh')
) as a(id, source_text, central_idea, tension, perspective, evidence)
where p.id = a.id and p.text = a.source_text;
