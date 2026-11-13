'use strict';
const {JSDOM,VirtualConsole}=require('jsdom');
const fs=require('node:fs'),assert=require('node:assert/strict');
const errors=[],sent=[];let receive;
const dom=new JSDOM(fs.readFileSync(__dirname+'/../app/shell.html','utf8'),{
 runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:new VirtualConsole().on('jsdomError',e=>errors.push(e.message)),
 beforeParse(w){w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});w.ResizeObserver=class{observe(){}disconnect(){}};w.HTMLElement.prototype.animate=()=>({finished:Promise.resolve(),cancel(){}});w.chrome={webview:{postMessage:m=>sent.push(JSON.parse(m)),addEventListener:(_,fn)=>{receive=fn}}};}
});
const w=dom.window,d=w.document;let n=0;
const check=(v,s)=>{assert.ok(v,s);console.log('PASS '+s);n++;};
const click=s=>{const el=d.querySelector(s);assert.ok(el,s);el.click();};
const base={type:'snapshot',operations:[{id:'old',ts:'2026-11-13T01:00:00Z',summary:'first operation',kind:'exec',result:'success',cmd:'echo first',files:[]}],events:[],files:[],watch:[],settings:{theme:'dark',animationsEnabled:false,sidebarSide:'left'},connection:{relayHost:'relay.example',relayPort:22,tunnelTaskName:'muse-reach-tunnel',tunnelScript:'C:\\Tools\\reverse-tunnel.ps1',watchedDirectories:[]},health:{label:'状态待确认'},evidence:{sampledAt:'2026-11-13T01:00:00Z',service:'无法检查'}};
try {
 receive({data:structuredClone(base)});click('[data-page="records"]');
 let summary=d.querySelector('.log-summary');summary.click();const detail=d.querySelector('details');detail.open=true;
 const focus=d.querySelector('[data-action="record-filter"]');focus.focus();
 const same=structuredClone(base);same.evidence.sampledAt='2026-11-13T01:00:05Z';receive({data:same});
 check(d.activeElement===focus,'health-only poll does not replace navigation or record controls');
 const next=structuredClone(base);next.operations.unshift({...base.operations[0],id:'new',ts:'2026-11-13T01:01:00Z',summary:'second operation'});receive({data:next});
 check(d.querySelector('[data-row-id="old"] details').open,'new record preserves old record expansion by id');
 check(d.querySelector('[data-row-id="old"] .log-summary').classList.contains('expanded'),'new record preserves expanded summary');
 check(d.activeElement?.dataset.action==='record-filter','new record preserves keyboard focus');
 click('[data-page="settings"]');const input=d.querySelector('#relayHost');input.value='unsaved.example';input.dispatchEvent(new w.Event('input',{bubbles:true}));input.focus();
 receive({data:next});check(d.querySelector('#relayHost')===input&&input.value==='unsaved.example','poll preserves unsaved configuration and input identity');
 click('[data-action="save-connection"]');check(sent.at(-1).type==='connection-settings'&&sent.at(-1).value.relayHost==='unsaved.example','connection form sends validated structured settings');
 click('[data-page="connection"]');click('[data-action="control"]');click('[data-choice="reconnect"]');click('[data-action="close-modal"]');click('[data-action="control"]');
 check(!d.querySelector('[data-choice="disconnect"]'),'reopening a busy connection dialog cannot resubmit');
 receive({data:{type:'control-state',busy:true}});receive({data:{type:'connection-result',text:'done',summary:'checked',evidence:'test'}});
 check(d.querySelector('#modalRoot').textContent.includes('done'),'real completion ends busy state and displays result');
 check(errors.length===0,'shell has no JavaScript errors');console.log(`UI reliability: ${n} passed`);
} finally {dom.window.close();}
