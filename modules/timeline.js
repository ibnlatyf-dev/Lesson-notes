// F14 — Lesson timeline inside a subject tile: Lesson 1, 2, 3… with the latest highlighted.
// Tapping a number scrolls to that lesson's files. Only shown with 3 or more lessons.
import { el } from './util.js';
import { t, fmtNum } from './i18n.js';

export function init(app) {
  app.hook('subjectTop', {
    order: 10,
    build(subject) {
      const byLesson = new Map();
      for (const f of subject.files) {
        if (f.lesson == null) continue;
        if (!byLesson.has(f.lesson)) byLesson.set(f.lesson, []);
        byLesson.get(f.lesson).push(f);
      }
      if (byLesson.size < 3) return null;
      const lessons = Array.from(byLesson.keys()).sort((a, b) => a - b);
      // "latest" = the lesson of the most recently added file (or the highest number if dates are unknown)
      const dated = subject.files.filter((f) => f.lesson != null && f.ts);
      const latest = dated.length ? dated.reduce((m, f) => (f.ts > m.ts ? f : m)).lesson : lessons[lessons.length - 1];

      const list = el('ol', { class: 'timeline-list' });
      for (const n of lessons) {
        const isLatest = n === latest;
        const btn = el('button', {
          class: 'timeline-dot' + (isLatest ? ' is-latest' : ''),
          text: fmtNum(n, { useGrouping: false }),
          attrs: {
            type: 'button',
            'aria-label': t(isLatest ? 'timeline.gotoLatest' : 'timeline.goto', { n: fmtNum(n, { useGrouping: false }) }),
            'aria-current': isLatest ? 'true' : null,
          },
          on: { click: () => app.reveal(byLesson.get(n)[0].path) },
        });
        list.append(el('li', null, btn));
      }
      return el('nav', { class: 'timeline', attrs: { 'aria-label': t('timeline.label') } },
        el('span', { class: 'timeline-label', text: t('timeline.label') }), list);
    },
  });
}
