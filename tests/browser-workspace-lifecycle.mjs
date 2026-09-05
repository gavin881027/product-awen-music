import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.AWEN_PLAYWRIGHT).href);
const root=path.resolve(import.meta.dirname,'..'),profile=fs.mkdtempSync(path.join(os.tmpdir(),'awen-profile-'));
const listener=net.createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const port=listener.address().port;await new Promise(r=>listener.close(r));
const url=`http://127.0.0.1:${port}/`;
const html=fs.readFileSync(path.join(root,'docs/index.html'),'utf8');
const hook=`window.__audit={editReviewedPrompt,findPromptReviewSubject, seed(){
 const ai=attachSongSunoRecipe(A.fallbackPrompt(A.DEFAULTS),sunoDefaults);
 const song={id:'AWN-9900',ai,sel:A.DEFAULTS};const draft=buildPromptReviewDraft(song);
 song.promptReview={...draft,status:'needs_revision',lastReview:{revised:{...ai.suno.recipe}}};setSongs([song]);
}};`;
let server,context;
async function start(){server=spawn('python3',['server.py','--port',String(port)],{cwd:root,stdio:'ignore'});for(let i=0;i<60;i++){try{if((await fetch(url+'api/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,50));}throw Error('server did not start');}
async function stop(){const stopped=new Promise(r=>server.once('exit',r));server.kill('SIGTERM');await stopped;}
async function open(){context=await chromium.launchPersistentContext(profile,{headless:true,channel:'chrome'});await context.route('https://**',r=>r.abort());await context.route('**/api/llm',r=>r.abort());await context.route(url,r=>r.fulfill({contentType:'text/html',body:html.replace('  // API key is requested via a React modal',hook+'\n  // API key is requested via a React modal')}));await context.addInitScript(()=>localStorage.setItem('awen_guide_seen_v1','1'));}
try{
 await start();await open();const a=await context.newPage();await a.goto(url);await a.waitForFunction(()=>!!window.__audit);
 await a.evaluate(()=>window.__audit.seed());await a.waitForFunction(()=>window.__audit.findPromptReviewSubject('AWN-9900'));
 const b=await context.newPage();await b.goto(url);await b.waitForFunction(()=>!!window.__audit);
 const first=await a.evaluate(()=>window.__audit.editReviewedPrompt('AWN-9900',{style:'first edit'}));
 if(!first)console.log('diagnostic',await a.locator('.toast').allTextContents());
 assert.equal(first,true);
 assert.equal(await a.evaluate(()=>window.__audit.editReviewedPrompt('AWN-9900',{style:'rapid latest edit'})),true);
 assert.equal(await b.evaluate(()=>window.__audit.editReviewedPrompt('AWN-9900',{style:'other tab edit'})),false);
 assert.equal(await b.evaluate(()=>JSON.parse(localStorage.getItem('awen_matrix_state_v1')).songs[0].ai.suno.recipe.style),'rapid latest edit');
 assert.ok(await b.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('awen_matrix_state_v1.writer.')).some(k=>localStorage.getItem(k).includes('other tab edit'))));
 console.log('PASS: two real tabs + rapid edits; stale save rejected and both branches retained');
 await context.close();await stop();await start();await open();const reopened=await context.newPage();await reopened.goto(url);await reopened.waitForFunction(()=>!!window.__audit);
 assert.equal(await reopened.evaluate(()=>window.__audit.findPromptReviewSubject('AWN-9900').ai.suno.recipe.style),'rapid latest edit');
 assert.ok(await reopened.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('awen_matrix_state_v1.writer.')).some(k=>localStorage.getItem(k).includes('other tab edit'))));
 console.log('PASS: complete browser close + service restart + same profile reopen, fully blocked external network; saved edit readable');
}finally{if(context)await context.close();if(server && server.exitCode===null)await stop();fs.rmSync(profile,{recursive:true,force:true});}
