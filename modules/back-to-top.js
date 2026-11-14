// A small glass "back to top" button, stacked above the floating "?" (they never overlap).
import { motionOK } from './util.js';

export function init(app) {
  const btn = document.getElementById('btn-top');
  if (!btn) return;
  let ticking = false;
  const update = () => { ticking = false; btn.hidden = (window.scrollY || 0) < 600; };
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  btn.addEventListener('click', () => {
    try { window.scrollTo({ top: 0, behavior: motionOK() ? 'smooth' : 'auto' }); } catch { window.scrollTo(0, 0); }
    app.sweep('jump');
  });
  update();
}
