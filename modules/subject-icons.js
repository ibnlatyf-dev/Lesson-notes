// F13 — Subject cover icons, picked by keywords in the subject name.
// Overrides: data/subjects.json  ->  { "Subject name": { "icon": "scales" } }
import { normalizeText } from './parser.js';
import { hasIcon } from './icons.js';

const RULES = [
  [['تفسير', 'tafsir', 'tafseer'], 'book-bookmark'],
  [['قرآن', 'قران', 'تجويد', 'quran', 'qur', 'tajweed', 'tajwid'], 'book-open-text'],
  [['توحيد', 'عقيدة', 'tawheed', 'tawhid', 'aqeedah', 'aqidah', 'creed'], 'star-and-crescent'],
  [['فقه', 'fiqh', 'jurisprudence'], 'scales'],
  [['حديث', 'مصطلح', 'hadith', 'hadeeth'], 'scroll'],
  [['لغة', 'نحو', 'صرف', 'بلاغة', 'أدب', 'arabic', 'grammar', 'nahw', 'language', 'balagh'], 'pen-nib'],
  [['قضاء', 'قضائي', 'مرافعات', 'judiciary', 'judicial', 'court', 'qada'], 'gavel'],
  [['نظام', 'أنظمة', 'قانون', 'law', 'legal', 'regulation', 'system'], 'bank'],
  [['سيرة', 'تاريخ', 'seerah', 'sirah', 'history'], 'path'],
  [['اختبار', 'exam', 'test'], 'exam'],
].map(([words, icon]) => [words.map(normalizeText), icon]);

export function iconForSubject(name) {
  const n = normalizeText(name);
  if (!n) return 'folder';
  for (const [words, icon] of RULES) if (words.some((w) => n.includes(w))) return icon;
  return 'book';
}

export function init(app) {
  app.subjectIcon = (subject) => {
    const meta = app.subjectMeta[subject.key];
    if (meta && meta.icon && hasIcon(meta.icon)) return meta.icon;
    return iconForSubject(subject.name);
  };
}
