// F26 — Glossary tile from data/glossary.json: [{ term, ar, en, subject }].
// Searchable, filterable by subject, accessible expand/collapse (<details>).
// Definitions are shown exactly as written — never rewritten or shortened.
import { el, bdi, loadOptionalJson, isPlainObject, debounce } from './util.js';
import { icon } from './icons.js';
import { t, pick, plural } from './i18n.js';
import { normalizeText } from './parser.js';
import { makeTile } from './grid.js';

export function validateGlossary(json) {
  if (!Array.isArray(json)) return null;
  const out = [];
  for (const item of json) {
    if (!isPlainObject(item) || typeof item.term !== 'string' || !item.term.trim()) continue;
    const ar = typeof item.ar === 'string' ? item.ar : '';
    const en = typeof item.en === 'string' ? item.en : '';
    if (!ar && !en) continue;
    const subject = typeof item.subject === 'string' ? item.subject.trim() : '';
    out.push({ term: item.term, ar, en, subject, search: normalizeText(item.term + ' ' + ar + ' ' + en + ' ' + subject) });
  }
  return out;
}

export function init(app) {
  let terms = [];
  let query = '';
  let subject = '';

  app.hook('tiles', {
    id: 'glossary', order: 400, span: 2,
    build() {
      if (!terms.length) return null;
      const { tile, body } = makeTile('glossary', { className: 'tile-glossary', title: t('glossary.title'), icon: 'book-open', span: 2 });
      const list = el('div', { class: 'glossary-list' });
      const count = el('p', { class: 'result-count', attrs: { 'aria-live': 'polite' } });
      const items = terms.map((g) => {
        const def = pick({ ar: g.ar, en: g.en });
        const node = el('details', { class: 'gloss' },
          el('summary', null, bdi(g.term, 'gloss-term'),
            g.subject ? el('span', { class: 'badge' }, bdi(g.subject)) : null,
            el('span', { class: 'caret' }, icon('caret-down'))),
          el('p', { class: 'gloss-def', attrs: { dir: 'auto' } }, def));
        list.append(node);
        return { g, node };
      });
      const apply = () => {
        const words = normalizeText(query).split(' ').filter(Boolean);
        let shown = 0;
        for (const { g, node } of items) {
          const ok = (!subject || g.subject === subject) && words.every((w) => g.search.includes(w));
          node.hidden = !ok;
          if (ok) shown += 1;
        }
        count.textContent = query || subject ? plural('glossary.results', shown) : plural('glossary.count', items.length);
      };

      const input = el('input', {
        class: 'search-input', attrs: { type: 'search', placeholder: t('glossary.search'), 'aria-label': t('glossary.search'), dir: 'auto', autocomplete: 'off' },
      });
      input.value = query;
      input.addEventListener('input', debounce(() => { query = input.value; apply(); }, 120));
      const bar = el('div', { class: 'search-bar' }, el('div', { class: 'search-box' }, el('span', { class: 'search-ic' }, icon('magnifying-glass')), input));

      const subjects = Array.from(new Set(terms.map((g) => g.subject).filter(Boolean)));
      if (subjects.length > 1) {
        const select = el('select', { class: 'sort-select', attrs: { 'aria-label': t('glossary.subject') } },
          el('option', { text: t('glossary.allSubjects'), attrs: { value: '' } }));
        for (const s of subjects) {
          const o = el('option', { text: s, attrs: { value: s } });
          if (s === subject) o.selected = true;
          select.append(o);
        }
        select.addEventListener('change', () => { subject = select.value; apply(); });
        bar.append(el('label', { class: 'sort-box' }, icon('funnel'), select));
      } else subject = '';

      body.append(bar, count, list);
      apply();
      return tile;
    },
  });

  return loadOptionalJson(app.config.data.glossary, validateGlossary).then((list) => {
    if (!list || !list.length) return;
    terms = list;
    app.requestRebuild();
  });
}
