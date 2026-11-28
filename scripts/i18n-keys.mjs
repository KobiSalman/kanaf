// כל המחרוזות בעברית שצריכות תרגום: מהקוד (app/, lib/) ומקובצי הנתונים (data/).
// node scripts/i18n-keys.mjs           -> רשימת המחרוזות שחסרות במילון האנגלי
// node scripts/i18n-keys.mjs --all     -> כל המחרוזות
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const HEB = /[֐-׿]/;

// קבצים שהעברית בהם נשארת עברית: מייל הדיווח שנשלח אלינו, ובדיקת התקינות של השרת
const SKIP_FILES = new Set(['app/api/health/route.js']);
const SKIP_LINE = /`(מייל לחזרה|טיסה|לשונית|כתובת|מכשיר|זמן|שפה): |'— פרטים —'|const subject = `כנף · דיווח|'לא נמסר'|` על \$\{clip/;

function walk(dir, out = []) {
  for (const f of readdirSync(join(ROOT, dir))) {
    const rel = join(dir, f);
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out);
    else if (/\.(js|mjs)$/.test(f)) out.push(rel);
  }
  return out;
}

// מוצא מחרוזות ('...', "...", `...`) בלי הערות ובלי ביטויים רגולריים
export function literals(src) {
  const out = [];
  let i = 0;
  const n = src.length;
  let prev = '';
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { i = src.indexOf('*/', i + 2); i = i < 0 ? n : i + 2; continue; }
    if (c === '/' && d !== '>' && /[=(,:!&|?{;\[]|return$/.test(prev)) {
      // ביטוי רגולרי
      i++;
      let cls = false;
      while (i < n && (src[i] !== '/' || cls)) { if (src[i] === '\\') i++; else if (src[i] === '[') cls = true; else if (src[i] === ']') cls = false; i++; }
      i++; prev = 'x'; continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      const q = c; let j = i + 1, s = '';
      while (j < n && src[j] !== q) {
        if (src[j] === '\\') { s += src[j + 1] === "'" || src[j + 1] === '"' ? src[j + 1] : src[j] + src[j + 1]; j += 2; continue; }
        if (q === '`' && src[j] === '$' && src[j + 1] === '{') {
          // ביטוי בתוך התבנית: מחפשים בו מחרוזות בנפרד, ובתבנית עצמה נשאר רק הטקסט הקבוע
          let depth = 1, k = j + 2;
          while (k < n && depth) { if (src[k] === '{') depth++; else if (src[k] === '}') depth--; k++; }
          out.push(...literals(src.slice(j + 2, k - 1)));
          s += '\u0000'; j = k; continue;
        }
        if (q !== '`' && src[j] === '\n') break;
        s += src[j]; j++;
      }
      const line = src.lastIndexOf('\n', i) + 1;
      out.push({ q, s, line: src.slice(line, src.indexOf('\n', i)) });
      i = j + 1; prev = 'x'; continue;
    }
    // טקסט JSX: >טקסט< בלי סוגריים מסולסלים
    if (c === '>' ) {
      const m = /^>([^<>{}=;()]*?)</.exec(src.slice(i, i + 400));
      if (m && HEB.test(m[1]) && !/[&|?]/.test(src[i - 1] || '')) out.push({ q: 'jsx', s: m[1].trim(), line: m[1] });
    }
    if (!/\s/.test(c)) prev = /[\w$]/.test(c) ? (/\breturn$/.test(src.slice(Math.max(0, i - 6), i + 1)) ? 'return' : 'x') : c;
    i++;
  }
  return out;
}

export function codeStrings() {
  const files = [...walk('app'), ...walk('lib'), 'middleware.js'];
  const keys = new Map(), problems = [];
  for (const f of files) {
    if (SKIP_FILES.has(f)) continue;
    for (const l of literals(readFileSync(join(ROOT, f), 'utf8'))) {
      if (!HEB.test(l.s) || SKIP_LINE.test(l.line)) continue;
      if (l.q === '`' || l.q === 'jsx') { problems.push(`${f}: ${l.q === 'jsx' ? 'טקסט JSX בלי tr()' : 'תבנית עם עברית'}: ${l.s.slice(0, 80)}`); continue; }
      if (!keys.has(l.s)) keys.set(l.s, f);
    }
  }
  return { keys, problems };
}

export function dataStrings() {
  const out = new Set();
  const visit = (v) => {
    if (typeof v === 'string') { if (HEB.test(v)) out.add(v); }
    else if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === 'object') Object.values(v).forEach(visit);
  };
  for (const f of readdirSync(join(ROOT, 'data'))) if (f.endsWith('.json')) visit(JSON.parse(readFileSync(join(ROOT, 'data', f), 'utf8')));
  return out;
}

if (process.argv[1] && process.argv[1].endsWith('i18n-keys.mjs')) {
  const ui = JSON.parse(readFileSync(join(ROOT, 'locales/en.json'), 'utf8'));
  const data = JSON.parse(readFileSync(join(ROOT, 'locales/en.data.json'), 'utf8'));
  const { keys, problems } = codeStrings();
  const all = process.argv.includes('--all');
  const missingUi = [...keys.keys()].filter((k) => all || !(k in ui) && !(k in data));
  const missingData = [...dataStrings()].filter((k) => all || !(k in data) && !(k in ui));
  console.log(JSON.stringify({ problems, ui: missingUi, data: missingData }, null, 1));
}
