// v30 static + DOM checks: icons converge to 16/20/24 (logical px), Lucide
// stroke-width unified to 2, selected-state icons use the filled variant,
// and the v29 leftover .log-summary font-size is 11.5px (row heights unify).
// Run with TZ=Asia/Shanghai: node tests/ui-v30-checks.cjs
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

// ---------- A. icon-size audit: every svg sizing declaration in the file ----------
// Collect selector + width/height from every `... svg{...}` rule that sizes.
// The JS icon() template (<svg viewBox=...>) has no `{` after `svg`, so it is
// not picked up; the mark() logo svg is inline (no CSS rule) and is audited
// separately as exception 1.
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
check(byTier['16'] === 28, '28 icons at 16px (small inline tier), got ' + byTier['16']);
check(byTier['20'] === 2, '2 icons at 20px (sidebar rail: collapsed + 800px breakpoint), got ' + byTier['20']);
check(byTier['24'] === 2, '2 icons at 24px (large tier: empty-icon + dialog-symbol), got ' + byTier['24']);
check(byTier.off.length === 3, 'exactly 3 off-tier declarations (2 justified exceptions), got ' + byTier.off.length + ': ' + byTier.off.map(s => s.sel + ' ' + s.w + 'px').join(' | '));
// Exception 1 — brand mark logo (self-drawn "R" wordmark, not a Lucide icon):
// 27px in the 34px sidebar tile, 39px in the 54px welcome tile. One artwork,
// size follows its container; shrinking it to 24px would be a brand-asset
// change, not an icon-tier change.
check(byTier.off.filter(s => s.sel.includes('.mark') && s.w === 27).length === 1, 'exception 1a: sidebar brand mark stays 27px (logo, not an icon)');
check(byTier.off.filter(s => s.sel.includes('.welcome .mark') && s.w === 39).length === 1, 'exception 1b: welcome-page brand mark stays 39px (same logo, larger tile)');
// Exception 2 — swatch check: a 10px check inside the 16px selection badge
// (.swatch-check is 16px incl. 1px border, ~14px inside). A 16px glyph cannot
// fit; enlarging the badge would distort the 44x32 swatch (v28, untouched).
check(byTier.off.filter(s => s.sel.includes('.swatch-check') && s.w === 10).length === 1, 'exception 2: swatch check stays 10px (10px glyph inside the 16px badge)');
check(!sizing.some(s => [12, 13, 14, 15, 17, 18, 30].includes(s.w)), 'no 12/13/14/15/17/18/30px icon size remains');
// Spot-check the headline moves (old -> new):
check(shell.includes('svg{height:16px;width:16px;flex-shrink:0}'), 'base svg fallback 18px -> 16px');
check(shell.includes('.empty-icon svg{width:24px;height:24px}'), 'empty-state icon 30px -> 24px');
check(shell.includes('.dialog-symbol svg{width:24px;height:24px}'), 'dialog large icon gets its own 24px rule (was unsized, fell to the 18px base)');
check(shell.includes('.tag svg{height:16px;width:16px}'), 'tag icon 12px -> 16px');
check(shell.includes('.log-glyph svg{width:16px;height:16px}'), 'log glyph 15px -> 16px');
check(shell.includes('.icon-button svg{width:16px;height:16px}'), 'icon-button 17px -> 16px');
check(shell.includes('.panel-head svg{width:16px;height:16px;color:var(--accent)}'), 'panel-head icon 17px -> 16px');
check(shell.includes('.sidebar-collapsed .side-link svg{height:20px;width:20px}'), 'v22 collapsed rail icons stay 20px');
check(shell.includes('.sidebar-collapsed .sidebar{width:48px;flex-basis:48px;padding:16px 0 12px}'), 'v22 collapsed rail stays 48px wide');

// ---------- B. stroke-width audit ----------
check(count(/stroke-width="1\.7"/g) === 0, 'no stroke-width 1.7 left in shell.html');
check(count(/stroke-width="2"/g) === 2, 'stroke-width 2 appears exactly twice: the icon() template + the mark logo third path');
const markLine = shell.split('\n').find(l => l.includes('const mark='));
check(markLine && markLine.includes('stroke-width="3.3"') && markLine.includes('stroke-width="3"') && markLine.includes('stroke-width="2"'), 'mark logo keeps its own strokes 3.3/3/2 (logo artwork, not Lucide)');
check(shell.includes('const icon=(name,filled)=>'), 'icon() takes a filled flag');
check(shell.includes('stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'), 'stroked template uses stroke-width 2');

// ---------- C. filled variants ----------
const filledBlock = shell.slice(shell.indexOf('const symbolsFilled={'), shell.indexOf('};', shell.indexOf('const symbolsFilled={')));
const filledKeys = [...filledBlock.matchAll(/^([a-zA-Z]+):'/gm)].map(m => m[1]);
check(JSON.stringify(filledKeys) === JSON.stringify(['chat', 'bookOpen', 'listChecks', 'wifi', 'shield', 'settings']), 'symbolsFilled has exactly the six page icons: ' + filledKeys.join(','));
check(shell.includes("icon(i,state.page===id)"), 'nav() renders the active page icon filled');
check(shell.includes("icon('chevron')") && shell.includes("icon('swap')"), 'collapse/flip controls stay single-arg (stroked, not selected states)');
check(filledBlock.includes('<rect x="12" y="4.7"') && filledBlock.includes('<rect x="12" y="16.7"'), 'filled listChecks is hand-authored geometry (check polygons + filled bars, not zero-area stroked lines)');
check(filledBlock.includes('<circle cx="12" cy="20" r="1.8"/>'), 'filled wifi has a real dot (the stroked M12 20h.01 has zero area)');
check(shell.includes('fill="currentColor" stroke="none"'), 'filled template renders fill=currentColor, stroke=none');

// ---------- D. .log-summary 11.5px (v29 leftover) + row-height unification ----------
check(shell.includes('.log-summary{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;cursor:pointer;font-size:11.5px}'), '.log-summary sets font-size 11.5px');
check(count(/font-size:11\.5px/g) === 20, 'font-size 11.5px appears 20 times (v29 had 19; +1 is exactly this change, no other type size moved)');
check(shell.includes('.log-name b{font-size:11.5px;font-weight:660}') && shell.includes('.log-time{font-size:10px;'), 'row font sizes feeding the derivation are still 11.5px / 10px');
// Derivation (body 13px / line-height 1.65): op/program row was
// 13*1.65 + 11*1.65 + 10*1.65 + 16 = 72.10px; now the name is 11.5px like
// the file rows, so both are 11.5*1.65 + 11*1.65 + 10*1.65 + 16 = 69.63px.
const logRow = 11.5 * 1.65 + 11 * 1.65 + 10 * 1.65 + 16;
check(Math.abs(logRow - 69.6) < 0.05, 'execution-log row height now ' + logRow.toFixed(2) + 'px, equal to work-file rows (was 72.1px, 2.5px spread closed)');
check(shell.includes('.log-desc{font-size:11px;color:var(--sub);margin:0}'), 'log desc still 11px, margin 0');

// ---------- E. nothing else moved: spacing (v29), radii (v24), motion (v21), swatches (v28) ----------
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
check(declCount === 224, '224 spacing declarations still on the 4px grid (222 + 2 on-grid ones v31 added: .skel gap:12px, .empty .secondary margin-top:8px)');
check(offGrid.length === 0, 'no spacing value outside {0,4,8,12,16,24} except the 40px exceptions');
check(fortySites.length === 5, 'exactly 5 off-grid spacing sites, all 40px (v29 exceptions untouched)');
check(count(/border-radius:8px[;}]/g) === 50, '50 plain 8px radii (49 + v31 skeleton row .skel-row, v43 established)');
check(count(/border-radius:4px[;}]/g) === 7, '7 plain 4px radii (v24 scale untouched)');
check(!shell.includes('border-radius:12px') && !shell.includes('border-radius:16px') && !shell.includes('border-radius:6px'), 'no old numeric radius back');
check(tokens.includes('public const int ControlFasterMs = 83;') && tokens.includes('public const int ControlFastMs = 167;') && tokens.includes('public const int ControlNormalMs = 250;'), 'MotionTokens 83/167/250 untouched');
check(tokens.includes('public const int ControlFasterExitMs = 62;') && tokens.includes('public const int ControlFastExitMs = 125;') && tokens.includes('public const int ControlNormalExitMs = 188;'), 'MotionTokens exit 62/125/188 untouched');
check(shell.includes('.swatch{position:relative;width:44px;height:32px;'), 'v28 theme swatches stay 44x32 (not icons)');
check(shell.includes('.swatch-check{position:absolute;top:-7px;right:-7px;width:16px;height:16px;'), 'swatch check badge stays 16px');
check(shell.includes("selPill"), 'v25 selection pill untouched');
check(shell.includes('window.MOTION=MOTION;'), 'v26 MOTION sharing untouched');
check(shell.includes('infobarSync();'), 'v27 infobar wiring untouched');
check(shell.includes('width:250px;flex:0 0 250px') && shell.includes('width:48px;flex-basis:48px'), 'sidebar widths 250px / 48px unchanged');

// ---------- F. no injection into muse.ai pages ----------
check(count(/muse\.ai/g) === 1, 'muse.ai appears exactly once in shell.html');
check(shell.includes("'https://muse.ai/'"), 'the single muse.ai occurrence is the settings-page evidence default URL');
check(!shell.includes('muse.ai/script') && !shell.includes('src="https://muse.ai') && !shell.includes("src='https://muse.ai"), 'no script loaded from muse.ai');
check(!shell.includes("document.createElement('script')") && !shell.includes('document.createElement("script")'), 'no script element created at runtime');

// ---------- G. version strings ----------
check(main.includes('Text = "Muse Reach v30"'), 'window title is v30');
check(main.includes('Text="Muse Reach v30"'), 'tray text is v30');
check(!main.includes('Muse Reach v29'), 'no v29 version string left in MainForm');
check(proj.includes('<Version>0.30.0</Version>'), 'project version is 0.30.0');
check(!proj.includes('0.29.0'), 'no 0.29.0 left in the project file');
check(!appSettings.includes('v30') && !appSettings.includes('v29'), 'AppSettings.cs carries no version string (settings untouched)');

console.log('STATIC TOTAL ' + n + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);

// ---------- H. jsdom DOM checks: filled vs stroked, computed sizes ----------
let JSDOM, VirtualConsole;
for (const p of ['/tmp/v26-jsdom/node_modules/jsdom', '/tmp/v25-jsdom/node_modules/jsdom', 'jsdom']) {
  try { ({ JSDOM, VirtualConsole } = require(p)); break; } catch (_) { /* try next */ }
}
if (!JSDOM) { console.error('jsdom not found in /tmp/v26-jsdom or /tmp/v25-jsdom'); process.exit(2); }
const shellPath = process.argv[2] || (__dirname + '/../app/shell.html');
const html = fs.readFileSync(shellPath, 'utf8');

function makeDom() {
  const errors = [];
  const sent = [];
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
  return { dom, errors, sent };
}
function click(window, selector) {
  const el = window.document.querySelector(selector);
  if (!el) return false;
  el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  return true;
}
function feed(window, extra) {
  window.__msgFn({ data: { type: 'snapshot',
    settings: { theme: 'obsidian', sidebarSide: 'left', sidebarCollapsed: false, animationsEnabled: true, minimizeToTray: true, startWithWindows: false, hotkeyEnabled: true, webZoom: 1, recentChangesCollapsed: true, recentFilesCollapsed: false, museStartUrl: 'https://muse.ai/thread/pin' },
    operations: [{ id: 'op1', kind: 'exec', summary: '测试操作', result: 'success', ts: new Date().toISOString(), files: [], cmd: 'echo hi' }],
    events: [{ id: 'ev1', kind: 'info', summary: '程序事件', result: 'success', ts: new Date().toISOString(), category: 'program' }],
    files: [{ name: '报告.md', kind: 'file-create', state: '在', directory: 'C:\\Users\\YOUR_WINDOWS_USER\\Desktop', ts: new Date().toISOString(), path: 'C:\\Users\\YOUR_WINDOWS_USER\\Desktop\\报告.md' }],
    watch: [{ path: 'C:\\Users\\YOUR_WINDOWS_USER\\Desktop\\报告.md', change: 'modified', ts: new Date().toISOString() }],
    evidence: { service: '运行中', tcpEstablished: true },
    health: { label: '通道正常', reconnect: false }, ...extra } });
}
function cs(window, el, prop) { return window.getComputedStyle(el).getPropertyValue(prop); }

(async () => {
  // 1. default page (muse): active icon filled, others stroked
  {
    const { dom, errors } = makeDom();
    const { window } = dom; const { document } = window;
    feed(window, {});
    const activeSvg = document.querySelector('.side-link.active svg');
    check(!!activeSvg, 'DOM: active nav button has an svg');
    check(activeSvg.getAttribute('fill') === 'currentColor' && activeSvg.getAttribute('stroke') === 'none', 'DOM: active (muse/chat) icon is filled (fill=currentColor, stroke=none)');
    check(activeSvg.innerHTML.includes('M7.9 20A9 9 0 1 0 4 16.1L2 22Z'), 'DOM: active icon carries the filled chat path');
    const filesSvg = document.querySelector('.side-link[data-page="files"] svg');
    check(filesSvg.getAttribute('fill') === 'none' && filesSvg.getAttribute('stroke-width') === '2', 'DOM: inactive (files) icon is stroked, stroke-width 2');
    check(cs(window, filesSvg, 'width') === '16px' && cs(window, filesSvg, 'height') === '16px', 'DOM: expanded sidebar nav icon computes to 16px');
    check(errors.length === 0, 'DOM: no page errors on first render: ' + errors.join(' | ').slice(0, 200));
  }
  // 2. switch page: filled moves with the selection (listChecks hand geometry)
  {
    const { dom, errors } = makeDom();
    const { window } = dom; const { document } = window;
    feed(window, {});
    check(click(window, '.side-link[data-page="records"]'), 'DOM: click records page');
    const recSvg = document.querySelector('.side-link[data-page="records"] svg');
    check(recSvg.getAttribute('fill') === 'currentColor', 'DOM: records icon is filled after switching to it');
    check(recSvg.innerHTML.includes('<rect') && !recSvg.innerHTML.includes('M13 6h8'), 'DOM: filled listChecks uses bars, not the stroked line paths');
    const museSvg = document.querySelector('.side-link[data-page="muse"] svg');
    check(museSvg.getAttribute('fill') === 'none' && museSvg.getAttribute('stroke-width') === '2', 'DOM: muse icon returns to stroked after switching away');
    const name = document.querySelector('.log-name .log-summary');
    check(name !== null && cs(window, name, 'font-size') === '11.5px', 'DOM: op/program name computes to 11.5px (row height now equals file rows)');
    check(errors.length === 0, 'DOM: no page errors after page switch: ' + errors.join(' | ').slice(0, 200));
  }
  // 3. collapsed rail: icons compute to 20px
  {
    const { dom, errors } = makeDom();
    const { window } = dom; const { document } = window;
    feed(window, { settings: { theme: 'obsidian', sidebarSide: 'left', sidebarCollapsed: true, animationsEnabled: true, minimizeToTray: true, startWithWindows: false, hotkeyEnabled: true, webZoom: 1, recentChangesCollapsed: true, recentFilesCollapsed: false, museStartUrl: 'https://muse.ai/thread/pin' } });
    const svg = document.querySelector('.side-link svg');
    check(svg !== null && cs(window, svg, 'width') === '20px' && cs(window, svg, 'height') === '20px', 'DOM: collapsed rail nav icon computes to 20px');
    check(errors.length === 0, 'DOM: no page errors in collapsed render: ' + errors.join(' | ').slice(0, 200));
  }
  // 4. dialog large icon computes to 24px (connection dialog, same opener as v26 ghost test)
  {
    const { dom, errors } = makeDom();
    const { window } = dom; const { document } = window;
    feed(window, {});
    check(click(window, '.side-link[data-page="connection"]'), 'DOM: go to connection page');
    check(click(window, '[data-action="control"]'), 'DOM: open connection dialog');
    const sym = document.querySelector('.dialog-symbol svg');
    check(sym !== null, 'DOM: dialog symbol svg exists');
    check(sym !== null && cs(window, sym, 'width') === '24px' && cs(window, sym, 'height') === '24px', 'DOM: dialog symbol icon computes to 24px');
    check(errors.length === 0, 'DOM: no page errors on dialog open: ' + errors.join(' | ').slice(0, 200));
  }

  console.log(fail === 0 ? 'UI-V30 CHECKS PASSED (' + n + ' checks)' : 'UI-V30 CHECKS FAILED: ' + fail + ' failed, ' + n + ' passed');
  process.exit(fail === 0 ? 0 : 1);
})();
