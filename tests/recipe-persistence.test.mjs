import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const file=process.env.AWEN_BASELINE || new URL('../docs/index.html',import.meta.url);
const html=fs.readFileSync(file,'utf8'),ctx=vm.createContext({});
vm.runInContext(html.slice(html.indexOf('const SUNO_DEFAULTS_KEY ='),html.indexOf('function sunoRecipeChecklist(')),ctx);
const plain=x=>JSON.parse(JSON.stringify(x));
const recipe={lyricsRoute:'instrumental',structurePrompt:'',lyricsSkeleton:'',style:'felt piano',exclude:'vocals, singing, spoken word, harsh percussion, sudden dynamics, crisp, polished',weirdness:21,styleInfluence:83,durationSec:420,title:'kept',workspace:'original workspace'};
test('单曲持久配方不被当前默认值重建，刷新保持所有字段',()=>{
 const ai={title:'kept',suno:{lyrics:'[Intro]',style:'older style',recipe}};
 const result=ctx.attachSongSunoRecipe(ai,{lyricsRoute:'structure-prompt',weirdness:50,durationSec:300});
 assert.deepEqual(plain(result.suno.recipe),recipe);
});
test('专辑已编辑配方正文、参数、workspace 在读取后保持',()=>{
 const edited={...recipe,lyricsRoute:'structure-prompt',structurePrompt:'My manually edited arc',lyricsSkeleton:'[Quiet]'};
 const album={album:'album',tracks:[{title:'kept',style:'old',lyrics:'[Intro]',sunoRecipe:edited}]};
 assert.deepEqual(plain(ctx.attachAlbumSunoRecipes(album,{}).tracks[0].sunoRecipe),edited);
});
