// The bento grid: builds tiles and file rows, filters/sorts without rebuilding,
// packs every row of the grid full (no holes) and glides tiles with FLIP.
import { el, bdi, fileUrl, motionOK, mq, countUp, debounce, nextId } from './util.js';
import { t, plural, fmtDate, fmtSize, fmtNum, collator } from './i18n.js';
import { icon } from './icons.js';
import { normalizeText } from './parser.js';

export const KINDS = ['pdf', 'slides', 'word', 'image', 'audio'];
const KIND_ICON = { pdf: 'file-pdf', slides: 'file-ppt', word: 'file-doc', image: 'file-image', audio: 'file-audio', other: 'file' };
const TAG_ICON = { full: 'files', summary: 'article', print: 'printer', updated: 'arrows-clockwise', exam: 'exam' };
const ROW_LIMIT = 6;

export function kindIcon(kind) { return KIND_ICON[kind] || 'file'; }

function isPhone() { return mq('(max-width: 699px)'); }

/** A glass tile: { tile, body, head }. */
export function makeTile(id, opts) {
  const o = opts || {};
  const tile = el('section', { class: 'tile glass ' + (o.className || ''), data: { tile: id } });
  const body = el('div', { class: 'tile-body' });
  let head = null;
  if (o.title) {
    const hid = nextId('tile-h');
    head = el('header', { class: 'tile-head' },
      o.icon ? el('span', { class: 'tile-icon' }, icon(o.icon)) : null,
      el('h2', { class: 'tile-title', id: hid, text: o.title }),
      o.headerExtra || null);
    tile.setAttribute('aria-labelledby', hid);
    tile.append(head);
  }
  tile.append(body);
  tile._span = o.span || 1;
  return { tile, body, head };
}

function runHooks(app, type, target, ...args) {
  const defs = (app.hooks[type] || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  for (const def of defs) {
    try {
      const node = def.build(...args, app);
      if (node) target.append(node);
    } catch (err) {
      console.warn('[LNH] hook "' + type + '" (' + (def.owner || '?') + ') failed:', err);
    }
  }
}

/* ------------------------------------------------------------------ badges */

export function buildBadges(app, file) {
  const wrap = el('span', { class: 'badges' });
  if (app.flag('newBadges') && app.isNew(file)) {
    wrap.append(el('span', { class: 'badge badge-new' }, icon('sparkle'), el('span', { text: t('badge.new') })));
  }
  if (app.flag('tagBadges')) {
    for (const tag of file.tags) {
      let label = t('tag.' + tag);
      if (tag === 'print') label = t('tag.printLabel');
      if (tag === 'updated' && file.date) label = t('tag.updatedOn', { date: fmtDate(file.date) });
      wrap.append(el('span', { class: 'badge badge-' + tag }, icon(TAG_ICON[tag] || 'tag'), el('span', { text: label })));
    }
  }
  runHooks(app, 'rowBadges', wrap, file);
  return wrap.childNodes.length ? wrap : null;
}

/* -------------------------------------------------------------------- rows */

function metaLine(app, file) {
  const meta = el('span', { class: 'file-meta' });
  const parts = [];
  if (file.date) parts.push(el('span', { class: 'meta-date', text: fmtDate(file.date) }));
  const size = fmtSize(file.size);
  if (size) {
    const large = app.flag('largeFileWarning') && app.isLarge(file);
    parts.push(el('span', { class: 'meta-size' + (large ? ' is-large' : ''), text: size, attrs: large ? { title: t('large.badge') } : null }));
  }
  if (file.ext) parts.push(el('span', { class: 'meta-ext', text: file.ext.toUpperCase(), attrs: { dir: 'ltr' } }));
  parts.forEach((p, i) => { if (i) meta.append(el('span', { class: 'dot', text: '·', attrs: { 'aria-hidden': 'true' } })); meta.append(p); });
  return parts.length ? meta : null;
}

export function buildRow(app, file) {
  const row = el('li', { class: 'file-row', id: 'row-' + file.id, data: { path: file.path, kind: file.kind } });
  if (file.lesson != null) row.dataset.lesson = String(file.lesson);

  const text = el('span', { class: 'file-text' },
    el('span', { class: 'file-title' }, bdi(file.title)));
  runHooks(app, 'rowText', text, file);
  const badges = buildBadges(app, file);
  if (badges) text.append(badges);
  const meta = metaLine(app, file);
  if (meta) text.append(meta);

  const main = el('button', {
    class: 'file-main',
    attrs: { type: 'button', 'aria-label': t('file.open', { name: file.title }) },
    on: { click: () => app.open(file, row) },
  }, el('span', { class: 'file-icon kind-' + file.kind }, icon(kindIcon(file.kind))), text);

  const actions = el('div', { class: 'file-actions' });
  const tools = el('div', { class: 'file-tools' });
  runHooks(app, 'rowActions', tools, file, row);
  actions.append(tools, buildDownloadLink(app, file));

  row.append(main, actions, el('div', { class: 'file-slot' }));
  return row;
}

export function buildDownloadLink(app, file, cls) {
  const a = el('a', {
    class: 'btn btn-primary btn-dl ' + (cls || ''),
    attrs: { href: fileUrl(file), download: file.name, 'aria-label': t('file.downloadName', { name: file.title }) },
  }, icon('download-simple'), el('span', { text: t('file.download') }));
  a.addEventListener('click', () => {
    a.classList.remove('did-download');
    void a.offsetWidth; // restart the tiny success animation
    a.classList.add('did-download');
    app.emit('download', { file, el: a });
  });
  return a;
}

/** Compact row used by Newest / Exam corner. Clicking opens the file. */
export function buildMini(app, file, opts) {
  const o = opts || {};
  const sub = el('span', { class: 'mini-sub' });
  if (o.subject !== false) sub.append(bdi(app.subjectName(file.subjectKey)));
  if (o.date !== false && file.date) {
    if (sub.childNodes.length) sub.append(el('span', { class: 'dot', text: '·', attrs: { 'aria-hidden': 'true' } }));
    sub.append(el('span', { text: fmtDate(file.date) }));
  }
  const text = el('span', { class: 'file-text' }, el('span', { class: 'file-title' }, bdi(file.title)), sub);
  if (o.badges !== false) { const b = buildBadges(app, file); if (b) text.append(b); }
  return el('li', { class: 'mini-row' },
    el('button', {
      class: 'file-main',
      attrs: { type: 'button', 'aria-label': t('file.open', { name: file.title }) },
      on: { click: () => app.open(file, null) },
    }, el('span', { class: 'file-icon kind-' + file.kind }, icon(kindIcon(file.kind))), text));
}

/* ------------------------------------------------------------- core tiles */

function buildHero(app) {
  const { tile, body } = makeTile('hero', { className: 'tile-hero', span: 2 });
  const top = el('div', { class: 'hero-top' });
  runHooks(app, 'heroTop', top);
  if (top.childNodes.length) body.append(top);
  body.append(
    el('h1', { class: 'hero-title', text: t('site.title') }),
    el('p', { class: 'hero-sub', text: t('hero.welcome') }));
  return tile;
}

function buildStats(app) {
  if (!app.files.length) return null;
  const { tile, body } = makeTile('stats', { className: 'tile-stats', title: t('stats.title'), icon: 'stack' });
  const animate = !app._statsShown;
  app._statsShown = true;
  const stat = (value, label, isNumber) => {
    const num = el('span', { class: 'stat-num' });
    if (isNumber && animate) countUp(num, value, (n) => fmtNum(n)); else num.textContent = isNumber ? fmtNum(value) : value;
    return el('div', { class: 'stat' }, num, el('span', { class: 'stat-label', text: label }));
  };
  const list = el('div', { class: 'stats' },
    stat(app.files.length, t('stats.files'), true),
    stat(app.subjects.length, t('stats.subjects'), true));
  const latest = app.files.reduce((m, f) => Math.max(m, f.ts || 0), 0);
  if (latest) list.append(el('div', { class: 'stat stat-wide' },
    el('span', { class: 'stat-date', text: fmtDate(latest) }),
    el('span', { class: 'stat-label', text: t('stats.updated') })));
  body.append(list);
  return tile;
}

function chip(label, pressed, onClick, extra) {
  const b = el('button', {
    class: 'chip' + (extra && extra.className ? ' ' + extra.className : ''),
    attrs: { type: 'button', 'aria-pressed': pressed ? 'true' : 'false' },
    on: { click: () => onClick(b) },
  });
  if (extra && extra.icon) b.append(icon(extra.icon));
  b.append(typeof label === 'string' ? el('span', { text: label }) : label);
  return b;
}
export { chip as makeChip };

function buildSearch(app) {
  if (!app.files.length) return null;
  const st = app.state;
  const { tile, body } = makeTile('search', { className: 'tile-search', span: 'full' });
  tile.setAttribute('aria-label', t('search.title'));

  const input = el('input', {
    id: 'search-input', class: 'search-input',
    attrs: {
      type: 'search', placeholder: t('search.placeholder'), 'aria-label': t('search.placeholder'),
      autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', enterkeyhint: 'search', dir: 'auto',
    },
  });
  input.value = st.query;
  const clear = el('button', {
    class: 'icon-btn search-clear', hidden: !st.query,
    attrs: { type: 'button', 'aria-label': t('search.clear'), title: t('search.clear') },
    on: { click: () => { input.value = ''; st.query = ''; clear.hidden = true; applyFilters(app); input.focus(); } },
  }, icon('x'));
  const run = debounce(() => { st.query = input.value; applyFilters(app); }, 140);
  input.addEventListener('input', () => { clear.hidden = !input.value; run(); });
  const box = el('div', { class: 'search-box' }, el('span', { class: 'search-ic' }, icon('magnifying-glass')), input, clear);

  const bar = el('div', { class: 'search-bar' }, box);

  if (app.flag('sort')) {
    const select = el('select', { class: 'sort-select', id: 'sort-select', attrs: { 'aria-label': t('sort.label') } });
    for (const key of ['lesson', 'newest', 'oldest', 'az']) {
      const opt = el('option', { text: t('sort.' + key), attrs: { value: key } });
      if (st.sort === key) opt.selected = true;
      select.append(opt);
    }
    select.addEventListener('change', () => {
      st.sort = select.value;
      app.store.local.set('sort', st.sort);
      applyFilters(app);
    });
    bar.append(el('label', { class: 'sort-box' }, icon('sort-ascending'), el('span', { class: 'sr-only', text: t('sort.label') }), select));
  }

  const filters = el('div', { class: 'filters', id: 'filters' });
  const toggle = el('button', {
    class: 'icon-btn filter-toggle',
    attrs: { type: 'button', 'aria-expanded': app._filtersOpen ? 'true' : 'false', 'aria-controls': 'filters', 'aria-label': t('search.filters'), title: t('search.filters') },
    on: {
      click: () => {
        app._filtersOpen = !app._filtersOpen;
        toggle.setAttribute('aria-expanded', app._filtersOpen ? 'true' : 'false');
        tile.classList.toggle('filters-open', app._filtersOpen);
      },
    },
  }, icon('funnel'), el('span', { class: 'filter-dot', attrs: { 'aria-hidden': 'true' } }));
  tile.classList.toggle('filters-open', !!app._filtersOpen);
  bar.append(toggle);

  // Subject chips
  const subjRow = el('div', { class: 'chip-row', attrs: { role: 'group', 'aria-label': t('search.subjects') } });
  const subjChips = [];
  const setSubject = (key) => {
    st.subject = key;
    subjChips.forEach(([k, c]) => c.setAttribute('aria-pressed', k === key ? 'true' : 'false'));
    applyFilters(app);
  };
  const all = chip(t('search.all'), st.subject == null, () => setSubject(null));
  subjChips.push([null, all]);
  subjRow.append(all);
  for (const s of app.subjects) {
    const c = chip(bdi(app.subjectName(s.key)), st.subject === s.key, () => setSubject(st.subject === s.key ? null : s.key));
    subjChips.push([s.key, c]);
    subjRow.append(c);
  }
  if (app.subjects.length > 1) filters.append(subjRow);

  // Type chips + chips added by modules (My files, Hide completed)
  const typeRow = el('div', { class: 'chip-row', attrs: { role: 'group', 'aria-label': t('search.types') } });
  if (app.flag('typeFilter')) {
    for (const kind of KINDS) {
      const has = app.files.some((f) => f.kind === kind);
      const c = chip(t('type.' + kind), st.types.has(kind), (btn) => {
        if (st.types.has(kind)) st.types.delete(kind); else st.types.add(kind);
        btn.setAttribute('aria-pressed', st.types.has(kind) ? 'true' : 'false');
        applyFilters(app);
      }, { icon: kindIcon(kind), className: 'chip-type' });
      if (!has) c.disabled = true;
      typeRow.append(c);
    }
  }
  runHooks(app, 'filterChips', typeRow);
  if (typeRow.childNodes.length) filters.append(typeRow);

  const count = el('p', { class: 'result-count', id: 'result-count', attrs: { 'aria-live': 'polite' } });
  body.append(bar, filters, count);
  tile._resultCount = count;
  return tile;
}

function setOpen(tile, open) {
  tile.classList.toggle('collapsed', !open);
  tile.classList.remove('force-open');
  syncExpanded(tile);
}
function isOpen(tile) { return !tile.classList.contains('collapsed') || tile.classList.contains('force-open'); }
function syncExpanded(tile) {
  if (tile._toggle) tile._toggle.setAttribute('aria-expanded', isOpen(tile) ? 'true' : 'false');
}

function buildSubjectTile(app, subject, index) {
  const name = app.subjectName(subject.key);
  const tile = el('section', {
    class: 'tile glass tile-subject tint-' + app.subjectTint(subject, index),
    data: { tile: 'subject:' + subject.key, subject: subject.key },
  });
  tile._span = 1;
  tile._spanFor = (n) => (n >= 4 && subject.files.length >= 7 ? 2 : 1);
  tile._subject = subject;

  const bodyId = nextId('subject-body');
  const count = el('span', { class: 'subject-count' });
  const toggle = el('button', {
    class: 'subject-toggle',
    attrs: { type: 'button', 'aria-expanded': 'true', 'aria-controls': bodyId },
    on: { click: () => { setOpen(tile, !isOpen(tile)); requestLayout(app); } },
  },
  el('span', { class: 'subject-icon' }, icon(app.subjectIcon(subject))),
  el('span', { class: 'subject-text' }, bdi(name, 'subject-name'), count),
  el('span', { class: 'caret' }, icon('caret-down')));
  tile._toggle = toggle;
  tile._count = count;

  const tools = el('div', { class: 'subject-tools' });
  runHooks(app, 'subjectHeader', tools, subject, tile);
  tile.append(el('header', { class: 'tile-head subject-head' }, el('h2', { class: 'tile-title' }, toggle), tools));

  const inner = el('div', { class: 'collapse-inner' });
  runHooks(app, 'subjectTop', inner, subject, tile);
  const list = el('ul', { class: 'file-list', attrs: { 'aria-label': name } });
  for (const file of subject.files) {
    try {
      const row = buildRow(app, file);
      app.rows.set(file.path, row);
      list.append(row);
    } catch (err) { console.warn('[LNH] row failed:', err); }
  }
  tile._list = list;
  const more = el('button', {
    class: 'btn btn-ghost show-all', hidden: true, attrs: { type: 'button' },
    on: { click: () => { tile._showAll = true; applyFilters(app, { animate: false }); } },
  });
  tile._more = more;
  inner.append(list, more);
  tile.append(el('div', { class: 'collapse', id: bodyId }, inner));

  const key = 'open:' + subject.key;
  const saved = app.session[key];
  const startOpen = saved != null ? saved : !(isPhone() && app.subjects.length > 2);
  if (!startOpen) tile.classList.add('collapsed');
  toggle.addEventListener('click', () => { app.session[key] = isOpen(tile); });
  syncExpanded(tile);
  return tile;
}

function buildNewest(app) {
  const now = Date.now();
  const recentUpdate = (f) => (f.tags.includes('updated') && now - f.ts < 30 * 86400000 ? 1 : 0);
  const items = app.files.filter((f) => f.ts)
    .sort((a, b) => (recentUpdate(b) - recentUpdate(a)) || (b.ts - a.ts))
    .slice(0, 5);
  if (!items.length) return null;
  const { tile, body } = makeTile('newest', { className: 'tile-newest', title: t('newest.title'), icon: 'sparkle' });
  const list = el('ul', { class: 'mini-list' });
  for (const f of items) list.append(buildMini(app, f));
  body.append(list);
  return tile;
}

function buildState(app) {
  const s = app.list.state;
  if (s === 'error') {
    const { tile, body } = makeTile('state', { className: 'tile-state', span: 'full', title: t('state.errorTitle'), icon: 'warning-circle' });
    body.append(el('p', { text: t('state.errorText') }),
      el('button', { class: 'btn btn-primary', attrs: { type: 'button' }, on: { click: () => app.reload() } }, icon('arrows-clockwise'), el('span', { text: t('common.retry') })));
    return tile;
  }
  if (!app.files.length) {
    const { tile, body } = makeTile('state', { className: 'tile-state', span: 'full', title: t('state.emptyTitle'), icon: 'folder' });
    body.append(el('p', { text: t('state.emptyText') }));
    return tile;
  }
  return null;
}

function buildNoResults(app) {
  const { tile, body } = makeTile('no-results', { className: 'tile-state', span: 'full', title: t('state.noResultsTitle'), icon: 'magnifying-glass' });
  body.append(el('p', { text: t('state.noResultsText') }),
    el('button', { class: 'btn', attrs: { type: 'button' }, on: { click: () => app.clearFilters() } }, icon('x'), el('span', { text: t('search.clearAll') })));
  tile.hidden = true;
  return tile;
}

/* ------------------------------------------------------------------ build */

export function buildGrid(app) {
  const grid = app.dom.grid;
  app.rows.clear();
  const defs = [
    { id: 'hero', order: 10, build: buildHero },
    { id: 'stats', order: 20, build: buildStats },
    { id: 'search', order: 40, build: buildSearch },
    { id: 'state', order: 50, build: buildState },
    { id: 'no-results', order: 60, build: buildNoResults },
  ];
  if (app.flag('newest')) defs.push({ id: 'newest', order: 300, build: buildNewest });
  app.subjects.forEach((s, i) => defs.push({ id: 'subject:' + s.key, order: 100 + i * 0.01, build: () => buildSubjectTile(app, s, i) }));
  for (const d of app.hooks.tiles) defs.push(d);
  defs.sort((a, b) => (a.order || 0) - (b.order || 0));

  const frag = document.createDocumentFragment();
  for (const d of defs) {
    try {
      const node = d.build(app);
      if (!node) continue;
      if (!node.dataset.tile) node.dataset.tile = d.id;
      if (d.span && !node._spanSet) node._span = d.span;
      if (node._span == null) node._span = 1;
      frag.append(node);
    } catch (err) {
      console.warn('[LNH] tile "' + d.id + '" failed and was hidden:', err);
    }
  }
  grid.textContent = '';
  grid.removeAttribute('aria-busy');
  grid.append(frag);
  app._filterSig = null;
  applyFilters(app, { animate: false });
}

/* ------------------------------------------------------- filter and sort */

function sortFiles(app, files) {
  const c = collator();
  const by = app.flag('sort') ? app.state.sort : 'lesson';
  const title = (a, b) => c.compare(a.title, b.title);
  const arr = files.slice();
  if (by === 'newest') arr.sort((a, b) => (b.ts - a.ts) || title(a, b));
  else if (by === 'oldest') arr.sort((a, b) => ((a.ts || 9e15) - (b.ts || 9e15)) || title(a, b));
  else if (by === 'az') arr.sort(title);
  else arr.sort((a, b) => ((a.lesson == null ? 9e9 : a.lesson) - (b.lesson == null ? 9e9 : b.lesson)) || title(a, b));
  return arr;
}

export function filtersActive(app) {
  const st = app.state;
  return normalizeText(st.query).length > 0 || st.subject != null || st.types.size > 0 ||
    app.hooks.filters.some((f) => { try { return f.active(); } catch { return false; } });
}

export function applyFilters(app, opts) {
  const grid = app.dom.grid;
  const st = app.state;
  const animate = !(opts && opts.animate === false) && motionOK();
  const terms = normalizeText(st.query).split(' ').filter(Boolean);
  const hookFilters = app.hooks.filters.filter((f) => { try { return f.active(); } catch { return false; } });
  const active = terms.length > 0 || st.subject != null || st.types.size > 0 || hookFilters.length > 0;
  const sig = JSON.stringify([terms, st.subject, Array.from(st.types), hookFilters.map((f) => f.id)]);
  const sigChanged = sig !== app._filterSig;
  app._filterSig = sig;
  const first = animate ? snapshot(grid) : null;

  let total = 0;
  for (const tile of grid.querySelectorAll('.tile-subject')) {
    const s = tile._subject;
    const list = tile._list;
    if (!s || !list) continue;
    const sorted = sortFiles(app, s.files);
    let shown = 0;
    let pos = 0;
    for (const f of sorted) {
      const row = app.rows.get(f.path);
      if (!row) continue;
      if (list.children[pos] !== row) list.insertBefore(row, list.children[pos] || null);
      pos += 1;
      let ok = (st.subject == null || st.subject === s.key) &&
        (st.types.size === 0 || st.types.has(f.kind)) &&
        terms.every((term) => f.search.includes(term));
      if (ok) for (const hf of hookFilters) { try { if (!hf.test(f)) { ok = false; break; } } catch { /* ignore */ } }
      row.hidden = !ok;
      if (ok) {
        shown += 1;
        row.classList.toggle('over-limit', !active && !tile._showAll && shown > ROW_LIMIT);
      }
    }
    tile.hidden = shown === 0;
    tile._shown = shown;
    const hiddenRows = !active && !tile._showAll && shown > ROW_LIMIT;
    tile._more.hidden = !hiddenRows;
    if (hiddenRows) tile._more.textContent = t('subject.showAll', { n: fmtNum(shown) });
    tile._count.textContent = active && shown !== s.files.length
      ? t('subject.countOf', { n: fmtNum(shown), total: fmtNum(s.files.length) })
      : plural('files.count', s.files.length);
    if (sigChanged) {
      if (active && shown > 0 && tile.classList.contains('collapsed')) tile.classList.add('force-open');
      if (!active) tile.classList.remove('force-open');
      syncExpanded(tile);
    }
    total += shown;
  }

  const none = grid.querySelector('[data-tile="no-results"]');
  if (none) none.hidden = !(app.files.length > 0 && total === 0);
  const search = grid.querySelector('[data-tile="search"]');
  if (search) {
    search.classList.toggle('has-filters', st.subject != null || st.types.size > 0 || hookFilters.length > 0);
    if (search._resultCount) search._resultCount.textContent = active ? plural('search.results', total) : '';
  }

  app.emit('filtered', { active, total });
  layoutGrid(app);
  if (first) flip(grid, first);
}

/* ---------------------------------------------------------------- layout */

function columns(grid) {
  try {
    const n = parseInt(getComputedStyle(grid).getPropertyValue('--cols'), 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
  } catch { return 1; }
}

/** Give every tile a column span so each grid row is completely filled. */
export function layoutGrid(app) {
  const grid = app.dom.grid;
  const n = columns(grid);
  const tiles = Array.from(grid.children).filter((c) => !c.hidden);
  if (n <= 1) { tiles.forEach((tl) => { tl.style.gridColumn = ''; }); return; }
  let row = [];
  let used = 0;
  const flush = () => {
    if (!row.length) return;
    // spare columns go to the tile with the most content (ties: the later one)
    let rem = n - used;
    while (rem > 0) {
      let best = row[0];
      for (const r of row) if (r.weight / r.span >= best.weight / best.span) best = r;
      best.span += 1;
      rem -= 1;
    }
    for (const r of row) r.tile.style.gridColumn = 'span ' + r.span;
    row = [];
    used = 0;
  };
  for (const tile of tiles) {
    const want = tile._spanFor ? tile._spanFor(n) : tile._span;
    const pref = want === 'full' ? n : Math.min(Number(want) || 1, n);
    const weight = tile._subject ? 2 + (tile._shown || 0) : tile.dataset.tile === 'hero' ? 40 : tile.dataset.tile === 'glossary' ? 6 : 1;
    if (used + pref > n) flush();
    row.push({ tile, span: pref, weight });
    used += pref;
    if (used >= n) flush();
  }
  flush();
}

let layoutTimer = 0;
export function requestLayout(app) {
  clearTimeout(layoutTimer);
  layoutTimer = setTimeout(() => { try { layoutGrid(app); } catch (err) { console.warn('[LNH] layout:', err); } }, 30);
}

function snapshot(grid) {
  const map = new Map();
  for (const tl of grid.children) if (!tl.hidden) map.set(tl, tl.getBoundingClientRect());
  return map;
}

function flip(grid, first) {
  if (typeof Element.prototype.animate !== 'function') return;
  const vh = window.innerHeight || 800;
  for (const tl of grid.children) {
    if (tl.hidden) continue;
    const a = first.get(tl);
    const b = tl.getBoundingClientRect();
    if (b.bottom < -200 || b.top > vh + 200) { if (!a || a.bottom < -200 || a.top > vh + 200) continue; }
    try {
      if (!a) {
        tl.animate([{ opacity: 0, transform: 'scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'ease-out' });
        continue;
      }
      const dx = a.left - b.left;
      const dy = a.top - b.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      tl.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'none' }],
        { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' });
    } catch { /* ignore */ }
  }
}

/* ---------------------------------------------------------------- reveal */

/** Scroll to a file's row, open its tile and highlight it. Returns the row (or null). */
export function revealFile(app, path, opts) {
  let row = app.rows.get(path);
  if (!row) return null;
  let tile = row.closest('.tile-subject');
  if (row.hidden || (tile && tile.hidden)) {
    app.clearFilters();
    row = app.rows.get(path);
    if (!row) return null;
    tile = row.closest('.tile-subject');
  }
  if (tile) {
    if (row.classList.contains('over-limit')) { tile._showAll = true; applyFilters(app, { animate: false }); }
    if (!isOpen(tile)) { setOpen(tile, true); layoutGrid(app); }
  }
  try {
    row.scrollIntoView({ block: 'center', behavior: motionOK() && !(opts && opts.instant) ? 'smooth' : 'auto' });
  } catch { try { row.scrollIntoView(); } catch { /* ignore */ } }
  row.classList.remove('flash');
  void row.offsetWidth;
  row.classList.add('flash');
  setTimeout(() => row.classList.remove('flash'), 2600);
  if (!(opts && opts.focus === false)) {
    try { row.querySelector('.file-main').focus({ preventScroll: true }); } catch { /* ignore */ }
  }
  return row;
}

export function watchResize(app) {
  const onResize = debounce(() => { try { layoutGrid(app); app.emit('resize'); } catch (err) { console.warn('[LNH] resize:', err); } }, 120);
  window.addEventListener('resize', onResize, { passive: true });
  window.addEventListener('orientationchange', onResize, { passive: true });
}
