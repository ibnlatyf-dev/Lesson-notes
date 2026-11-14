// Language helper: every visible string comes from /translations.js.
import { translations } from '../translations.js';

let lang = 'en';
const fmtCache = new Map();

export function getLang() { return lang; }
export function languages() { return Object.keys(translations); }

export function setLang(next) {
  lang = translations[next] ? next : 'en';
  fmtCache.clear();
  return lang;
}

function dict(l) { return translations[l] || translations.en || {}; }

function numerals() {
  const n = dict(lang)._numerals;
  return n === 'arab' ? 'arab' : 'latn';
}

function locale() {
  return (lang === 'ar' ? 'ar' : lang) + '-u-nu-' + numerals() + '-ca-gregory';
}

/** t('key', {name:'x'}) -> string in the current language (falls back to English, then the key). */
export function t(key, vars) {
  let s = dict(lang)[key];
  if (s == null) s = dict('en')[key];
  if (s == null) return key;
  if (typeof s !== 'string') return key;
  return fill(s, vars);
}

/** Text in a given {ar, en} object from config/data, in the current language. */
export function pick(obj) {
  if (obj == null) return '';
  if (typeof obj === 'string') return obj;
  if (typeof obj !== 'object') return '';
  const v = obj[lang] || obj.en || obj.ar || '';
  return typeof v === 'string' ? v : '';
}

function fill(s, vars) {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
}

/** Plural-aware text. The entry is an object: { one:'{n} file', other:'{n} files', … } */
export function plural(key, n, vars) {
  let forms = dict(lang)[key];
  if (forms == null || typeof forms !== 'object') forms = dict('en')[key];
  if (forms == null) return key;
  if (typeof forms === 'string') return fill(forms, { n: fmtNum(n), ...vars });
  let cat = 'other';
  try { cat = new Intl.PluralRules(lang).select(n); } catch { cat = n === 1 ? 'one' : 'other'; }
  const s = forms[cat] != null ? forms[cat] : forms.other != null ? forms.other : '';
  return fill(String(s), { n: fmtNum(n), ...vars });
}

export function fmtNum(n, opts) {
  try {
    const key = 'n' + JSON.stringify(opts || {});
    let f = fmtCache.get(key);
    if (!f) { f = new Intl.NumberFormat(locale(), opts); fmtCache.set(key, f); }
    return f.format(n);
  } catch { return String(n); }
}

export function fmtDate(value, style) {
  const d = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(d.getTime())) return '';
  try {
    const key = 'd' + (style || 'm');
    let f = fmtCache.get(key);
    if (!f) {
      const o = style === 'long'
        ? { day: 'numeric', month: 'long', year: 'numeric' }
        : { day: 'numeric', month: 'short', year: 'numeric' };
      f = new Intl.DateTimeFormat(locale(), o);
      fmtCache.set(key, f);
    }
    return f.format(d);
  } catch { return d.toISOString().slice(0, 10); }
}

export function fmtSize(bytes) {
  const b = Number(bytes);
  if (!Number.isFinite(b) || b <= 0) return '';
  if (b < 1024) return t('size.b', { n: fmtNum(b) });
  if (b < 1024 * 1024) return t('size.kb', { n: fmtNum(b / 1024, { maximumFractionDigits: b < 10240 ? 1 : 0 }) });
  return t('size.mb', { n: fmtNum(b / 1048576, { maximumFractionDigits: b < 104857600 ? 1 : 0 }) });
}

/** Fill every [data-i18n] / [data-i18n-attr] element under root. */
export function applyStatic(root) {
  const scope = root || document;
  scope.querySelectorAll('[data-i18n]').forEach((node) => {
    node.textContent = t(node.getAttribute('data-i18n'));
  });
  scope.querySelectorAll('[data-i18n-attr]').forEach((node) => {
    // format: "aria-label:key;title:key"
    for (const pair of node.getAttribute('data-i18n-attr').split(';')) {
      const i = pair.indexOf(':');
      if (i < 1) continue;
      node.setAttribute(pair.slice(0, i).trim(), t(pair.slice(i + 1).trim()));
    }
  });
}

export function collator() {
  try { return new Intl.Collator([lang, 'ar', 'en'], { numeric: true, sensitivity: 'base' }); }
  catch { return { compare: (a, b) => (a < b ? -1 : a > b ? 1 : 0) }; }
}
