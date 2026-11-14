// Small glass toasts. Text only (never HTML).
import { el } from './util.js';
import { icon } from './icons.js';
import { t } from './i18n.js';

let holder = null;
const live = new Map();

function getHolder() {
  if (holder && document.contains(holder)) return holder;
  holder = document.getElementById('toasts');
  if (!holder) {
    holder = el('div', { id: 'toasts', class: 'toasts', attrs: { 'aria-live': 'polite', role: 'status' } });
    document.body.append(holder);
  }
  return holder;
}

const ICONS = { info: 'info', success: 'check-circle', warn: 'warning-circle', error: 'warning-circle' };

/**
 * toast('Saved', { type:'success', duration:4000, id:'x', actions:[{label, onClick, primary}] })
 * Returns { close() }.
 */
export function toast(message, opts) {
  const o = opts || {};
  try {
    if (o.id && live.has(o.id)) live.get(o.id).close();
    const type = ICONS[o.type] ? o.type : 'info';
    const node = el('div', { class: 'toast glass toast-' + type + (o.className ? ' ' + o.className : '') });
    node.append(el('span', { class: 'toast-icon' }, icon(o.icon || ICONS[type])));
    node.append(el('span', { class: 'toast-text', text: message }));
    let timer = 0;
    const api = {
      close() {
        clearTimeout(timer);
        if (o.id && live.get(o.id) === api) live.delete(o.id);
        node.classList.add('leaving');
        setTimeout(() => node.remove(), document.documentElement.classList.contains('reading') ? 0 : 200);
      },
    };
    if (Array.isArray(o.actions) && o.actions.length) {
      const row = el('span', { class: 'toast-actions' });
      for (const a of o.actions) {
        row.append(el('button', {
          class: 'btn btn-small' + (a.primary ? ' btn-primary' : ''),
          text: a.label,
          attrs: { type: 'button' },
          on: { click: () => { try { if (a.onClick) a.onClick(); } finally { api.close(); } } },
        }));
      }
      node.append(row);
    }
    if (o.closable !== false) {
      node.append(el('button', {
        class: 'icon-btn toast-close',
        attrs: { type: 'button', 'aria-label': t('common.close') },
        on: { click: () => api.close() },
      }, icon('x')));
    }
    getHolder().append(node);
    const duration = o.duration === 0 ? 0 : o.duration || 4500;
    if (duration) timer = setTimeout(() => api.close(), duration);
    if (o.id) live.set(o.id, api);
    return api;
  } catch (err) {
    console.warn('[LNH] toast failed:', err);
    return { close() {} };
  }
}
