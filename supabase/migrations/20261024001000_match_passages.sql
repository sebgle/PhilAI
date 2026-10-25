-- T5: cosine-similarity retrieval over passages, called by /api/match with the
-- secret key. Returns the nearest match_count passages to a 384-d query.
create or replace function public.match_passages(
  query_embedding extensions.vector(384),
  match_count int default 30
)
returns table (
  id text,
  author text,
  work text,
  year int,
  text text,
  emotions text[],
  themes text[],
  summary text,
  similarity float
)
language sql
stable
set search_path = ''
as $$
  select p.id, p.author, p.work, p.year, p.text, p.emotions, p.themes, p.summary,
         1 - (p.embedding operator(extensions.<=>) query_embedding) as similarity
  from public.passages p
  where p.embedding is not null
  order by p.embedding operator(extensions.<=>) query_embedding
  limit match_count;
$$;

-- Server-only: the matcher calls it with the service role.
revoke execute on function public.match_passages(extensions.vector(384), int) from public, anon, authenticated;
