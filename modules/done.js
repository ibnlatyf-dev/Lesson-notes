// F28 — "Mark as done" checklist per file (this device only), a progress ring per subject,
// and an optional "Hide completed" chip.
import { el, iconButton, ring, vibrate } from './util.js';
import { icon } from './icons.js';
import { t, fmtNum } from './i18n.js';
import { makeChip } from './grid.js';

export function init(app) {
  const saved = app.store.local.get('done', []);
  const done = new Set(Array.isArray(saved) ? saved.filter((x) => typeof x === 'string') : []);
  let hide = false;
  const rings = new Map();
  const save = () => app.store.local.set('done', Array.from(done));

  const paint = (btn, row, on) => {
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    const label = on ? t('done.unmark') : t('done.mark');
    btn.setAttribute('aria-label', label);
    btn.title = label;
    btn.textContent = '';
    btn.append(icon(on ? 'check-circle-fill' : 'check-circle'));
    if (row) row.classList.toggle('is-done', on);
  };

  app.hook('rowActions', {
    order: 20,
    build(file, row) {
      const btn = iconButton(icon('check-circle'), t('done.mark'), () => {
        const on = !done.has(file.path);
        if (on) done.add(file.path); else done.delete(file.path);
        save();
        paint(btn, row, on);
        vibrate(6);
        const update = rings.get(file.subjectKey);
        if (update) update();
        if (hide) app.applyFilters();
      }, 'act-done');
      paint(btn, row, done.has(file.path));
      return btn;
    },
  });

  app.hook('subjectHeader', {
    order: 10,
    build(subject) {
      const r = ring(34, 4);
      const label = el('span', { class: 'ring-label', attrs: { dir: 'ltr' } });
      const wrap = el('span', { class: 'progress', attrs: { role: 'img' } }, r.node, label);
      const update = () => {
        const total = subject.files.length;
        const n = subject.files.filter((f) => done.has(f.path)).length;
        r.set(total ? n / total : 0);
        label.textContent = fmtNum(n) + '/' + fmtNum(total);
        const text = t('done.progress', { n: fmtNum(n), total: fmtNum(total) });
        wrap.setAttribute('aria-label', text);
        wrap.title = text;
        wrap.classList.toggle('complete', total > 0 && n === total);
      };
      rings.set(subject.key, update);
      update();
      return wrap;
    },
  });

  app.hook('filterChips', {
    order: 20,
    build() {
      return makeChip(t('done.hide'), hide, (btn) => {
        hide = !hide;
        btn.setAttribute('aria-pressed', hide ? 'true' : 'false');
        app.applyFilters();
      }, { icon: 'check-circle', className: 'chip-hide-done' });
    },
  });

  app.hook('filters', { id: 'hideDone', active: () => hide, test: (f) => !done.has(f.path) });
  app.on('clear-filters', () => { hide = false; });
  app.done = { has: (p) => done.has(p), count: () => done.size };
}
