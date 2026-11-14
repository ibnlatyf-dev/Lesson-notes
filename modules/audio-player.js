// F10 — Audio lessons: an inline glass player under the file row.
// play/pause, seek bar, skip ±10 s, speed, one audio at a time, position remembered per file.
// preload="none": nothing is downloaded until Play is pressed.
import { el, iconButton, fileUrl } from './util.js';
import { icon } from './icons.js';
import { t } from './i18n.js';

const RATES = [1, 1.25, 1.5, 2, 0.75];

function clock(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '--:--';
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? h + ':' + String(m).padStart(2, '0') + ':' + ss : m + ':' + ss;
}

export function init(app) {
  if (typeof Audio !== 'function') return;
  let current = null;
  let positions = app.store.local.get('audioPos', {});
  if (!positions || typeof positions !== 'object' || Array.isArray(positions)) positions = {};

  const savePos = (path, sec) => {
    if (!Number.isFinite(sec)) return;
    positions[path] = Math.floor(sec);
    const keys = Object.keys(positions);
    if (keys.length > 60) delete positions[keys[0]];
    app.store.local.set('audioPos', positions);
  };

  function close() {
    if (!current) return;
    const c = current;
    current = null;
    try {
      savePos(c.file.path, c.audio.currentTime);
      c.audio.pause();
      c.audio.removeAttribute('src');
      c.audio.load();
    } catch { /* ignore */ }
    c.node.remove();
    if (c.row) c.row.classList.remove('is-playing');
  }

  function openPlayer(file, row) {
    if (current && current.file.path === file.path) { close(); return; }
    close();
    const audio = new Audio();
    audio.preload = 'none';
    audio.src = fileUrl(file);
    let rate = Number(app.store.local.get('audioRate', 1));
    if (!RATES.includes(rate)) rate = 1;
    let lastSave = 0;
    let dragging = false;
    let wantSeek = Number(positions[file.path]) || 0;

    const playBtn = iconButton(icon('play'), t('audio.play'), () => {
      if (audio.paused) {
        const p = audio.play();
        if (p && p.catch) p.catch(() => app.toast(t('audio.error'), { type: 'error', id: 'audio-error' }));
      } else audio.pause();
    }, 'player-play');
    const setPlayIcon = () => {
      const playing = !audio.paused && !audio.ended;
      playBtn.textContent = '';
      playBtn.append(icon(playing ? 'pause' : 'play'));
      const label = playing ? t('audio.pause') : t('audio.play');
      playBtn.setAttribute('aria-label', label);
      playBtn.title = label;
    };
    const skip = (d) => {
      try {
        const dur = Number.isFinite(audio.duration) ? audio.duration : Infinity;
        const next = Math.max(0, Math.min(dur, (audio.currentTime || 0) + d));
        if (Number.isFinite(audio.duration)) audio.currentTime = next; else wantSeek = Math.max(0, wantSeek + d);
      } catch { /* ignore */ }
    };
    const back = iconButton(icon('arrow-counter-clockwise'), t('audio.back'), () => skip(-10));
    const fwd = iconButton(icon('arrow-clockwise'), t('audio.forward'), () => skip(10));
    const cur = el('span', { class: 'player-time', text: clock(wantSeek), attrs: { dir: 'ltr' } });
    const dur = el('span', { class: 'player-time', text: '--:--', attrs: { dir: 'ltr' } });
    const seek = el('input', { class: 'player-seek', attrs: { type: 'range', min: '0', max: '1000', step: '1', value: '0', 'aria-label': t('audio.seek') } });
    const rateBtn = el('button', { class: 'chip player-rate', attrs: { type: 'button', dir: 'ltr' } });
    const setRate = () => {
      audio.playbackRate = rate;
      audio.defaultPlaybackRate = rate;
      rateBtn.textContent = rate + '×';
      rateBtn.setAttribute('aria-label', t('audio.speed', { n: String(rate) }));
    };
    rateBtn.addEventListener('click', () => {
      rate = RATES[(RATES.indexOf(rate) + 1) % RATES.length];
      app.store.local.set('audioRate', rate);
      setRate();
    });
    const closeBtn = iconButton(icon('x'), t('common.close'), close);

    seek.addEventListener('input', () => {
      dragging = true;
      if (Number.isFinite(audio.duration)) cur.textContent = clock((Number(seek.value) / 1000) * audio.duration);
    });
    seek.addEventListener('change', () => {
      dragging = false;
      try { if (Number.isFinite(audio.duration)) audio.currentTime = (Number(seek.value) / 1000) * audio.duration; } catch { /* ignore */ }
    });
    audio.addEventListener('loadedmetadata', () => {
      dur.textContent = clock(audio.duration);
      try { if (wantSeek > 0 && wantSeek < audio.duration - 3) audio.currentTime = wantSeek; } catch { /* ignore */ }
      wantSeek = 0;
    });
    audio.addEventListener('timeupdate', () => {
      if (!dragging) {
        cur.textContent = clock(audio.currentTime);
        if (Number.isFinite(audio.duration) && audio.duration > 0) seek.value = String(Math.round((audio.currentTime / audio.duration) * 1000));
      }
      const now = Date.now();
      if (now - lastSave > 5000) { lastSave = now; savePos(file.path, audio.currentTime); }
    });
    audio.addEventListener('play', () => { setRate(); setPlayIcon(); });
    audio.addEventListener('pause', () => { setPlayIcon(); savePos(file.path, audio.currentTime); });
    audio.addEventListener('ended', () => { setPlayIcon(); savePos(file.path, 0); });
    audio.addEventListener('error', () => { if (audio.getAttribute('src')) app.toast(t('audio.error'), { type: 'error', id: 'audio-error' }); });

    const node = el('div', { class: 'player', attrs: { role: 'group', 'aria-label': t('audio.player', { name: file.title }) } },
      el('div', { class: 'player-controls' }, back, playBtn, fwd, rateBtn, closeBtn),
      el('div', { class: 'player-bar' }, cur, seek, dur));
    setRate();
    const slot = row.querySelector('.file-slot') || row;
    slot.append(node);
    row.classList.add('is-playing');
    current = { file, audio, node, row };
    try { playBtn.focus({ preventScroll: true }); } catch { /* ignore */ }
  }

  app.hook('openers', {
    order: 10,
    open(file, row) {
      if (file.kind !== 'audio') return false;
      const target = row || app.reveal(file.path, { focus: false });
      if (!target) return false;
      openPlayer(file, target);
      return true;
    },
  });

  app.on('rebuilt', close);
  window.addEventListener('pagehide', () => { if (current) savePos(current.file.path, current.audio.currentTime); });
  app.audio = { close, isOpen: () => !!current };
}
