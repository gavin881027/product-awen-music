// Real React runtime in an isolated Chrome context; GitHub is an in-memory API.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.AWEN_PLAYWRIGHT).href);
const browser=await chromium.launch({headless:true,channel:'chrome'});
const html=fs.readFileSync(new URL('../docs/index.html',import.meta.url),'utf8');
const hook=`window.__audit = { buildPromptReviewDraft, applyPromptReview, editReviewedPrompt, retryPendingReviews, submitPromptReview,
  findPromptReviewSubject, syncCanonicalLibraryToGitHub, getLibraryStore, markPromptReviewApplied, adoptPromptReviewRevision,
  seed(id = 'AWN-9991') { const ai=attachSongSunoRecipe(A.fallbackPrompt(A.DEFAULTS), sunoDefaults);
    const song={id,ai,sel:A.DEFAULTS,createdAt:'2026-01-01T00:00:00Z'};
    song.promptReview=buildPromptReviewDraft(song); setSongs([song]); return song; },
  result(id = 'AWN-9991') { const s=findPromptReviewSubject(id); return {id:s.id,sourceHash:s.promptReview.sourceHash,
    decision:'approve',scores:{focus:8,dynamicStability:8,vocalSafety:8,warmth:8,loopability:8},
    revised:{lyricsRoute:'instrumental',structurePrompt:'',style:'quiet felt piano',exclude:SUNO_EXCLUDE_DEFAULT,title:'Isolated audit'},changes:[],risks:[]}; }
};`;
const files=new Map();let puts=[];let outage=true,loseResponse=false;
try {
 const context=await browser.newContext();
 await context.route('https://**',r=>r.abort());
 await context.addInitScript(()=>{
  localStorage.setItem('awen_guide_seen_v1','1');
  localStorage.setItem('prompt_review_github_pat','isolated-fake');
  localStorage.setItem('prompt_review_github_repo','test/reviews');
 });
 await context.route('**/api/llm',r=>r.abort());
 await context.route('http://127.0.0.1:8000/',r=>r.fulfill({contentType:'text/html',body:html.replace('  // API key is requested via a React modal',hook+'\n  // API key is requested via a React modal')}));
 await context.route('https://api.github.com/**',async route=>{
  const req=route.request(), path=decodeURIComponent(new URL(req.url()).pathname.split('/contents/')[1]||'');
  if(!req.url().startsWith('https://api.github.com/repos/test/reviews/')) throw Error('unexpected remote');
  const old=files.get(path);
  if(req.method()==='GET') return route.fulfill({status:old?200:404,contentType:'application/json',body:JSON.stringify(old?{sha:old.sha,encoding:'base64',content:Buffer.from(old.text).toString('base64')}:{message:'missing'})});
  assert.equal(req.method(),'PUT');
  if(outage && path==='manifest.json') return route.fulfill({status:503,body:'{}'});
  const body=req.postDataJSON();
  if(old && body.sha!==old.sha) return route.fulfill({status:409,body:'{}'});
  const sha='sha-'+(puts.length+1);files.set(path,{sha,text:Buffer.from(body.content,'base64').toString()});puts.push(path);
  if(loseResponse && path.startsWith('reviews/')) {loseResponse=false;return route.abort('failed');}
  return route.fulfill({contentType:'application/json',body:JSON.stringify({content:{sha}})});
 });
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8000/');await page.waitForFunction(()=>!!window.__audit);
 await page.evaluate(()=>window.__audit.seed());
 await page.waitForFunction(()=>window.__audit.findPromptReviewSubject('AWN-9991'));
 assert.equal(await page.evaluate(()=>window.__audit.submitPromptReview('AWN-9991')),false);
 const submittedPuts=puts.length;
 await page.reload();await page.waitForFunction(()=>!!window.__audit);outage=false;
 await page.evaluate(()=>window.__audit.retryPendingReviews());
 assert.equal(puts.length-submittedPuts,1,'draft resume writes only missing manifest');
 console.log('PASS: submitted draft + failed manifest -> refresh -> durable resume without overwriting draft');
 outage=true;
 const raw=await page.evaluate(()=>JSON.stringify(window.__audit.result()));
 const first=await page.evaluate(raw=>window.__audit.applyPromptReview('AWN-9991',raw),raw);
 assert.equal(first,false);assert.equal(files.size,4,'source, original manifest, review and approved survive partial failure');
 assert.equal(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('awen_review_operation_v1.')).map(k=>JSON.parse(localStorage.getItem(k))).filter(x=>x.status!=='complete').length),1);
 await page.reload();await page.waitForFunction(()=>!!window.__audit);
 outage=false;
 await page.getByRole('button',{name:'重试未完成审核',exact:true}).click();
 await page.waitForFunction(()=>window.__audit.findPromptReviewSubject('AWN-9991')?.promptReview.status==='approved');
 assert.equal(puts.filter(p=>p.startsWith('reviews/')).length,1,'identical retry must not rewrite review timestamp');
 assert.equal(puts.filter(p=>p.startsWith('prompts/approved/')).length,1);
 assert.equal(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('awen_review_operation_v1.')).map(k=>JSON.parse(localStorage.getItem(k))).filter(x=>x.status!=='complete').length),0);
 console.log('PASS: partial 3-file failure -> refresh -> resume exact bytes -> local approval; no duplicate history');
 const before=await page.evaluate(()=>window.__audit.findPromptReviewSubject('AWN-9991').promptReview.sourceHash);
 assert.equal(await page.evaluate(()=>window.__audit.editReviewedPrompt('AWN-9991',{style:'new manual felt piano'})),true);
 const edited=await page.evaluate(()=>window.__audit.findPromptReviewSubject('AWN-9991'));
 assert.notEqual(edited.promptReview.sourceHash,before);assert.equal(edited.promptReview.status,'needs_revision');assert.equal(edited.promptReview.approvedPath,null);
 await page.reload();await page.waitForFunction(()=>!!window.__audit);
 assert.equal(await page.evaluate(()=>window.__audit.findPromptReviewSubject('AWN-9991').ai.suno.recipe.style),'new manual felt piano');
 console.log('PASS: manual edit invalidates approval and sourceHash; immediate refresh preserves result');
 const raw2=await page.evaluate(()=>JSON.stringify(window.__audit.result()));loseResponse=true;
 assert.equal(await page.evaluate(raw=>window.__audit.applyPromptReview('AWN-9991',raw),raw2),false);
 const count=puts.length;
 await page.reload();await page.waitForFunction(()=>!!window.__audit);
 await page.evaluate(()=>window.__audit.retryPendingReviews());
 assert.equal(puts.length-count,2,'retry only missing approved + manifest');
 assert.equal(await page.evaluate(()=>window.__audit.findPromptReviewSubject('AWN-9991').promptReview.status),'approved');
 console.log('PASS: accepted PUT with lost response -> reload -> GET reconciliation -> completes without duplicate PUT');
 outage=true;
 assert.equal(await page.evaluate(()=>window.__audit.markPromptReviewApplied('AWN-9991')),false);
 const marked=puts.length;
 await page.reload();await page.waitForFunction(()=>!!window.__audit);outage=false;
 await page.evaluate(()=>window.__audit.retryPendingReviews());
 assert.equal(await page.evaluate(()=>window.__audit.findPromptReviewSubject('AWN-9991').promptReview.status),'applied_to_suno');
 assert.equal(puts.length-marked,1,'applied event is stable; only manifest missing');
 console.log('PASS: manual applied-to-Suno tracking resumes stable event after manifest failure (no Suno calls)');
 await page.evaluate(()=>window.__audit.seed('AWN-9992'));
 await page.waitForFunction(()=>window.__audit.findPromptReviewSubject('AWN-9992'));
 const needs=await page.evaluate(()=>JSON.stringify({...window.__audit.result('AWN-9992'),decision:'needs_revision'}));
 outage=true;
 assert.equal(await page.evaluate(raw=>window.__audit.applyPromptReview('AWN-9992',raw,{autoAdoptNeedsRevision:true}),needs),false);
 const partial=puts.length;
 await page.reload();await page.waitForFunction(()=>!!window.__audit);outage=false;
 await page.evaluate(()=>window.__audit.retryPendingReviews());
 assert.equal(puts.length-partial,1,'auto-adopt retry writes only missing manifest');
 assert.equal(await page.evaluate(()=>window.__audit.findPromptReviewSubject('AWN-9992').promptReview.status),'in_review');
 console.log('PASS: auto-adopt revision resumes original review + adoption + next draft after partial failure');
 await page.evaluate(()=>window.__audit.seed('AWN-9993'));
 await page.waitForFunction(()=>window.__audit.findPromptReviewSubject('AWN-9993'));
 const manual=await page.evaluate(()=>JSON.stringify({...window.__audit.result('AWN-9993'),decision:'needs_revision'}));
 assert.equal(await page.evaluate(raw=>window.__audit.applyPromptReview('AWN-9993',raw),manual),true);
 outage=true;
 assert.equal(await page.evaluate(()=>window.__audit.adoptPromptReviewRevision('AWN-9993')),false);
 const adoptPartial=puts.length;
 await page.reload();await page.waitForFunction(()=>!!window.__audit);outage=false;
 await page.evaluate(()=>window.__audit.retryPendingReviews());
 assert.equal(puts.length-adoptPartial,1);
 assert.equal(await page.evaluate(()=>window.__audit.findPromptReviewSubject('AWN-9993').promptReview.status),'in_review');
 console.log('PASS: explicit adopt-and-resubmit action survives partial write + restart');
 const bytes=await page.evaluate(()=>localStorage.getItem('awen_matrix_state_v1'));
 await page.evaluate(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='awen_matrix_state_v1')throw Error('isolated quota');return set.call(this,k,v);};});
 assert.equal(await page.evaluate(()=>window.__audit.editReviewedPrompt('AWN-9993',{style:'must not report saved'})),false);
 assert.equal(await page.evaluate(()=>localStorage.getItem('awen_matrix_state_v1')),bytes);
 console.log('PASS: actual manual editor returns failure on quota, preserves original workspace bytes');
 assert.deepEqual(errors,[]);await context.close();
} finally {await browser.close();}
