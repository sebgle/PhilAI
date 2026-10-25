// Runs entirely in disposable local PostgreSQL. No credentials or production connection.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite();
await db.exec(`
 create role anon; create role authenticated; create role service_role;
 create table entries(id uuid primary key, user_id uuid, text text, emotions text[], themes text[], summary text, risk_flag boolean);
 create table matches(id uuid primary key default gen_random_uuid(), entry_id uuid references entries(id), line_text text, line_start int, line_end int, theme text, passage_id text not null, phrase_start int, phrase_end int, score real, reason text, rank int check(rank between 0 and 2), feedback text, resonated boolean default false, created_at timestamptz default now());
 create table library_items(id int primary key, match_id uuid references matches(id));
`);

await db.exec(`
 create schema auth;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
 grant usage on schema auth to authenticated;
 create table public.users(id uuid primary key);
 insert into public.users values('00000000-0000-0000-0000-000000000002'), ('00000000-0000-0000-0000-000000000003');
 create table public.passages(id text primary key, author text, work text, year int, text text, emotions text[], themes text[], summary text, embedding text);
 insert into public.passages(id,text,embedding) values('p1','sample passage','present');
 grant select on public.entries, public.matches to authenticated;
 alter table public.entries enable row level security;
 create policy own_entries on public.entries for select to authenticated using(user_id = auth.uid());
 alter table public.matches enable row level security;
 create policy own_matches on public.matches for select to authenticated using(exists(select 1 from public.entries e where e.id = entry_id and e.user_id = auth.uid()));
`);
const profiles = readFileSync('data/passage-insights.jsonl','utf8').trim().split('\n').map(JSON.parse);
const sources = new Map(readFileSync('data/passages.tagged.jsonl','utf8').trim().split('\n').map(JSON.parse).map((p) => [p.id,p]));
for (const p of profiles) {
 const source=sources.get(p.id);
 await db.query('insert into public.passages(id,author,work,year,text,emotions,themes,summary,embedding) values($1,$2,$3,$4,$5,$6,$7,$8,$9)', [source.id,source.author,source.work,source.year,source.text,source.emotions,source.themes,source.summary,'present']);
}

await db.exec(readFileSync('./supabase/migrations/20261025060000_insight_matches.sql','utf8'));
await db.exec(readFileSync('./supabase/migrations/20261025070000_richer_passage_matching.sql','utf8'));
const id='00000000-0000-0000-0000-000000000001', user='00000000-0000-0000-0000-000000000002';
await db.query('insert into entries(id,user_id,text) values($1,$2,$3)', [id,user,'journal']);
const previous=await db.query(`insert into matches(entry_id,passage_id,rank,feedback,resonated) values($1,'p1',0,'saved',true) returning id`,[id]);
await db.query('insert into library_items values(1,$1)',[previous.rows[0].id]);
const analysis={emotions:['sadness'],themes:['belonging'],summary:'summary',risk_flag:false};
const row={passage_id:'p1',rank:0,line_text:'journal',line_start:0,line_end:7,theme:'belonging',reason:'grounded reason',score:1};
async function store(rows,text='journal',owner=user) {await db.query('select store_insight_matches($1,$2,$3,$4,$5,$6)',[id,owner,text,2,analysis,rows]);}
await store([row]);
let entry=(await db.query('select * from entries')).rows[0];
assert.equal(entry.match_version,2); assert.ok(entry.match_generation);
const matches=(await db.query('select * from matches')).rows;
assert.equal(matches.length,2); assert.equal(matches[1].feedback,'saved'); assert.equal(matches[1].resonated,true);
assert.equal((await db.query('select * from library_items')).rows[0].match_id,previous.rows[0].id);
const generation=entry.match_generation;
await assert.rejects(store([row,{...row,rank:9}]));
assert.equal((await db.query('select match_generation from entries')).rows[0].match_generation,generation);
assert.equal((await db.query('select * from matches')).rows.length,2);
await assert.rejects(store([row],'changed journal'));
await assert.rejects(store([row],null));
await assert.rejects(store([row],'journal',null));
await assert.rejects(store([row],'journal','00000000-0000-0000-0000-000000000003'));
analysis.fallback = true;
await store([]);
entry=(await db.query('select * from entries')).rows[0];
assert.equal(entry.match_fallback,true);
assert.notEqual(entry.match_generation,generation); assert.equal(entry.match_version,2);
assert.equal((await db.query('select * from matches where generation=$1',[entry.match_generation])).rows.length,0);
await db.exec('set role authenticated');
await assert.rejects(store([row]));
await db.exec('reset role');
await db.exec('set role anon');
await assert.rejects(store([row]));
await db.exec('reset role');
await db.exec('set role service_role');
await store([row]);
await db.exec('reset role');
console.log('PASS: migration syntax, generation activation, preserved feedback/library reference, rollback after partial insert, stale text/owner rejection, empty generation caching, restricted RPC');

assert.equal((await db.query('select count(*)::int as n from passages where central_idea is not null')).rows[0].n,24);
assert.ok((await db.query("select * from search_passage_insights('sincerity status fulfillment',12)")).rows.some((p) => p.id === 'p_205_f6226ba4'));
assert.equal((await db.query("select * from search_passage_insights('',12)")).rows.length,0);
await db.query("select * from search_passage_insights($1,12)", ["nobody's | !drop"]);
// Two distinct authenticated users: quality feedback must not cross ownership.
const foreignEntry='00000000-0000-0000-0000-000000000004';
const otherUser='00000000-0000-0000-0000-000000000003';
await db.query('insert into entries(id,user_id,text) values($1,$2,$3)',[foreignEntry,otherUser,'other journal']);
await db.query("insert into matches(entry_id,passage_id,rank) values($1,'p1',0)",[foreignEntry]);
await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
await db.exec('set role authenticated');
await db.query("insert into match_quality_feedback(entry_id,passage_id,context_text,rating) values($1,'p1','journal','helped')",[id]);
assert.equal((await db.query('select * from match_quality_feedback')).rows.length,1);
await assert.rejects(db.query("insert into match_quality_feedback(entry_id,passage_id,context_text,rating) values($1,'p_105_1dc3f305','journal','helped')",[id]));
await assert.rejects(db.query("insert into match_quality_feedback(entry_id,passage_id,context_text,rating) values($1,'p1','other','helped')",[foreignEntry]));
await assert.rejects(db.query("update match_quality_feedback set entry_id=$1",[foreignEntry]));
await assert.rejects(db.query("update match_quality_feedback set rating='invalid'"));
await db.query("select set_config('request.jwt.claim.sub',$1,false)",[otherUser]);
assert.equal((await db.query('select * from match_quality_feedback')).rows.length,0);
assert.equal((await db.query("update match_quality_feedback set rating='related' returning *")).rows.length,0);
await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
assert.equal((await db.query("update match_quality_feedback set rating='related' returning *")).rows.length,1);
await assert.rejects(db.query("select * from search_passage_insights('hope',12)"));
await db.exec('reset role');
// The new connection type survives atomic storage too.
row.connection_kind='distinction';
await store([row]);
assert.equal((await db.query('select connection_kind from matches where generation=(select match_generation from entries where id=$1)',[id])).rows[0].connection_kind,'distinction');
await db.query("update passages set text = text || ' revised' where id='p_105_1dc3f305'");
assert.equal((await db.query("select central_idea from passages where id='p_105_1dc3f305'")).rows[0].central_idea,null);
await assert.rejects(db.query("update passages set profile_evidence='invented evidence' where id='p1'"));
console.log('PASS: stale annotation invalidation, 24 exact-text annotations, profile search, private owner-only quality feedback, invalid feedback rejection, connection-kind persistence');
await db.close();
