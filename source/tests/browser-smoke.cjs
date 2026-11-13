'use strict';
const {chromium}=require('playwright');
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch(process.env.REACH_BROWSER?{executablePath:process.env.REACH_BROWSER,headless:true}:{});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.sent=[];window.chrome={webview:{postMessage:m=>window.sent.push(JSON.parse(m)),addEventListener:(_,fn)=>window.receive=fn}};});
 try {
  await page.goto('file:///'+path.resolve(__dirname,'../app/shell.html').replaceAll('\\','/'));
  const sample={type:'snapshot',operations:[{id:'demo-file',ts:'2026-11-13T09:00:00+08:00',kind:'file-create',summary:'测试数据：生成项目检查说明',result:'success',exit:0,cmd:'',files:['C:\\ReachDemo\\检查说明.txt']}],events:[],files:[{path:'C:\\ReachDemo\\检查说明.txt',name:'检查说明.txt',directory:'C:\\ReachDemo',kind:'file-create',ts:'2026-11-13T09:00:00+08:00',state:'在',source:'操作记录（来源未核验）'}],watch:[],health:{label:'状态待确认',note:'测试数据：未连接真实服务器'},evidence:{error:'未连接真实服务器',service:'无法检查'},settings:{theme:'dark',animationsEnabled:false,sidebarSide:'left',hotkeyEnabled:true},connection:{relayHost:'',relayPort:22,tunnelTaskName:'muse-reach-tunnel',tunnelScript:'C:\\ReachDemo\\reverse-tunnel.ps1',watchedDirectories:[]}};
  await page.evaluate(d=>window.receive({data:d}),sample);
  let checks=0;
  for(const width of [1180,860,570,438]) {
   await page.setViewportSize({width,height:780});
   if(width===570)await page.evaluate(()=>window.receive({data:{type:'auto-collapse',collapsed:true}}));
   for(const id of ['records','files','connection','security','settings']) {
    await page.locator(`.side-link[data-page="${id}"]`).click();
    assert.equal(await page.locator('#topbar strong').textContent(),{records:'执行记录',files:'工作文件',connection:'连接状态',security:'安全与权限',settings:'设置'}[id]);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    const size=await page.locator('#main .page').evaluate(el=>({scroll:el.scrollWidth,width:el.clientWidth,overflow:Array.from(el.querySelectorAll('*')).filter(n=>n.getBoundingClientRect().right>el.getBoundingClientRect().right+2).slice(0,8).map(n=>({tag:n.tagName,cls:n.className,width:n.getBoundingClientRect().width}))}));
    assert.ok(size.scroll<=size.width+1,`${id} at ${width}: ${JSON.stringify(size)}`);checks++;
    if(width===1180&&process.env.REACH_SCREENSHOTS){
     fs.mkdirSync(process.env.REACH_SCREENSHOTS,{recursive:true});
     await page.evaluate(()=>{const note=document.createElement('div');note.id='fixtureNotice';note.textContent='界面示例 · 测试数据 · 未连接真实服务器';note.style.cssText='position:fixed;right:14px;bottom:12px;z-index:99999;padding:6px 10px;background:#111317;color:#eceef1;border:1px solid #a1a6b0;border-radius:5px;font-size:11px';document.body.appendChild(note);});
     await page.screenshot({path:path.join(process.env.REACH_SCREENSHOTS,id+'.png')});
     if(id==='settings'){await page.locator('.connection-form').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(process.env.REACH_SCREENSHOTS,'settings-connection.png')});}
     await page.locator('#fixtureNotice').evaluate(el=>el.remove());
    }
   }
  }
  await page.locator('[data-page="records"]').click();const summary=page.locator('.log-summary');await summary.focus();await page.keyboard.press('Enter');assert.ok(await summary.evaluate(el=>el.classList.contains('expanded')));checks++;
  await page.locator('[data-page="settings"]').click();await page.locator('#relayHost').fill('draft.example');
  await page.evaluate(d=>window.receive({data:d}),sample);assert.equal(await page.locator('#relayHost').inputValue(),'draft.example');checks++;
  for(const theme of ['dark','midnight','light','pink','purple','ocean','forest','amber','obsidian']) {
   await page.evaluate(d=>window.receive({data:d}),{...sample,settings:{...sample.settings,theme}});
   const ratio=await page.locator('.set-card-text small').first().evaluate(el=>{
    const lum=s=>{const rgb=s.match(/[\d.]+/g).slice(0,3).map(Number).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
    const a=lum(getComputedStyle(el).color),b=lum(getComputedStyle(el.closest('.set-card')).backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
   });assert.ok(ratio>=4.5,`${theme} secondary text contrast ${ratio}`);checks++;
  }
  assert.deepEqual(errors,[]);console.log(`Browser smoke: ${checks} passed, no page errors`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
