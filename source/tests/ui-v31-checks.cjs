// v31 static + DOM checks: every data page gets four states (loading / empty /
// error / normal). Loading is a skeleton behind a dataLoaded latch (first
// snapshot only — never a flash of the empty state); empty states carry a real
// action; error states show fixed human copy + a real Retry and never paste
// the raw error; normal rendering is unchanged. Regression audits pin v21
// MotionTokens, v24 radii, v25 pill, v26 MOTION, v27 InfoBar, v28 swatches,
// v29 spacing grid and v30 icons/stroke, so this change cannot move them.
// Run with TZ=Asia/Shanghai: node tests/ui-v31-checks.cjs
// jsdom is a scratch-only dep; resolve it from the known scratch installs
// (/tmp/v26-jsdom first, then /tmp/v25-jsdom) or a plain require('jsdom').
'use strict';
const fs = require('fs');
const main = fs.readFileSync(__dirname + '/../app/MainForm.cs', 'utf8');
const appSettings = fs.readFileSync(__dirname + '/../app/AppSettings.cs', 'utf8');
const tokens = fs.readFileSync(__dirname + '/../app/MotionTokens.cs', 'utf8');
const proj = fs.readFileSync(__dirname + '/../app/Reach.csproj', 'utf8');
const shell = fs.readFileSync(__dirname + '/../app/shell.html', 'utf8');
let n = 0; let fail = 0;
function check(v, name) { if (!v) { fail++; console.log('FAIL ' + name); } else { console.log('PASS ' + name); n++; } }
function count(re) { return (shell.match(re) || []).length; }

// ---------- A. the dataLoaded latch ----------
check(shell.includes('let dataLoaded=false;'), 'dataLoaded latch declared false');
check(count(/dataLoaded=false/g) === 1, 'dataLoaded is never reset to false after declaration');
check(shell.includes("state.data=d;dataLoaded=true;"), 'snapshot handler sets dataLoaded=true right after state.data=d');
check(count(/dataLoaded=true/g) === 1, 'dataLoaded is set true in exactly one place (the snapshot handler)');

// ---------- B. skeleton + state helpers ----------
check(shell.includes('function skel(){'), 'skel() helper exists');
check(count(/skel-row shimmer/g) === 4, 'skeleton has exactly 4 shimmer rows');
check(shell.includes('.skel{display:grid;gap:12px}'), 'skeleton is a grid with 12px gap (4px grid)');
check(shell.includes('.skel-row{height:70px;border-radius:8px;background:var(--layer2)}'), 'skeleton row is 70px (matches list row height) with 8px radius');
check(shell.includes('animation:reach-sweep 1.6s linear infinite'), 'skeleton shimmer reuses reach-sweep 1.6s (same loop as the task sweep, not a MotionTokens entry)');
check(shell.includes('.state-enter{animation:reach-page-in var(--motion-fast) var(--motion-ease-in) both}'), 'state-enter reuses reach-page-in at --motion-fast (167ms in)');
check(shell.includes('.state-error .empty-icon{color:var(--red)}'), 'error icon is red (shape + colour: circleX vs inbox)');
check(shell.includes('.empty .secondary{margin-top:8px}'), 'state action button sits 8px below the copy (4px grid)');
check(shell.includes("function stateError(copy,action,label){return '<div class=\"empty state-error state-enter\">"), 'stateError() helper builds error block from fixed copy + action');
check(shell.includes("aria-label=\"正在加载\""), 'skeleton carries role=status / aria-label 正在加载');

// ---------- C. loading guards: all four data pages ----------
check(shell.includes("if(state.page==='connection'){if(!dataLoaded){") && shell.includes("'连接状态','先看连接结论，再按需展开证据；Muse 是否接手任务，以网页对话为准。',skel())"), 'connection page shows skeleton before first snapshot');
check(shell.includes("else if(state.page==='records'){if(!dataLoaded){") && shell.includes("'执行记录','记录经通道执行的本机操作，不含 Muse 在云端的其他活动。',skel())"), 'records page shows skeleton before first snapshot');
check(shell.includes("else if(state.page==='files'){if(!dataLoaded){") && shell.includes("'工作文件','这里列出操作记录中 Muse 操作过的文件，以及程序留意到的最近变化。',skel())"), 'files page shows skeleton before first snapshot');
check(shell.includes("else if(state.page==='security'){if(!dataLoaded){") && shell.includes("'安全与权限','连接和权限的真实边界，都在这里说明。',skel())"), 'security page shows skeleton before first snapshot (its conclusion is data-derived)');
check(count(/!dataLoaded/g) === 4, 'exactly 4 loading guards (one per data page); settings/muse untouched');

// ---------- D. empty states carry a real action ----------
check(shell.includes("还没有执行记录。Muse 经通道在这台电脑上操作后，会在这里留下记录。</span><button class=\"secondary\" data-action=\"page\" data-page=\"muse\">打开 Muse 对话</button>"), 'records empty state: copy + real "打开 Muse 对话" action (page/muse)');
check(shell.includes("还没有记录。Muse 在这台电脑上创建或修改文件后，会出现在这里；程序运行时留意到的文件变化也会列在「最近变化」里。</span><button class=\"secondary\" data-action=\"refresh-files\">重新核对文件</button>"), 'files empty state: copy + real "重新核对文件" action (refresh-files)');

// ---------- E. error states: fixed human copy, real retry, no raw error ----------
check(shell.includes("stateError('操作记录暂时无法读取，请稍后再试。','refresh-records','重试')"), 'records error: fixed copy + refresh-records retry');
check(shell.includes("stateError('工作文件暂时无法读取，请稍后再试。','refresh-files','重新核对文件')"), 'files error: fixed copy + refresh-files retry');
check(count(/stateError\(/g) === 3, 'stateError called exactly twice (records + files) plus its definition');
check(!shell.includes("e(state.data.opsError)"), 'raw opsError is never rendered (no e(opsError) left)');
check(!shell.includes("'<p class=\"warning-note\">'+e(state.data.opsError)+'</p>'"), 'records no longer renders the raw opsError warning-note (the class itself still serves the connection modal)');
check(shell.includes("else if(a==='refresh-files')send({type:'refresh-files'});else if(a==='refresh-records')send({type:'refresh-records'});"), 'click dispatcher forwards refresh-records to C#');
check(main.includes('if(type=="refresh-records"){while(_polling)await Task.Delay(30);await PollAsync();return;}'), 'C# refresh-records re-reads via PollAsync (same pattern as refresh-files)');
check(main.includes('if(type=="refresh-files"){_refreshFiles=true;while(_polling)await Task.Delay(30);await PollAsync();return;}'), 'C# refresh-files handler untouched');
check(shell.includes("const opsErr=!!state.data.opsError;"), 'records branches on the opsError flag (no-data signal), not on a guessed async load');
check(shell.includes("state.filter==='all'?(opsErr?errBlock+evsRows:mixed)"), "'all' filter: ops error block + program rows (error does not hide program events)");

// ---------- F. what is NOT covered, and why (static proof) ----------
// Security page: static explanatory text, no list to be empty, no read that
// can fail at page level — only the loading guard applies. The security branch
// contains no stateError call and no .empty block (see C for the guard).
const secBranch = shell.slice(shell.indexOf("state.page==='security'"), shell.indexOf("state.page==='settings'"));
check(!secBranch.includes('stateError(') && !secBranch.includes('class="empty'), 'security page has no empty/error block (static text; see REPORT §03)');
check(shell.includes("const progSection=state.filter==='operation'&&evs.length?"), 'records program-log details section untouched');
check(shell.includes('const opsRows=ops.map(opRow).join'), 'records ops rows still built from opRow');
check(shell.includes('const mixed=[...ops,...evs].sort'), "'all' filter still merges ops + events sorted by time");

// ---------- G. regression audits (v21/v24/v25/v26/v27/v28/v29/v30 pinned) ----------
// Icons: 35 sizing declarations, 28x16 / 2x20 / 2x24, 3 off-tier exceptions.
const sizing = [];
for (const m of shell.matchAll(/([^\n{}]*?)\bsvg\s*\{([^}]*)\}/g)) {
  const body = m[2];
  const w = body.match(/width\s*:\s*([\d.]+)px/);
  const h = body.match(/height\s*:\s*([\d.]+)px/);
  if (w || h) sizing.push({ sel: m[1].trim().slice(-70), w: w ? parseFloat(w[1]) : null, h: h ? parseFloat(h[1]) : null });
}
check(sizing.length === 35, '35 svg sizing declarations audited (got ' + sizing.length + ')');
check(sizing.every(s => s.w === s.h), 'every icon rule is square (width == height)');
const tier = s => s.w === 16 ? '16' : s.w === 20 ? '20' : s.w === 24 ? '24' : 'off';
const byTier = { '16': 0, '20': 0, '24': 0, off: [] };
for (const s of sizing) { if (tier(s) === 'off') byTier.off.push(s); else byTier[tier(s)]++; }
check(byTier['16'] === 28, '28 icons at 16px, got ' + byTier['16']);
check(byTier['20'] === 2, '2 icons at 20px, got ' + byTier['20']);
check(byTier['24'] === 2, '2 icons at 24px, got ' + byTier['24']);
check(byTier.off.length === 3, 'exactly 3 off-tier declarations (2 justified exceptions), got ' + byTier.off.length);
check(count(/stroke-width="1\.7"/g) === 0, 'no stroke-width 1.7 left in shell.html');
check(count(/stroke-width="2"/g) === 2, 'stroke-width 2 appears exactly twice');
check(shell.includes('.log-summary{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;cursor:pointer;font-size:11.5px}'), '.log-summary still 11.5px');
check(count(/font-size:11\.5px/g) === 20, 'font-size 11.5px appears 20 times (unchanged)');
// Spacing: v29 had 222 declarations; v31 adds exactly 2 on-grid ones
// (.skel gap:12px, .empty .secondary margin-top:8px) -> 224.
const GRID = new Set([0, 4, 8, 12, 16, 24]);
let declCount = 0; const offGrid = []; const fortySites = [];
shell.split('\n').forEach((line) => {
  for (const m of line.matchAll(/(padding|margin|gap|row-gap|column-gap)(?:-(top|right|bottom|left))?\s*:\s*([^;{}]+)/g)) {
    declCount++;
    const prop = m[0].split(':')[0].trim();
    const val = m[3].trim();
    const before = line.slice(0, m.index);
    const li = before.lastIndexOf('{');
    const sel = li >= 0 ? before.slice(0, li).split(/[};]/).pop().trim().slice(0, 60) : '(?)';
    for (const num of val.match(/(-?\d+(?:\.\d+)?)px/g) || []) {
      const v = Math.abs(parseFloat(num));
      if (!GRID.has(v)) {
        if (v === 40) fortySites.push(sel + ' :: ' + prop + ': ' + val);
        else offGrid.push(sel + ' :: ' + prop + ': ' + val);
      }
    }
  }
});
check(declCount === 224, '224 spacing declarations on the 4px grid (222 + 2 new on-grid ones), got ' + declCount);
check(offGrid.length === 0, 'no spacing value outside {0,4,8,12,16,24} except the 40px exceptions' + (offGrid.length ? ': ' + offGrid.join(' | ') : ''));
check(fortySites.length === 5, 'exactly 5 off-grid spacing sites, all 40px (v29 exceptions untouched)');
check(count(/border-radius:8px[;}]/g) === 50, '50 plain 8px radii (49 + 1 skeleton row, v24 scale otherwise untouched)');
check(count(/border-radius:4px[;}]/g) === 7, '7 plain 4px radii (v24 scale untouched)');
check(!shell.includes('border-radius:12px') && !shell.includes('border-radius:16px') && !shell.includes('border-radius:6px'), 'no old numeric radius back');
check(tokens.includes('public const int ControlFasterMs = 83;') && tokens.includes('public const int ControlFastMs = 167;') && tokens.includes('public const int ControlNormalMs = 250;'), 'MotionTokens 83/167/250 untouched');
check(tokens.includes('public const int ControlFasterExitMs = 62;') && tokens.includes('public const int ControlFastExitMs = 125;') && tokens.includes('public const int ControlNormalExitMs = 188;'), 'MotionTokens exit 62/125/188 untouched');
check(shell.includes('selPill'), 'v25 selection pill untouched');
check(shell.includes('window.MOTION=MOTION;'), 'v26 MOTION sharing untouched');
check(shell.includes('infobarSync();'), 'v27 infobar wiring untouched');
check(shell.includes('.swatch{position:relative;width:44px;height:32px;'), 'v28 theme swatches stay 44x32');
check(shell.includes('width:250px;flex:0 0 250px') && shell.includes('width:48px;flex-basis:48px'), 'sidebar widths 250px / 48px unchanged');
check(count(/muse\.ai/g) === 1, 'muse.ai appears exactly once in shell.html');
check(shell.includes("'https://muse.ai/'"), 'the single muse.ai occurrence is the settings-page evidence default URL');
check(!shell.includes('muse.ai/script') && !shell.includes('src="https://muse.ai') && !shell.includes("src='https://muse.ai"), 'no script loaded from muse.ai');
check(!shell.includes("document.createElement('script')") && !shell.includes('document.createElement("script")'), 'no script element created at runtime');

// ---------- H. version strings ----------
check(main.includes('Text = "Muse Reach v31"'), 'window title is v31');
check(main.includes('Text="Muse Reach v31"'), 'tray text is v31');
check(!main.includes('Muse Reach v30'), 'no v30 version string left in MainForm');
check(proj.includes('<Version>0.31.0</Version>'), 'project version is 0.31.0');
check(!proj.includes('0.30.0'), 'no 0.30.0 left in the project file');
check(!appSettings.includes('v31') && !appSettings.includes('v30'), 'AppSettings.cs carries no version string (settings untouched)');

console.log('STATIC TOTAL ' + n + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);

// ---------- I. jsdom DOM checks: the four states, really rendered ----------
let JSDOM, VirtualConsole;
for (const p of ['/tmp/v26-jsdom/node_modules/jsdom', '/tmp/v25-jsdom/node_modules/jsdom', 'jsdom']) {
  try { ({ JSDOM, VirtualConsole } = require(p)); break; } catch (_) { /* try next */ }
}
if (!JSDOM) { console.error('jsdom not found in /tmp/v26-jsdom or /tmp/v25-jsdom'); process.exit(2); }
const html = fs.readFileSync(__dirname + '/../app/shell.html', 'utf8');

const doms = [];
function makeDom() {
  const errors = []; const sent = [];
  const dom = new JSDOM(html, {
    url: 'https://muse.ai/', runScripts: 'dangerously', pretendToBeVisual: true,
    virtualConsole: new VirtualConsole()
      .on('jsdomError', e => errors.push(e.detail && e.detail.stack || String(e))),
    beforeParse(window) {
      window.ResizeObserver = class { constructor() {} observe() {} unobserve() {} disconnect() {} };
      window.matchMedia = q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
      window.chrome = { webview: { postMessage(m) { try { sent.push(JSON.parse(m)); } catch (_) { sent.push(m); } }, addEventListener(t, fn) { window.__msgFn = fn; } } };
    },
  });
  doms.push(dom);
  return { dom, errors, sent };
}
function click(window, selector) {
  const el = window.document.querySelector(selector);
  if (!el) return false;
  el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  return true;
}
const SETTINGS = {
  theme: 'obsidian', sidebarSide: 'left', sidebarCollapsed: false,
  animationsEnabled: true, minimizeToTray: true, startWithWindows: false,
  hotkeyEnabled: true, webZoom: 1, recentChangesCollapsed: true,
  recentFilesCollapsed: false, museStartUrl: 'https://muse.ai/thread/pin',
};
const RAW_ERROR = 'IO_ERROR_0x80070005 C:\\ops.jsonl'; // simulates the C# opsError string
function feed(window, extra) {
  window.__msgFn({ data: { type: 'snapshot',
    settings: SETTINGS,
    operations: [], events: [], files: [], watch: [],
    evidence: { service: '运行中', tcpEstablished: true },
    health: { label: '通道正常', reconnect: false }, ...extra } });
}
const OP1 = { id: 'op1', kind: 'exec', summary: '测试操作', result: 'success', ts: new Date().toISOString(), files: [], cmd: 'echo hi' };
const EV1 = { id: 'ev1', kind: 'info', summary: '程序事件', result: 'success', ts: new Date().toISOString(), category: 'program' };
const F1 = { name: '报告.md', kind: 'file-create', state: '在', directory: 'C:\\Users\\YOUR_WINDOWS_USER\\Desktop', ts: new Date().toISOString(), path: 'C:\\Users\\YOUR_WINDOWS_USER\\Desktop\\报告.md' };
const W1 = { path: 'C:\\Users\\YOUR_WINDOWS_USER\\Desktop\\报告.md', change: 'modified', ts: new Date().toISOString() };
const txt = doc => doc.querySelector('#main').textContent;

(async () => {
  // ---- 1. loading: before any snapshot, all four data pages show the skeleton ----
  {
    const { dom, errors } = makeDom();
    const { window } = dom; const { document } = window;
    for (const page of ['files', 'records', 'connection', 'security']) {
      check(click(window, '[data-page="' + page + '"]'), 'loading: go to ' + page + ' before first snapshot');
      check(document.querySelectorAll('.skel-row').length === 4, 'loading: ' + page + ' shows 4 skeleton rows, got ' + document.querySelectorAll('.skel-row').length);
      check(document.querySelectorAll('.skel-row.shimmer').length === 4, 'loading: ' + page + ' skeleton rows shimmer');
      check(document.querySelector('.skel')?.getAttribute('aria-label') === '正在加载', 'loading: ' + page + ' skeleton has aria-label 正在加载');
      check(!document.querySelector('.empty'), 'loading: ' + page + ' shows NO empty state before data arrives');
      check(!document.querySelector('.log-item'), 'loading: ' + page + ' shows NO data rows before data arrives');
      check(!txt(document).includes('还没有'), 'loading: ' + page + ' shows NO empty-state copy before data arrives');
    }
    const r0 = document.querySelector('.skel-row');
    check(window.getComputedStyle(r0).height === '70px', 'loading: skeleton row computed height is 70px, got ' + window.getComputedStyle(r0).height);
    check(errors.length === 0, 'loading: zero page errors across the four pre-snapshot pages');
  }

  // ---- 2. loading -> empty, once, no skeleton left, latch never resets ----
  {
    const { dom, errors, sent } = makeDom();
    const { window } = dom; const { document } = window;
    feed(window, {}); // empty snapshot: no ops, no files
    check(click(window, '[data-page="files"]'), 'empty: go to files after empty snapshot');
    check(!document.querySelector('.skel'), 'empty: files shows NO skeleton after data arrives');
    check(!!document.querySelector('.empty'), 'empty: files shows the empty state');
    check(txt(document).includes('还没有记录'), 'empty: files copy "还没有记录" present');
    const btn = document.querySelector('.empty [data-action="refresh-files"]');
    check(!!btn && btn.textContent === '重新核对文件', 'empty: files has a real "重新核对文件" button');
    check(click(window, '.empty [data-action="refresh-files"]'), 'empty: files refresh button is clickable');
    check(sent.some(m => m.type === 'refresh-files'), 'empty: clicking files refresh sends refresh-files to C#');
    check(click(window, '[data-page="records"]'), 'empty: go to records (latch must not reset)');
    check(!document.querySelector('.skel'), 'empty: records shows NO skeleton after the latch is set');
    check(!!document.querySelector('.empty'), 'empty: records shows the empty state');
    check(txt(document).includes('还没有执行记录'), 'empty: records copy "还没有执行记录" present');
    const museBtn = document.querySelector('.empty [data-action="page"][data-page="muse"]');
    check(!!museBtn && museBtn.textContent === '打开 Muse 对话', 'empty: records has a real "打开 Muse 对话" button');
    check(click(window, '.empty [data-action="page"][data-page="muse"]'), 'empty: records muse button is clickable');
    check(sent.some(m => m.type === 'page' && m.page === 'muse'), 'empty: clicking it sends page/muse to C#');
    check(errors.length === 0, 'empty: zero page errors');
  }

  // ---- 3. error: records (operation filter) — fixed copy, no raw error, retry works ----
  {
    const { dom, errors, sent } = makeDom();
    const { window } = dom; const { document } = window;
    feed(window, { opsError: RAW_ERROR });
    check(click(window, '[data-page="records"]'), 'error: go to records with opsError');
    check(!document.querySelector('.skel'), 'error: records shows NO skeleton');
    check(!document.querySelector('.empty:not(.state-error)'), 'error: records shows NO empty state (error takes precedence)');
    const err = document.querySelector('.state-error');
    check(!!err, 'error: records shows the error block');
    check(txt(document).includes('操作记录暂时无法读取，请稍后再试。'), 'error: records fixed human copy present');
    check(!txt(document).includes('0x80070005') && !txt(document).includes('ops.jsonl'), 'error: raw error code / path NOT pasted into the page');
    const retry = document.querySelector('.state-error [data-action="refresh-records"]');
    check(!!retry && retry.textContent === '重试', 'error: records has a real "重试" button');
    check(click(window, '.state-error [data-action="refresh-records"]'), 'error: records retry button is clickable');
    check(sent.some(m => m.type === 'refresh-records'), 'error: clicking retry sends refresh-records to C#');
    check(errors.length === 0, 'error: zero page errors');
  }

  // ---- 4. error: records 'all' filter — error block + program rows coexist ----
  {
    const { dom, errors } = makeDom();
    const { window } = dom; const { document } = window;
    feed(window, { opsError: RAW_ERROR, events: [EV1] });
    check(click(window, '[data-page="records"]'), 'error-all: go to records with opsError + 1 program event');
    check(click(window, '[data-action="record-filter"][data-value="all"]'), 'error-all: switch to 全部 filter');
    check(!!document.querySelector('.state-error'), 'error-all: error block still shown');
    check(document.querySelectorAll('.log-main').length === 1, 'error-all: 1 program row still listed below the error, got ' + document.querySelectorAll('.log-main').length);
    check(txt(document).includes('程序事件'), 'error-all: program event summary present');
    check(errors.length === 0, 'error-all: zero page errors');
  }

  // ---- 5. error: files — fixed copy, retry works, watch section unaffected ----
  {
    const { dom, errors, sent } = makeDom();
    const { window } = dom; const { document } = window;
    feed(window, { opsError: RAW_ERROR, watch: [W1] });
    check(click(window, '[data-page="files"]'), 'error-files: go to files with opsError + 1 watch entry');
    const err = document.querySelector('.state-error');
    check(!!err, 'error-files: files shows the error block');
    check(txt(document).includes('工作文件暂时无法读取，请稍后再试。'), 'error-files: fixed human copy present');
    check(!txt(document).includes('0x80070005') && !txt(document).includes('ops.jsonl'), 'error-files: raw error code / path NOT pasted');
    const retry = document.querySelector('.state-error [data-action="refresh-files"]');
    check(!!retry && retry.textContent === '重新核对文件', 'error-files: retry button "重新核对文件" present');
    check(click(window, '.state-error [data-action="refresh-files"]'), 'error-files: retry button is clickable');
    check(sent.some(m => m.type === 'refresh-files'), 'error-files: clicking retry sends refresh-files to C#');
    check(!!document.querySelector('.watch-section'), 'error-files: 最近变化 section still renders (error is scoped to the files card)');
    check(txt(document).includes('最近变化（1）'), 'error-files: watch count still shown');
    check(errors.length === 0, 'error-files: zero page errors');
  }

  // ---- 6. normal: rows render, no state chrome at all ----
  {
    const { dom, errors } = makeDom();
    const { window } = dom; const { document } = window;
    feed(window, { operations: [OP1], events: [EV1], files: [F1], watch: [W1] });
    check(click(window, '[data-page="records"]'), 'normal: go to records with data');
    check(document.querySelectorAll('.log-main').length === 2, 'normal: records shows 2 rows (1 op + 1 program event), got ' + document.querySelectorAll('.log-main').length);
    check(!document.querySelector('.skel') && !document.querySelector('.empty') && !document.querySelector('.state-error'), 'normal: records shows no skeleton / empty / error chrome');
    check(click(window, '[data-page="files"]'), 'normal: go to files with data');
    check(txt(document).includes('报告.md'), 'normal: files shows the file row');
    check(!document.querySelector('.skel') && !document.querySelector('.empty') && !document.querySelector('.state-error'), 'normal: files shows no skeleton / empty / error chrome');
    check(errors.length === 0, 'normal: zero page errors');
  }

  // ---- 7. no flash: first snapshot already has data -> rows directly, never skeleton ----
  {
    const { dom, errors } = makeDom();
    const { window } = dom; const { document } = window;
    feed(window, { operations: [OP1] });
    check(click(window, '[data-page="records"]'), 'no-flash: go to records, first snapshot already had data');
    check(!document.querySelector('.skel'), 'no-flash: no skeleton on first render with data');
    check(document.querySelectorAll('.log-main').length === 1, 'no-flash: 1 op row rendered directly');
    check(errors.length === 0, 'no-flash: zero page errors');
  }

  // ---- 8. connection + security after load: health / conclusion render, no skeleton ----
  {
    const { dom, errors } = makeDom();
    const { window } = dom; const { document } = window;
    feed(window, { health: { label: '通道中断', note: '本机 SSH 服务未响应', reconnect: true } });
    check(click(window, '[data-page="connection"]'), 'conn: go to connection with bad health');
    check(!document.querySelector('.skel'), 'conn: no skeleton after data arrives');
    check(txt(document).includes('通道中断'), 'conn: health label "通道中断" rendered (error presentation unchanged)');
    check(!!document.querySelector('[data-action="reconnect"]'), 'conn: "重新连接" button present');
    check(click(window, '[data-page="security"]'), 'sec: go to security after snapshot');
    check(!document.querySelector('.skel'), 'sec: no skeleton after data arrives');
    check(txt(document).includes('安全与权限') || txt(document).includes('权限'), 'sec: security content rendered');
    check(!document.querySelector('.empty') && !document.querySelector('.state-error'), 'sec: no empty/error block (static page, by design)');
    check(errors.length === 0, 'conn/sec: zero page errors');
  }

  console.log('DOM TOTAL ' + n + ' passed, ' + fail + ' failed');
  for (const d of doms) d.window.close(); // stop jsdom's visual timers so node exits
  if (fail) process.exit(1);
})();
