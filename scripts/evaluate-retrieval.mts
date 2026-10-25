// Fully offline: controlled retrieval recall, not an end-to-end AI quality score.
// npx tsx scripts/evaluate-retrieval.mts --out=work/retrieval-evaluation.json
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { reviewPassages, assignInsights } from "../src/lib/insight-match.ts";
import { embed, cosine } from "../src/lib/embed.ts";
import { balancedShortlist, retrievalQueries, type RetrievalGroup } from "../src/lib/match-retrieval.ts";
import type { Candidate } from "../src/lib/match-core.ts";
const out=process.argv.find((a)=>a.startsWith('--out='))?.slice(6) ?? 'work/retrieval-evaluation.json';
const fixtures=JSON.parse(readFileSync('shared/retrieval-evaluation.json','utf8')) as { id:string; text:string; situation:string; interpretation:string; perspective_query:string; expected_passage_ids:string[] }[];
const corpus=readFileSync('data/passages.tagged.jsonl','utf8').trim().split('\n').map(JSON.parse).filter((r)=>r.quality>=3) as (Candidate & {quality:number})[];
const matrix:number[][]=[];
for(let i=0;i<corpus.length;i+=64){ matrix.push(...await embed(corpus.slice(i,i+64).map((p)=>p.summary || p.text))); console.log(`Embedded ${Math.min(i+64,corpus.length)}/${corpus.length} local passage summaries`); }
const db=new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role;
create table passages(id text primary key,author text,work text,year int,text text,emotions text[],themes text[],summary text,embedding text);`);
for(const p of corpus) await db.query('insert into passages values($1,$2,$3,$4,$5,$6,$7,$8,$9)',[p.id,p.author,p.work,p.year,p.text,p.emotions,p.themes,p.summary,'present']);
const migration=readFileSync('supabase/migrations/20261025070000_richer_passage_matching.sql','utf8');
await db.exec(migration.slice(0,migration.indexOf('create table public.match_quality_feedback')));
await db.exec(migration.slice(migration.indexOf('-- 24 editorial annotations')));
const reports=[];
let baselineHits=0,newHits=0,total=0;
const caseId=process.argv.find((a)=>a.startsWith('--case='))?.slice(7);
for(const f of fixtures.filter((f)=>!caseId || f.id===caseId)){
  const plan=retrievalQueries(f,f.interpretation);
  const vectors=await embed([`${f.text} ${f.interpretation}`,...plan.map((q)=>q.text)]);
  const semantic=(vector:number[])=>corpus.map((c,i)=>({...c,similarity:cosine(vector,matrix[i])})).sort((a,b)=>b.similarity-a.similarity).slice(0,30);
  const baseline=semantic(vectors[0]).slice(0,10);
  const groups:RetrievalGroup[]=[];
  for(let i=0;i<plan.length;i++){
    groups.push({kind:plan[i].kind,source:'semantic',candidates:semantic(vectors[i+1])});
    const profiles=await db.query('select * from search_passage_insights($1,12)',[plan[i].text]);
    groups.push({kind:plan[i].kind,source:'profile',candidates:profiles.rows as Candidate[]});
  }
  const expanded=balancedShortlist(groups,new Set());
  const hit=(cs:Candidate[])=>f.expected_passage_ids.some((id)=>cs.some((c)=>c.id===id));
  if(f.expected_passage_ids.length){total++;baselineHits+=Number(hit(baseline));newHits+=Number(hit(expanded));}
  let modelReview: unknown = undefined;
  if(process.argv.includes('--review')) {
    try {
      const accepted=await reviewPassages({line:f.text,interpretation:f.interpretation,context:f.text,candidates:expanded,excluded:new Set(),deadline:Date.now()+40_000});
      modelReview=assignInsights([accepted])[0].map((p)=>({id:p.cand.id,text:p.cand.text,reason:p.reason,connection_kind:p.connection_kind}));
    } catch { modelReview={error:"Model comparison did not complete"}; }
  }
  reports.push({id:f.id,modelReview,expected:f.expected_passage_ids,baseline_hit:hit(baseline),expanded_hit:hit(expanded),
    baseline:baseline.map((c)=>({id:c.id,author:c.author,text:c.text})),expanded:expanded.map((c)=>({id:c.id,author:c.author,text:c.text}))});
}
const result={method:'Controlled offline recall@10 with authored queries and expected passages; not model selection or a blind test. Candidate corpus quality>=3; production corpus may differ.',corpus_size:corpus.length,positive_cases:total,baseline_hits:baselineHits,expanded_hits:newHits,baseline_recall:baselineHits/total,expanded_recall:newHits/total,results:reports};
mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({positive_cases:total,baseline_hits:baselineHits,expanded_hits:newHits,baseline_recall:baselineHits/total,expanded_recall:newHits/total}));
await db.close();
