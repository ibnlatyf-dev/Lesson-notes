// F19 — Keyboard shortcuts (laptop). Never fire while typing in a field.
//  /  search · Esc  clear · g then n  newest · t  theme · l  language · ?  help · arrows  move
import { openOverlayCount } from './overlay.js';
import { filtersActive } from './grid.js';
import { motionOK } from './util.js';

export const SHORTCUTS = [
  { keys: ['/'], label: 'keys.search' },
  { keys: ['Esc'], label: 'keys.esc' },
  { keys: ['g', 'n'], label: 'keys.newest' },
  { keys: ['t'], label: 'keys.theme' },
  { keys: ['l'], label: 'keys.lang' },
  { keys: ['?'], label: 'keys.help' },
  { keys: ['↑', '↓'], label: 'keys.files' },
  { keys: ['←', '→'], label: 'keys.tiles' },
];

function isTyping(target) {
  if (!target || !target.tagName) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

function visible(node) {
  if (!node || node.closest('[hidden]')) return false;
  if (node.closest('.collapsed:not(.force-open) .collapse')) return false;
  return node.getClientRects().length > 0;
}

export function init(app) {
  let gAt = 0;
  app.shortcutsList = SHORTCUTS;

  const focusIn = (tile) => {
    const target = tile.querySelector('.file-main, .subject-toggle, button, a[href], input, select, summary');
    if (target && visible(target)) { target.focus(); return true; }
    return false;
  };

  document.addEventListener('keydown', (e) => {
    try {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (openOverlayCount() > 0) return;
      const typing = isTyping(e.target);

      if (e.key === 'Escape') {
        if (typing && e.target.id === 'search-input') {
          if (e.target.value || filtersActive(app)) app.clearFilters();
          const again = document.getElementById('search-input');
          if (again) again.blur();
        } else if (!typing && filtersActive(app)) app.clearFilters();
        return;
      }
      if (typing) return;

      const key = e.key;
      if (key === '/') { e.preventDefault(); app.focusSearch(); return; }
      if (key === '?') { if (app.help) { e.preventDefault(); app.help.open(); } return; }
      const lower = key.length === 1 ? key.toLowerCase() : key;
      if (lower === 'g') { gAt = Date.now(); return; }
      if (lower === 'n' && Date.now() - gAt < 1500) {
        gAt = 0;
        const tile = app.dom.grid.querySelector('[data-tile="newest"]');
        if (tile) {
          e.preventDefault();
          tile.scrollIntoView({ block: 'center', behavior: motionOK() ? 'smooth' : 'auto' });
          const first = tile.querySelector('.file-main');
          if (first) first.focus({ preventScroll: true });
          app.sweep('jump');
        }
        return;
      }
      gAt = 0;
      if (lower === 't') { app.toggleTheme(); return; }
      if (lower === 'l') { app.toggleLang(); return; }

      const grid = app.dom.grid;
      const active = document.activeElement;
      if (!active || !grid.contains(active)) return;

      if (key === 'ArrowDown' || key === 'ArrowUp') {
        const items = Array.from(grid.querySelectorAll('.file-main')).filter(visible);
        if (!items.length) return;
        const i = items.indexOf(active.closest('.file-row, .mini-row') ? active.closest('.file-row, .mini-row').querySelector('.file-main') : active);
        let next;
        if (i === -1) next = items[0];
        else next = items[i + (key === 'ArrowDown' ? 1 : -1)];
        if (next) { e.preventDefault(); next.focus(); }
        return;
      }
      if (key === 'ArrowLeft' || key === 'ArrowRight') {
        const tiles = Array.from(grid.children).filter((tl) => !tl.hidden);
        const cur = active.closest('.tile');
        const i = tiles.indexOf(cur);
        if (i === -1) return;
        const rtl = document.documentElement.dir === 'rtl';
        const step = (key === 'ArrowRight') !== rtl ? 1 : -1;
        for (let j = i + step; j >= 0 && j < tiles.length; j += step) {
          if (focusIn(tiles[j])) { e.preventDefault(); break; }
        }
      }
    } catch (err) { console.warn('[LNH] shortcut failed:', err); }
  });
}
