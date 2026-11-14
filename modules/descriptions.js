// F11 — Per-file description line from data/info.json (optional).
// Format: { "Exact file name.pdf": { "ar": "…", "en": "…" } }
import { el, bdi, loadOptionalJson, isPlainObject } from './util.js';
import { pick } from './i18n.js';

export function validateInfo(json) {
  if (!isPlainObject(json)) return null;
  const out = new Map();
  for (const [name, v] of Object.entries(json)) {
    if (name.startsWith('_')) continue;
    if (typeof v === 'string' && v.trim()) out.set(name, { ar: v, en: v });
    else if (isPlainObject(v)) {
      const d = {};
      if (typeof v.ar === 'string' && v.ar.trim()) d.ar = v.ar;
      if (typeof v.en === 'string' && v.en.trim()) d.en = v.en;
      if (d.ar || d.en) out.set(name, d);
    }
  }
  return out;
}

export function init(app) {
  let info = new Map();
  app.fileDesc = (file) => info.get(file.name) || null;
  app.hook('rowText', {
    order: 10,
    build(file) {
      const text = pick(app.fileDesc(file));
      return text ? el('span', { class: 'file-desc' }, bdi(text)) : null;
    },
  });
  return loadOptionalJson(app.config.data.info, validateInfo).then((map) => {
    if (!map || !map.size) return;
    info = map;
    app.requestRebuild(); // only does something if the page was already drawn
  });
}
