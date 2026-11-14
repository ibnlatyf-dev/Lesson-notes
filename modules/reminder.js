// F29 — Daily reminder line. Texts come ONLY from config.js (reminders: [{ar, en}]).
// Nothing is ever generated here. Empty list = hidden. Changes once per day.
import { el, bdi, isPlainObject } from './util.js';
import { pick } from './i18n.js';

export function init(app) {
  const list = (Array.isArray(app.config.reminders) ? app.config.reminders : [])
    .filter((r) => (typeof r === 'string' && r.trim()) || (isPlainObject(r) && (r.ar || r.en)));
  if (!list.length) return;
  app.hook('heroTop', {
    order: 10,
    build() {
      const now = new Date();
      const day = Math.floor((now.getTime() - now.getTimezoneOffset() * 60000) / 86400000);
      const text = pick(list[((day % list.length) + list.length) % list.length]);
      return text ? el('p', { class: 'reminder' }, bdi(text)) : null;
    },
  });
}
