/* Sweep for boxes whose content is taller than the box while overflow-y is
   hidden, i.e. something silently sliced.
   ⛔ v1 of this script was VACUOUS: it cycled screens with LB_DEV.show(), which
   never runs the paint functions, so every list it measured was EMPTY and an
   empty list never overflows. It reported clean against a file with a known
   clipping defect. It navigates by tapping real controls now, and it is proved
   by re-running it against that defect. */
import { createRequire } from "module";
const require = createRequire(import.meta.url);
/* puppeteer lives in the lucid-winds tree, same as check.js resolves it */
const p = require(require.resolve("puppeteer", { paths: ["/workspaces/lucid-winds"] }));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const b=await p.launch({headless:"new",args:["--no-sandbox","--disable-setuid-sandbox","--disable-gpu"]});
const scan=`(()=>{const hits=[];const on=[...document.querySelectorAll('.screen')].filter(e=>getComputedStyle(e).display!=='none');
  on.forEach(s=>s.querySelectorAll('*').forEach(e=>{const c=getComputedStyle(e);
    if(c.display==='none'||c.visibility==='hidden')return;
    const over=e.scrollHeight-e.clientHeight;
    if(over>2&&(c.overflowY==='hidden'||c.overflow==='hidden'))
      hits.push({screen:s.id,el:(e.id?'#'+e.id:'.'+String(e.className).split(' ')[0]),over,clientH:e.clientHeight});}));
  return hits;})()`;
async function tapId(pg,id){
  const r=await pg.evaluate(i=>{const e=document.getElementById(i);if(!e)return null;
    const b=e.getBoundingClientRect(); if(b.height<4)return null;
    const x=b.left+b.width/2,y=b.top+b.height/2,h=document.elementFromPoint(x,y);
    if(!h||(h!==e&&!e.contains(h)))return null; return {x,y};},id);
  if(!r) return false; await pg.touchscreen.tap(r.x,r.y); await sleep(1200); return true;
}
async function tapSel(pg,sel){
  const r=await pg.evaluate(s=>{const e=document.querySelector(s);if(!e)return null;
    const b=e.getBoundingClientRect(); if(b.height<4)return null;
    const x=b.left+b.width/2,y=b.top+b.height/2,h=document.elementFromPoint(x,y);
    if(!h||(h!==e&&!e.contains(h)))return null; return {x,y};},sel);
  if(!r) return false; await pg.touchscreen.tap(r.x,r.y); await sleep(1400); return true;
}
let total=0;
for(const [w,h,tag] of [[412,915,"portrait"],[915,412,"landscape"]]){
  const pg=await b.newPage();
  await pg.setViewport({width:w,height:h,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await pg.evaluateOnNewDocument(()=>{try{localStorage.clear();localStorage.setItem("lb_how","1");}catch(e){}});
  await pg.goto("http://127.0.0.1:8781/index.html?lbtest=1",{waitUntil:"domcontentloaded",timeout:45000});
  await sleep(2000);
  await pg.evaluate(async()=>{const D=window.LB_DEV;for(let i=0;i<6;i++){D.setShinies(400);await D.doMint();D.keep();}D.setShinies(400);D.setChamp(0);});
  const seen={}; const note=hs=>hs.forEach(o=>{const k=tag+o.screen+o.el;if(!seen[k]||seen[k].over<o.over)seen[k]={...o,tag};});
  /* HOME */            note(await pg.evaluate(scan));
  /* BUGDEX */          if(await tapId(pg,'b-dex')){ note(await pg.evaluate(scan)); await tapId(pg,'b-dex-back'); }
  /* THE DUMPSTER */    if(await tapId(pg,'b-dump')){ note(await pg.evaluate(scan));
                          if(await tapSel(pg,'#k-list > *')){ note(await pg.evaluate(scan));   /* arena */
                            if(await tapSel(pg,'#a-moves > *')) note(await pg.evaluate(scan)); } }
  await pg.evaluate(()=>window.LB_DEV.show('s-home')); await sleep(500);
  /* MINT */            if(await tapId(pg,'b-mint')){ await sleep(1500); note(await pg.evaluate(scan)); }
  await pg.evaluate(()=>window.LB_DEV.show('s-home')); await sleep(500);
  /* BLOCK + a job */   if(await tapId(pg,'b-scav')){ note(await pg.evaluate(scan));
                          if(await tapSel(pg,'#s-block [data-job="grub"]')){ await sleep(1500); note(await pg.evaluate(scan)); } }
  const list=Object.values(seen).sort((a,c)=>c.over-a.over);
  total+=list.length;
  console.log(tag+": "+list.length+" clipped boxes");
  list.slice(0,12).forEach(o=>console.log("   "+o.screen+"  "+o.el+"  cut "+o.over+"px (box "+o.clientH+"px)"));
  await pg.close();
}
await b.close();
console.log("TOTAL "+total);
process.exit(total?1:0);
