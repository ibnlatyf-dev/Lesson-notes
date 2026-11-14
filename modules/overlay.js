// One overlay manager for every dialog, sheet and popover:
// Esc, tap-outside, focus trap, focus return, scroll lock, optional Back-button close.
import { el } from './util.js';
import { t } from './i18n.js';
import { icon } from './icons.js';

const stack = [];
let lockCount = 0;
let historyDepth = 0;
let ignorePops = 0;

export function lockScroll() {
  lockCount += 1;
  if (lockCount === 1) document.documentElement.classList.add('scroll-locked');
}

export function unlockScroll() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) document.documentElement.classList.remove('scroll-locked');
}

export function isScrollLocked() { return lockCount > 0; }
export function openOverlayCount() { return stack.length; }
export function topOverlay() { return stack[stack.length - 1] || null; }

function focusables(root) {
  return Array.from(root.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, iframe, audio[controls], [tabindex]:not([tabindex="-1"])'
  )).filter((n) => !n.hidden && n.getClientRects().length > 0);
}

function onKeydown(e) {
  const top = topOverlay();
  if (!top) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    top.close();
    return;
  }
  if (e.key === 'Tab') {
    const items = focusables(top.root);
    if (!items.length) { e.preventDefault(); top.panel.focus(); return; }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (!top.root.contains(active)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
  }
}

function onPopState() {
  if (ignorePops > 0) { ignorePops -= 1; return; }
  // Back button: close the top overlay that asked for history support.
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    if (stack[i].usesHistory) {
      stack[i].historyHandled = true;
      historyDepth = Math.max(0, historyDepth - 1);
      stack[i].close();
      return;
    }
  }
}

let wired = false;
function wire() {
  if (wired) return;
  wired = true;
  document.addEventListener('keydown', onKeydown, true);
  window.addEventListener('popstate', onPopState);
}

/**
 * openOverlay({ label, className, build(panel, api), onClose, useHistory, closeButton, lock })
 * Returns { close(), root, panel }.
 */
export function openOverlay(opts) {
  wire();
  const o = opts || {};
  const returnTo = o.returnFocus || document.activeElement;
  const panel = el('div', { class: 'overlay-panel glass ' + (o.panelClass || ''), attrs: { tabindex: '-1' } });
  const root = el('div', {
    class: 'overlay ' + (o.className || ''),
    attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': o.label || '' },
  }, panel);

  const entry = { root, panel, usesHistory: false, historyHandled: false, closed: false, close };

  function close() {
    if (entry.closed) return;
    entry.closed = true;
    const i = stack.indexOf(entry);
    if (i >= 0) stack.splice(i, 1);
    if (o.lock !== false) unlockScroll();
    try { if (o.onClose) o.onClose(); } catch (err) { console.warn('[LNH] overlay onClose:', err); }
    root.classList.add('closing');
    const remove = () => { if (root.parentNode) root.remove(); };
    const animated = !document.documentElement.classList.contains('reading');
    if (animated) setTimeout(remove, 170); else remove();
    if (entry.usesHistory && !entry.historyHandled) {
      entry.historyHandled = true;
      historyDepth = Math.max(0, historyDepth - 1);
      try { ignorePops += 1; history.back(); } catch { ignorePops = Math.max(0, ignorePops - 1); }
    }
    try {
      if (returnTo && typeof returnTo.focus === 'function' && document.contains(returnTo)) returnTo.focus({ preventScroll: true });
    } catch { /* ignore */ }
  }

  root.addEventListener('mousedown', (e) => { entry.downOnBackdrop = e.target === root; });
  root.addEventListener('click', (e) => {
    if (e.target === root && entry.downOnBackdrop !== false && o.closeOnOutside !== false) close();
  });

  try {
    if (o.closeButton !== false) {
      panel.append(el('button', {
        class: 'icon-btn overlay-close',
        attrs: { type: 'button', 'aria-label': t('common.close'), title: t('common.close') },
        on: { click: close },
      }, icon('x')));
    }
    if (o.build) o.build(panel, entry);
  } catch (err) {
    console.warn('[LNH] overlay build failed:', err);
    return { close() {}, root, panel, failed: true };
  }

  if (o.lock !== false) lockScroll();
  stack.push(entry);
  (o.mount || document.body).append(root);

  if (o.useHistory) {
    try {
      history.pushState({ lnhOverlay: true }, '');
      historyDepth += 1;
      entry.usesHistory = true;
    } catch { entry.usesHistory = false; }
  }

  try {
    const target = (o.initialFocus && panel.querySelector(o.initialFocus)) || panel;
    target.focus({ preventScroll: true });
  } catch { /* ignore */ }

  return entry;
}

export function closeAllOverlays() {
  for (const entry of stack.slice().reverse()) entry.close();
}
