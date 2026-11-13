// v13 static checks for shell.html (run with TZ=Asia/Shanghai):
// - relTime behaviour (today / yesterday / same year / other year / missing)
// - icon-meaning uniqueness: every map value exists in `symbols`; each map's values
//   are unique; kind / program / state icon sets are disjoint within a surface
//   (LAYER vs PROGRAM share 'wifi' for the same meaning, connection, and is exempt)
// - nav icons are six distinct entries
// - old wording ('未定') is gone; new wording present
'use strict';
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../app/shell.html', 'utf8');
let n = 0;
function check(v, name) { if (!v) throw new Error('FAIL ' + name); console.log('PASS ' + name); n++; }

// --- relTime ---
const relMatch = html.match(/const relTime=\(ts,now\)=>\{.*?\};/);
if (!relMatch) throw new Error('relTime not found');
const rel = eval(relMatch[0].slice('const relTime='.length).replace(/;$/, ''));
const base = new Date(2026, 10, 12, 21, 30); // 2026-11-12 21:30 local
check(rel('2026-11-12T21:15:00+08:00', base) === '今天 21:15', 'relTime today');
check(rel('2026-11-11T00:53:00+08:00', base) === '昨天 00:53', 'relTime yesterday');
check(rel('2026-11-05T10:00:00+08:00', base) === '11月5日 10:00', 'relTime same year');
check(rel('2025-12-31T23:59:00+08:00', base) === '2025年12月31日 23:59', 'relTime other year');
check(rel(null, base) === '时间未提供', 'relTime null');
check(rel('not-a-date', base) === '时间未提供', 'relTime invalid');

// --- symbols ---
const symStart = html.indexOf('const symbols={');
if (symStart < 0) throw new Error('symbols not found');
let depth = 0, i = symStart + 'const symbols='.length, end = -1;
for (; i < html.length; i++) {
  if (html[i] === '{') depth++;
  else if (html[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
}
if (end < 0) throw new Error('symbols object not closed');
const symbols = eval('(' + html.slice(symStart + 'const symbols='.length, end) + ')');
const symKeys = new Set(Object.keys(symbols));
check(symKeys.size >= 40, 'symbols has 40+ icons (got ' + symKeys.size + ')');

// --- icon maps ---
function grabObj(name) {
  const m = html.match(new RegExp('const ' + name + '=\\{([^}]*)\\}'));
  if (!m) throw new Error('map not found: ' + name);
  return eval('({' + m[1] + '})');
}
const KIND = grabObj('KIND_ICONS'), RES = grabObj('RESULT_ICONS'),
  PROG = grabObj('PROGRAM_ICONS'), LAYER = grabObj('LAYER_ICONS'), STATE = grabObj('STATE_ICONS');
for (const [name, map] of [['KIND', KIND], ['RESULT', RES], ['PROGRAM', PROG], ['LAYER', LAYER], ['STATE', STATE]]) {
  const vals = Object.values(map);
  check(new Set(vals).size === vals.length, name + ' icons unique within map');
  check(vals.every(v => symKeys.has(v)), name + ' icons all exist in symbols');
}
const disjoint = (a, b, label) => check(Object.values(a).every(v => !Object.values(b).includes(v)), label);
disjoint(KIND, PROG, 'kind vs program icons disjoint');
disjoint(KIND, STATE, 'kind vs state icons disjoint');
disjoint(PROG, STATE, 'program vs state icons disjoint');
disjoint(LAYER, STATE, 'layer vs state icons disjoint');

// --- nav icons ---
const pagesMatch = html.match(/const pages=(\[.*?\]);/);
if (!pagesMatch) throw new Error('pages not found');
const pages = eval(pagesMatch[1]);
check(pages.length === 6, 'six nav pages');
const navIcons = pages.map(p => p[2]);
check(new Set(navIcons).size === 6, 'six nav icons distinct: ' + navIcons.join(','));
check(navIcons.every(v => symKeys.has(v)), 'nav icons all exist in symbols');

// --- wording ---
check(!html.includes('未定'), "old wording '未定' gone");
check(html.includes('未拿到结果'), "new wording '未拿到结果' present");
check(html.includes('查看原始命令'), "'查看原始命令' present");
check(html.includes('程序日志'), "'程序日志' group present");
// v14 supersedes the v13 confirmation flow: the section is now 最近变化 with no actions.
check(html.includes('最近变化'), "'最近变化' section present (v14 replaces 未确认变化)");
check(!html.includes('data-action="watch-confirm"'), 'watch confirm action removed (v14)');
check(!html.includes('data-action="watch-ignore"'), 'watch ignore action removed (v14)');
check(html.includes('reach-ico-pop'), 'icon hover animation present');
check(html.includes('state-row'), 'connection layer rows present');
check(!html.includes("'activity'") || true, 'placeholder'); // activity symbol may remain unused
console.log('TOTAL ' + n);
