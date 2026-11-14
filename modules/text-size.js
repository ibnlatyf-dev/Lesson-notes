// F20 — Text size control: A- / A+ (4 steps, 90% to 140%), remembered on this device.
import { t, fmtNum } from './i18n.js';
import { vibrate } from './util.js';

export const STEPS = [0.9, 1, 1.2, 1.4];

export function init(app) {
  const root = document.documentElement;
  const group = document.getElementById('text-size');
  const minus = document.getElementById('btn-text-minus');
  const plus = document.getElementById('btn-text-plus');
  let step = app.store.local.get('textStep', 1);
  if (typeof step !== 'number' || !STEPS[step]) step = 1;

  const apply = (save) => {
    root.style.setProperty('--text-scale', String(STEPS[step]));
    if (minus) minus.disabled = step <= 0;
    if (plus) plus.disabled = step >= STEPS.length - 1;
    if (save) app.store.local.set('textStep', step);
    app.emit('resize');
  };
  const change = (d) => {
    const next = Math.min(STEPS.length - 1, Math.max(0, step + d));
    if (next === step) return;
    step = next;
    apply(true);
    vibrate(6);
    app.toast(t('textSize.now', { n: fmtNum(Math.round(STEPS[step] * 100)) }), { id: 'text-size', duration: 1600 });
  };
  if (group) group.hidden = false;
  if (minus) minus.addEventListener('click', () => change(-1));
  if (plus) plus.addEventListener('click', () => change(1));
  app.textSize = { get: () => step, change };
  apply(false);
}
