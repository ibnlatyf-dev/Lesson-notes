// File-name parser (section 3.4 of the brief).
// "Subject - Lesson title [Tag] [Tag].ext"

export const TAGS = {
  full: ['full', 'كامل'],
  summary: ['summary', 'ملخص'],
  print: ['print', 'طباعة'],
  updated: ['updated', 'محدث', 'محدّث'],
  exam: ['exam', 'اختبار'],
};

const TAG_LOOKUP = new Map();
for (const [id, words] of Object.entries(TAGS)) for (const w of words) TAG_LOOKUP.set(w, id);

const KINDS = {
  pdf: ['pdf'],
  slides: ['ppt', 'pptx', 'pps', 'ppsx', 'odp', 'key'],
  word: ['doc', 'docx', 'odt', 'rtf'],
  image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp'],
  audio: ['mp3', 'm4a', 'ogg', 'wav', 'aac', 'opus', 'oga'],
};
const KIND_LOOKUP = new Map();
for (const [kind, exts] of Object.entries(KINDS)) for (const e of exts) KIND_LOOKUP.set(e, kind);

const EXAM_SUBJECTS = ['exam', 'exams', 'اختبار', 'اختبارات', 'نماذج اختبار', 'نماذج الاختبار', 'نماذج اختبارات'];

/** Arabic-Indic and Persian digits -> Western digits. */
export function toWesternDigits(s) {
  return String(s).replace(/[٠-٩۰-۹]/g, (d) => {
    const c = d.charCodeAt(0);
    return String(c >= 0x06F0 ? c - 0x06F0 : c - 0x0660);
  });
}

/** Lower-case, strip Arabic diacritics/tatweel, unify letter variants — for search and matching. */
export function normalizeText(s) {
  return toWesternDigits(String(s == null ? '' : s))
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}

export function kindOfExt(ext) {
  return KIND_LOOKUP.get(String(ext || '').toLowerCase()) || 'other';
}

export function isExamSubject(subject) {
  return EXAM_SUBJECTS.includes(normalizeTag(subject));
}

function normalizeTag(s) {
  return String(s).toLowerCase().replace(/[ً-ٰٟـ]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * parseFileName('Tawheed - Lesson 3 [Summary].pdf') ->
 * { subject:'Tawheed', title:'Lesson 3', lesson:3, tags:['summary'], ext:'pdf', kind:'pdf' }
 * subject '' means "Other".
 */
export function parseFileName(name) {
  const full = String(name == null ? '' : name).trim();
  let base = full;
  let ext = '';
  const dot = full.lastIndexOf('.');
  if (dot > 0 && dot < full.length - 1 && full.length - dot <= 8 && !/\s/.test(full.slice(dot))) {
    base = full.slice(0, dot);
    ext = full.slice(dot + 1).toLowerCase();
  }

  // Known tags at the end are removed (in any order); the first unknown one stops the scan.
  const tags = [];
  let rest = base.trim();
  for (;;) {
    const m = /\s*\[([^[\]]*)\]\s*$/.exec(rest);
    if (!m) break;
    const id = TAG_LOOKUP.get(normalizeTag(m[1]));
    if (!id) break;
    if (!tags.includes(id)) tags.unshift(id);
    rest = rest.slice(0, m.index);
  }
  rest = rest.trim();

  // Subject = text before the first " - " (a long dash typed by a phone keyboard also counts).
  let subject = '';
  let title = rest;
  const sep = /\s+[-–—]\s+/.exec(rest);
  if (sep && sep.index > 0) {
    subject = rest.slice(0, sep.index).trim();
    title = rest.slice(sep.index + sep[0].length).trim();
  }
  if (!title) { title = subject || base || full; if (title === subject) subject = ''; }

  // Lesson number = first number in the title.
  let lesson = null;
  const num = /\d+/.exec(toWesternDigits(title));
  if (num) {
    const n = parseInt(num[0], 10);
    if (Number.isFinite(n) && n < 100000) lesson = n;
  }

  return { subject, title, lesson, tags, ext, kind: kindOfExt(ext) };
}
