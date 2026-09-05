import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.AWEN_PLAYWRIGHT).href);
const browser=await chromium.launch({headless:true,channel:'chrome'});
const html=fs.readFileSync(new URL('../docs/index.html',import.meta.url),'utf8');
const hook=`window.__audit={getLibraryStore,syncCanonicalLibraryToGitHub};`;
let remote={sha:'s0',items:[]}, puts=0, outage=true, drop=false, delay=false, release, arrived;
try{
 const ctx=await browser.newContext();await ctx.route('https://**',r=>r.abort());await ctx.addInitScript(()=>localStorage.setItem('awen_guide_seen_v1','1'));
 await ctx.route('**/api/llm',r=>r.abort());
 await ctx.route('http://127.0.0.1:8000/',r=>r.fulfill({contentType:'text/html',body:html.replace('  // API key is requested via a React modal',hook+'\n  // API key is requested via a React modal')}));
 await ctx.route('https://api.github.com/**',async r=>{
  assert.ok(r.request().url().startsWith('https://api.github.com/repos/test/library/'));
  if(outage)return r.fulfill({status:503,body:'{}'});
  if(r.request().method()==='GET')return r.fulfill({contentType:'application/json',body:JSON.stringify({sha:remote.sha,encoding:'base64',content:Buffer.from(JSON.stringify({songs:remote.items})).toString('base64')})});
  const b=r.request().postDataJSON();if(b.sha!==remote.sha)return r.fulfill({status:409,body:'{}'});
  puts++;remote={sha:'s'+puts,items:JSON.parse(Buffer.from(b.content,'base64').toString()).songs};
  if(drop){drop=false;return r.abort('failed');}
  if(delay){arrived();await new Promise(resolve=>release=resolve);delay=false;}
  return r.fulfill({contentType:'application/json',body:JSON.stringify({content:{sha:remote.sha}})});
 });
 const page=await ctx.newPage();await page.goto('http://127.0.0.1:8000/');await page.waitForFunction(()=>!!window.__audit);
 await page.evaluate(()=>{localStorage.setItem('github_repo','test/library');localStorage.setItem('github_pat','fake');window.__audit.getLibraryStore().save([{id:'t',type:'song',title:'v1'}]);});
 assert.equal(await page.evaluate(()=>window.__audit.syncCanonicalLibraryToGitHub()),false);
 assert.equal(await page.evaluate(()=>window.__audit.getLibraryStore().read().songs[0].title),'v1');
 outage=false;drop=true;
 assert.equal(await page.evaluate(()=>window.__audit.syncCanonicalLibraryToGitHub()),true);
 assert.equal(puts,1);console.log('PASS: library outage preserves local data; accepted PUT lost response reconciles without second PUT');
 await page.evaluate(()=>window.__audit.getLibraryStore().save([{id:'t',type:'song',title:'v2'}]));
 delay=true;const received=new Promise(resolve=>arrived=resolve);
 const sync=page.evaluate(()=>window.__audit.syncCanonicalLibraryToGitHub());await received;
 await page.evaluate(()=>window.__audit.getLibraryStore().save([{id:'t',type:'song',title:'v3'}]));release();
 assert.equal(await sync,false);assert.equal(await page.evaluate(()=>window.__audit.getLibraryStore().read().songs[0].title),'v3');
 assert.equal(await page.evaluate(()=>window.__audit.getLibraryStore().read().sync.pending),true);
 console.log('PASS: delayed v2 response preserves v3 and leaves it pending');
 remote.items=[{id:'t',type:'song',title:'remote-v4'}];remote.sha='external';const count=puts;
 assert.equal(await page.evaluate(()=>window.__audit.syncCanonicalLibraryToGitHub()),false);assert.equal(puts,count);
 const conflict=await page.evaluate(()=>window.__audit.getLibraryStore().read().sync.conflicts[0]);
 assert.equal(conflict.local.title,'v3');assert.equal(conflict.remote.title,'remote-v4');
 await page.reload();await page.waitForFunction(()=>!!window.__audit);
 assert.ok(await page.evaluate(()=>window.__audit.getLibraryStore().read().sync.conflicts.length));
 console.log('PASS: simultaneous local/remote changes stop PUT and retain both versions across reload');
 await ctx.close();
}finally{await browser.close();}
