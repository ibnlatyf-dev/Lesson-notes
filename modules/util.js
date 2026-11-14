// Small shared helpers. No raw innerHTML anywhere: text always goes in as text.

/**
 * el('button', { class:'chip', text:'Hi', attrs:{'aria-pressed':'false'}, on:{click:fn} }, child, …)
 */
export function el(tag, props, ...children) {
  const node = document.createElement(tag);
  if (props) {
    if (props.class) node.className = props.class;
    if (props.text != null) node.textContent = String(props.text);
    if (props.id) node.id = props.id;
    if (props.attrs) {
      for (const [k, v] of Object.entries(props.attrs)) {
        if (v === false || v == null) continue;
        node.setAttribute(k, v === true ? '' : String(v));
      }
    }
    if (props.data) for (const [k, v] of Object.entries(props.data)) node.dataset[k] = String(v);
    if (props.on) for (const [k, fn] of Object.entries(props.on)) node.addEventListener(k, fn);
    if (props.hidden) node.hidden = true;
  }
  append(node, children);
  return node;
}

export function append(node, children) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(node, c);
    else node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

/** Text wrapped in <bdi> so mixed Arabic/English never scrambles. */
export function bdi(text, cls) {
  const b = document.createElement('bdi');
  if (cls) b.className = cls;
  b.textContent = String(text == null ? '' : text);
  return b;
}

export function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

export function debounce(fn, ms) {
  let t = 0;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/** Run fn; on error log a warning and return the fallback. */
export function safe(fn, label, fallback) {
  try { return fn(); } catch (err) {
    console.warn('[LNH] ' + (label || 'error') + ':', err);
    return fallback;
  }
}

/** URL for a file path: every segment encoded (spaces, Arabic, #, %, + …). */
export function encodePath(path) {
  return String(path).split('/').map(encodeURIComponent).join('/');
}

export function fileUrl(file) {
  let url = encodePath(file.path);
  if (file.date) {
    const ts = Date.parse(file.date);
    if (Number.isFinite(ts)) url += '?v=' + Math.floor(ts / 1000).toString(36);
  }
  return url;
}

/** Page address without the hash (for sharing and the QR code). */
export function siteUrl() {
  try { return location.origin + location.pathname; }
  catch { return ''; }
}

const scripts = new Map();
/** Load a classic vendored script once. */
export function loadScript(src) {
  if (scripts.has(src)) return scripts.get(src);
  const p = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { scripts.delete(src); reject(new Error('Could not load ' + src)); };
    document.head.append(s);
  });
  scripts.set(src, p);
  return p;
}

export function vibrate(ms) {
  try {
    if (typeof navigator.vibrate !== 'function') return;
    // browsers refuse (and log) vibration before the first tap, so only ask after one
    const ua = navigator.userActivation;
    if (ua && !ua.hasBeenActive) return;
    navigator.vibrate(ms || 8);
  } catch { /* ignore */ }
}

export function mq(query) {
  try { return !!(window.matchMedia && window.matchMedia(query).matches); } catch { return false; }
}

export function motionOK() {
  return !document.documentElement.classList.contains('reading') && !mq('(prefers-reduced-motion: reduce)');
}

export async function copyText(text) {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return !!ok;
  } catch { return false; }
}

/** Fetch JSON with a timeout. Throws on network error, bad status or bad JSON. */
export async function fetchJson(url, { timeout = 9000, fetchFn, cache = 'no-cache', headers } = {}) {
  const f = fetchFn || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
  if (!f) throw new Error('fetch unavailable');
  let ctrl = null;
  let timer = 0;
  if (typeof AbortController === 'function') {
    ctrl = new AbortController();
    timer = setTimeout(() => ctrl.abort(), timeout);
  }
  try {
    const res = await f(url, { cache, headers, signal: ctrl ? ctrl.signal : undefined });
    if (!res || !res.ok) throw new Error('HTTP ' + (res ? res.status : '?'));
    const text = await res.text();
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
}

/** Optional data file: returns the parsed JSON or null — never throws. */
export async function loadOptionalJson(path, validate) {
  if (!path) return null;
  try {
    const json = await fetchJson(path, { timeout: 6000 });
    const out = validate ? validate(json) : json;
    return out == null ? null : out;
  } catch (err) {
    console.info('[LNH] optional file skipped: ' + path);
    return null;
  }
}

export function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** Only http(s) links from config are ever used as hrefs. */
export function safeHttpUrl(u) {
  try {
    const url = new URL(String(u), location.href);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch { return ''; }
}

/** WhatsApp link from a number or wa.me link in config, with optional prefilled text. */
export function whatsappLink(value, text) {
  const v = String(value || '').trim();
  if (!v) return '';
  let base = '';
  if (/^https?:\/\//i.test(v)) {
    const ok = safeHttpUrl(v);
    if (!ok || !/^(https:\/\/)(wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com)\//i.test(ok)) return '';
    base = ok;
  } else {
    const digits = v.replace(/[^\d]/g, '');
    if (digits.length < 7) return '';
    base = 'https://wa.me/' + digits;
  }
  if (!text || /chat\.whatsapp\.com/i.test(base)) return base;
  return base + (base.includes('?') ? '&' : '?') + 'text=' + encodeURIComponent(text);
}

let uid = 0;
export function nextId(prefix) { uid += 1; return (prefix || 'id') + '-' + uid; }

/** Animate a number counting up (used by the stats tile). */
export function countUp(node, to, format) {
  const fmt = format || String;
  if (!motionOK() || !Number.isFinite(to) || to <= 0 || typeof requestAnimationFrame !== 'function') {
    node.textContent = fmt(to);
    return;
  }
  const start = performance.now();
  const dur = 900;
  const step = (now) => {
    const k = clamp((now - start) / dur, 0, 1);
    const eased = 1 - Math.pow(1 - k, 3);
    node.textContent = fmt(Math.round(to * eased));
    if (k < 1) requestAnimationFrame(step);
  };
  node.textContent = fmt(0);
  requestAnimationFrame(step);
}

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Create an SVG element with attributes. */
export function svg(tag, attrs, ...children) {
  const node = document.createElementNS(SVG_NS, tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) if (v != null) node.setAttribute(k, String(v));
  for (const c of children) if (c) node.append(c);
  return node;
}

/** A small progress ring (0..1). Returns { node, set(fraction) }. */
export function ring(size, stroke) {
  const r = 16;
  const c = 2 * Math.PI * r;
  const track = svg('circle', { cx: 20, cy: 20, r, fill: 'none', 'stroke-width': stroke || 4, class: 'ring-track' });
  const bar = svg('circle', {
    cx: 20, cy: 20, r, fill: 'none', 'stroke-width': stroke || 4, class: 'ring-bar',
    'stroke-linecap': 'round', 'stroke-dasharray': c.toFixed(2), 'stroke-dashoffset': c.toFixed(2), transform: 'rotate(-90 20 20)',
  });
  const node = svg('svg', { viewBox: '0 0 40 40', width: size, height: size, class: 'ring', 'aria-hidden': 'true', focusable: 'false' }, track, bar);
  return {
    node,
    set(fraction) {
      const k = Math.min(1, Math.max(0, Number(fraction) || 0));
      bar.setAttribute('stroke-dashoffset', (c * (1 - k)).toFixed(2));
    },
  };
}

/** Open an external link in a new tab without giving it access to this page. */
export function openExternal(url) {
  const safeUrl = safeHttpUrl(url);
  if (!safeUrl) return false;
  try {
    const w = window.open(safeUrl, '_blank', 'noopener,noreferrer');
    if (w) { try { w.opener = null; } catch { /* ignore */ } }
    return true;
  } catch { return false; }
}

/** A row icon button. */
export function iconButton(iconNode, label, onClick, cls) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'icon-btn ' + (cls || '');
  b.setAttribute('aria-label', label);
  b.title = label;
  b.append(iconNode);
  if (onClick) b.addEventListener('click', onClick);
  return b;
}
