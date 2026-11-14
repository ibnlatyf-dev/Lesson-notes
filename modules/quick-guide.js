// F34 — Quick Guide: ONE screen that labels the page ("this is that"). Not a tutorial:
// no steps, no tasks. Opens once on the first visit and any time from Help.
// Safety: scroll is always restored, there is always a way out, and any error removes it.
import { el, mq } from './util.js';
import { icon } from './icons.js';
import { t, fmtNum } from './i18n.js';
import { openOverlay } from './overlay.js';

const SEEN_KEY = 'guideSeen';
const HINT_KEY = 'guideHint';

export function init(app) {
  const version = Number(app.config.quickGuideVersion) > 0 ? Number(app.config.quickGuideVersion) : 1;
  let current = null;

  // What the guide points at. A line is dropped when its element does not exist.
  const lines = () => [
    { sel: '.island', key: 'guide.nav' },
    { sel: '[data-tile="search"]', key: 'guide.search' },
    { sel: '.tile-subject:not([hidden])', key: 'guide.subjects' },
    { sel: '.tile-subject:not([hidden]) .file-row:not([hidden]) .file-actions', key: 'guide.buttons' },
    { sel: '[data-tile="newest"], .notice-new', key: 'guide.newest' },
    { when: () => !!(app.pwa && app.pwa.canInstall()), key: 'guide.install' },
  ].filter((l) => {
    try { return l.when ? l.when() : !!document.querySelector(l.sel); } catch { return false; }
  });

  function open() {
    if (current) return true;
    let prevScroll = 0;
    let layer = null;
    let legend = null;
    const offs = [];
    try {
      prevScroll = window.scrollY || 0;
      window.scrollTo(0, 0);
    } catch { /* ignore */ }

    const place = () => {
      if (!layer || !legend) return;
      try {
        layer.textContent = '';
        const items = legend._items || [];
        if (mq('(max-width: 699px)') || (window.innerHeight || 0) < 480) return; // small screens: legend only
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const lr = legend.getBoundingClientRect();
        const rtl = document.documentElement.dir === 'rtl';
        items.forEach((item, i) => {
          if (!item.sel) return;
          const target = document.querySelector(item.sel);
          if (!target) return;
          const r = target.getBoundingClientRect();
          if (r.width < 2 || r.height < 2 || r.bottom < 8 || r.top > vh - 24 || r.right < 8 || r.left > vw - 8) return;
          const size = 34;
          let x = rtl ? r.right - size + 10 : r.left - 10;
          let y = r.top - 12;
          x = Math.min(vw - size - 6, Math.max(6, x));
          y = Math.min(vh - size - 6, Math.max(6, y));
          const overlaps = !(x + size < lr.left || x > lr.right || y + size < lr.top || y > lr.bottom);
          if (overlaps) return;
          const ringBox = el('span', { class: 'guide-ring' });
          const top = Math.max(4, r.top - 4);
          ringBox.style.left = Math.max(4, r.left - 4) + 'px';
          ringBox.style.top = top + 'px';
          ringBox.style.width = Math.min(vw - 8, r.width + 8) + 'px';
          ringBox.style.height = Math.max(0, Math.min(vh - 4, r.bottom + 4) - top) + 'px';
          const badge = el('span', { class: 'guide-badge', text: fmtNum(i + 1), attrs: { 'aria-hidden': 'true' } });
          badge.style.left = x + 'px';
          badge.style.top = y + 'px';
          badge.style.setProperty('--i', String(i));
          layer.append(ringBox, badge);
        });
      } catch (err) {
        // positioning failed: keep the legend card alone
        try { layer.textContent = ''; } catch { /* ignore */ }
      }
    };

    const fill = () => {
      if (!legend) return;
      const items = lines();
      legend._items = items;
      const body = legend.querySelector('.guide-body');
      const active = document.activeElement;
      const refocus = active && legend.contains(active) ? (active.classList.contains('guide-ok') ? '.guide-ok' : '.guide-lang') : '';
      body.textContent = '';
      const list = el('ol', { class: 'guide-list' });
      items.forEach((item, i) => {
        const li = el('li', null, el('span', { class: 'guide-num', text: fmtNum(i + 1), attrs: { 'aria-hidden': 'true' } }), el('span', { text: t(item.key) }));
        li.style.setProperty('--i', String(i));
        list.append(li);
      });
      const langBtn = el('button', {
        class: 'btn guide-lang', attrs: { type: 'button', 'aria-label': t('nav.lang') },
        on: { click: () => app.toggleLang() },
      }, icon('translate'), el('span', { text: t('nav.langName') }));
      const ok = el('button', {
        class: 'btn btn-primary guide-ok', attrs: { type: 'button' },
        on: { click: () => close() },
      }, icon('check'), el('span', { text: t('guide.gotIt') }));
      body.append(
        el('h2', { class: 'panel-title', text: t('guide.title') }),
        el('p', { class: 'panel-sub', text: t('guide.sub') }),
        list,
        el('div', { class: 'btn-row guide-actions' }, ok, langBtn));
      const dialog = legend.closest('[role="dialog"]');
      if (dialog) dialog.setAttribute('aria-label', t('guide.title'));
      if (refocus) { const again = legend.querySelector(refocus); if (again) again.focus({ preventScroll: true }); }
    };

    const refresh = () => {
      if (!current) return;
      try { fill(); requestAnimationFrame(place); } catch (err) { console.warn('[LNH] quick guide refresh failed:', err); close(); }
    };

    function close() {
      if (current) current.entry.close();
    }

    const entry = openOverlay({
      label: t('guide.title'),
      className: 'guide',
      panelClass: 'guide-legend',
      closeButton: false,
      onClose() {
        current = null;
        document.documentElement.classList.remove('guide-open');
        for (const off of offs) { try { off(); } catch { /* ignore */ } }
        window.removeEventListener('resize', onResize);
        window.removeEventListener('orientationchange', onResize);
        try { window.scrollTo(0, prevScroll); } catch { /* ignore */ }
        const first = !app.store.local.get(HINT_KEY, false);
        app.store.local.set(SEEN_KEY, version);
        if (first) {
          app.store.local.set(HINT_KEY, true);
          setTimeout(() => {
            app.toast(t('guide.hint'), { id: 'guide-hint', className: 'toast-hint', icon: 'arrow-right', duration: 6000 });
          }, 250);
        }
      },
      build(panel) {
        legend = panel;
        panel.append(el('div', { class: 'guide-body' }));
        fill();
      },
    });
    if (entry.failed) {
      try { window.scrollTo(0, prevScroll); } catch { /* ignore */ }
      return false;
    }
    let resizeTimer = 0;
    function onResize() { clearTimeout(resizeTimer); resizeTimer = setTimeout(refresh, 120); }

    try {
      layer = el('div', { class: 'guide-layer', attrs: { 'aria-hidden': 'true' } });
      entry.root.prepend(layer);
      current = { entry };
      document.documentElement.classList.add('guide-open');
      window.addEventListener('resize', onResize, { passive: true });
      window.addEventListener('orientationchange', onResize, { passive: true });
      offs.push(app.on('rebuilt', refresh), app.on('theme', refresh), app.on('installable', refresh), app.on('resize', refresh));
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh).catch(() => {});
      requestAnimationFrame(place);
      const okBtn = legend.querySelector('.guide-ok');
      if (okBtn) okBtn.focus({ preventScroll: true });
    } catch (err) {
      console.warn('[LNH] quick guide failed and was removed:', err);
      current = { entry };
      close();
      return false;
    }
    return true;
  }

  const api = {
    open() { try { return open(); } catch (err) { console.warn('[LNH] quick guide failed:', err); if (current) current.entry.close(); return false; } },
    close() { if (current) current.entry.close(); },
    isOpen: () => !!current,
    seen: () => Number(app.store.local.get(SEEN_KEY, 0)) >= version,
  };
  app.quickGuide = api;

  // First visit (per device): show once the page is drawn.
  app.on('ready', () => {
    if (api.seen()) return;
    if (app.config.quickGuideAuto === false) return;
    setTimeout(() => {
      if (api.seen() || api.isOpen() || document.querySelector('.overlay')) return;
      api.open();
    }, 700);
  });
}
