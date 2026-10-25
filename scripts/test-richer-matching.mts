import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { balancedShortlist, retrievalQueries, mapConcurrent } from "../src/lib/match-retrieval.ts";
import { feedbackPreferences, withQualityFeedback, isQualityRating } from "../src/lib/match-feedback.ts";
import { validateProfile } from "../src/lib/passage-profile.ts";
import { acceptReview, assignInsights } from "../src/lib/insight-match.ts";
import type { Candidate } from "../src/lib/match-core.ts";
const candidate = (id: string): Candidate => ({ id, author: "Author", work: "Work", year: null, text: `A passage ${id} about finding contentment in ordinary things.`, emotions: [], themes: ["meaning"], summary: null, similarity: 0.8 });
const evaluation = (id: string, kind: "recognition" | "distinction" | "reframe" = "recognition", redundant: string[] = []) => ({
  id, fit: 3, insight: 2, standalone: true, evidence: "finding contentment in ordinary things", phrase: "ordinary things",
  reason: "This passage values ordinary things. It offers a distinction between enoughness and the constant pursuit of more.",
  perspective: `${id} perspective`, connection_kind: kind, redundant_with: redundant,
});
test("retrieval creates three grounded query kinds and deduplicates fallback queries", () => {
  assert.equal(retrievalQueries({ text: "A journal line.", situation: "An event.", interpretation: "A tension.", perspective_query: "A distinction." }, "summary").length,3);
  assert.equal(retrievalQueries(null,"summary").length,1);
  assert.equal(retrievalQueries({ text:"same",interpretation:"same",perspective_query:"same" },"same").length,1);
});
test("balanced shortlist preserves a perspective channel, deduplicates and excludes risk themes", () => {
  const common=Array.from({length:30},(_,i)=>candidate(String(i)));
  const result=balancedShortlist([
    {kind:"situation",source:"semantic",candidates:common},
    {kind:"perspective",source:"profile",candidates:[candidate("special"),...common]},
  ],new Set());
  assert.equal(result.length,10); assert.ok(result.some((c)=>c.id==='special')); assert.equal(new Set(result.map((c)=>c.id)).size,10);
  assert.equal(balancedShortlist([{kind:"situation",source:"profile",candidates:[{...candidate('risk'),themes:['mortality']}]}],new Set(['mortality'])).length,0);
});
test("feedback only affects the same passage in semantically similar contexts", () => {
  const signal={passage_id:'a',rating:'misunderstood' as const,context_text:'a prior situation'};
  assert.equal(feedbackPreferences([signal],[1,0],[[0,1]]).get('a'),0);
  assert.equal(feedbackPreferences([signal],[1,0],[[1,0]]).get('a'),-1);
  assert.equal(feedbackPreferences([{...signal,rating:'helped'}],[1,0],[[1,0]]).get('a'),1);
  assert.equal(isQualityRating('invented'),false);
});
test("feedback cannot rescue a weak match; it breaks ties after fit and insight", () => {
  const cs=[candidate('a'),candidate('b')];
  const picks=acceptReview({evaluations:[evaluation('a'),evaluation('b','distinction')]},cs,new Set(),new Map([['b',1]]));
  assert.equal(picks[0].cand.id,'b');
  const stronger=acceptReview({evaluations:[{...evaluation('a'),insight:3},evaluation('b','distinction')]},cs,new Set(),new Map([['a',-1],['b',1]]));
  assert.equal(stronger[0].cand.id,'a');
  assert.equal(acceptReview({evaluations:[{...evaluation('a'),fit:1}]},cs,new Set(),new Map([['a',1]])).length,0);
});
test("alternates have different purposes and reject semantic redundancy", () => {
  const cs=['a','b','c','d'].map(candidate);
  const picks=acceptReview({evaluations:[evaluation('a'),evaluation('b'),evaluation('c','distinction',['a']),evaluation('d','reframe')]},cs);
  assert.deepEqual(assignInsights([picks])[0].map((p)=>p.cand.id),['a','d']);
  assert.throws(()=>acceptReview({evaluations:[evaluation('a','recognition',['unknown'])]},cs));
});
test("all 24 editorial annotations use unchanged source text and verified evidence", () => {
  const sources=new Map(readFileSync('data/passages.tagged.jsonl','utf8').trim().split('\n').map(JSON.parse).map((r)=>[r.id,r]));
  const profiles=readFileSync('data/passage-insights.jsonl','utf8').trim().split('\n').map(JSON.parse);
  assert.equal(profiles.length,24);
  for(const p of profiles) assert.equal(validateProfile(p,sources.get(p.id)).id,p.id);
  assert.throws(()=>validateProfile({...profiles[0],evidence:'invented evidence'},sources.get(profiles[0].id)));
});
test("bounded retrieval concurrency preserves task order", async () => {
  let active=0,max=0;
  const result=await mapConcurrent([1,2,3,4,5],2,async(n)=>{ active++;max=Math.max(max,active); await new Promise((r)=>setTimeout(r,2));active--;return n*2; });
  assert.deepEqual(result,[2,4,6,8,10]);assert.equal(max,2);
});
test("quality feedback hydration preserves primary and alternate cards", () => {
  const link={line_text:null,line_start:null,line_end:null,theme:'meaning',passage:candidate('a'),phrase_start:null,phrase_end:null,reason:'reason',score:1};
  const result=withQualityFeedback([{...link,alternates:[{...link,passage:candidate('b')}]}],[{passage_id:'b',rating:'related'}]);
  assert.equal(result[0].quality_feedback,null);assert.equal(result[0].alternates![0].quality_feedback,'related');
});

test("the same quotation under another ID cannot repeat across cards", () => {
  const a=candidate('a'),b={...candidate('b'),text:a.text};
  const picks=acceptReview({evaluations:[evaluation('a'),evaluation('b','reframe')]},[a,b]);
  assert.equal(assignInsights([picks])[0].length,1);
});
