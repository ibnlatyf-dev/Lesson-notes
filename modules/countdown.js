// F9 — Exam countdown tile. Reads exam.date from config.js.
// Hidden if no date is set, the date is invalid, or it has passed.
import { el, ring, bdi } from './util.js';
import { t, plural, pick, fmtDate, fmtNum } from './i18n.js';
import { makeTile } from './grid.js';

/** 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM' in the visitor's local time -> Date or null. */
export function parseExamDate(value) {
  const m = /^\s*(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{2}))?\s*$/.exec(String(value || ''));
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), m[4] ? Number(m[4]) : 0, m[5] ? Number(m[5]) : 0, 0, 0);
  if (!Number.isFinite(d.getTime()) || d.getMonth() !== Number(m[2]) - 1) return null;
  return d;
}

export function init(app) {
  const exam = app.config.exam || {};
  const date = parseExamDate(exam.date);
  if (!date || date.getTime() <= Date.now()) return;
  let timer = 0;

  app.hook('tiles', {
    id: 'countdown', order: 280,
    build() {
      clearInterval(timer);
      if (date.getTime() <= Date.now()) return null;
      const { tile, body } = makeTile('countdown', { className: 'tile-countdown', title: t('countdown.title'), icon: 'hourglass-medium' });
      const r = ring(84, 3.5);
      const num = el('span', { class: 'count-num' });
      const unit = el('span', { class: 'count-unit' });
      const line = el('p', { class: 'count-line', attrs: { role: 'timer' } });
      const name = pick(exam.name);
      const update = () => {
        const left = date.getTime() - Date.now();
        if (left <= 0) { clearInterval(timer); app.requestRebuild(); return; }
        const days = Math.floor(left / 86400000);
        const hours = Math.floor((left % 86400000) / 3600000);
        num.textContent = fmtNum(days > 0 ? days : hours);
        unit.textContent = days > 0 ? plural('countdown.dayUnit', days) : plural('countdown.hourUnit', hours);
        line.textContent = days > 0
          ? t('countdown.left', { days: plural('countdown.days', days), hours: plural('countdown.hours', hours) })
          : t('countdown.leftHours', { hours: plural('countdown.hours', hours) });
        r.set(1 - Math.min(1, left / (30 * 86400000)));
      };
      update();
      timer = setInterval(update, 60000);
      body.append(
        el('div', { class: 'count-wrap' },
          el('div', { class: 'count-ring' }, r.node, el('div', { class: 'count-center' }, num, unit)),
          el('div', { class: 'count-text' },
            name ? el('p', { class: 'count-name' }, bdi(name)) : null,
            line,
            el('p', { class: 'count-date', text: fmtDate(date, 'long') }))));
      return tile;
    },
  });
}
