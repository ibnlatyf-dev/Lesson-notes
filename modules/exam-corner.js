// F27 — Exam prep corner: every file tagged [Exam] / [اختبار] or inside a subject named
// "Exam" / "اختبارات" / "نماذج اختبار". Hidden if there are none. Names are shown as written.
import { el } from './util.js';
import { t } from './i18n.js';
import { makeTile, buildMini } from './grid.js';

export function init(app) {
  app.hook('tiles', {
    id: 'exam', order: 290,
    build() {
      const examSubjects = new Set(app.subjects.filter((s) => s.isExam).map((s) => s.key));
      const files = app.files.filter((f) => f.tags.includes('exam') || examSubjects.has(f.subjectKey));
      if (!files.length) return null;
      files.sort((a, b) => (b.ts - a.ts) || a.title.localeCompare(b.title));
      const { tile, body } = makeTile('exam', { className: 'tile-exam', title: t('exam.title'), icon: 'graduation-cap' });
      body.append(el('p', { class: 'tile-text', text: t('exam.text') }));
      const list = el('ul', { class: 'mini-list mini-scroll' });
      for (const f of files) list.append(buildMini(app, f, { badges: false }));
      body.append(list);
      return tile;
    },
  });
}
