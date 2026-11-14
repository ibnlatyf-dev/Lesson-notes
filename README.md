# Lesson Notes Hub · مركز دروسي

A small, private website for sharing lesson notes with your class.
You upload files into the `files` folder on GitHub; classmates open the link and
search, preview and download. No accounts, no tracking, no ads, no cost.

- Arabic and English (right-to-left and left-to-right), dark and light themes
- Works on phones, tablets and laptops, and offline after the first visit
- Nothing is loaded from other websites: fonts, icons and libraries are all inside this folder

---

## Setup (about 15 minutes, only once)

### 1. Create a GitHub account and turn on two-factor login
1. Go to <https://github.com> and choose **Sign up**.
2. After signing in: your photo (top right) → **Settings** → **Password and authentication** →
   **Enable two-factor authentication**. Follow the steps (an authenticator app is the safest choice)
   and **save the recovery codes** somewhere safe.

### 2. Create a public repo
1. Click **+** (top right) → **New repository**.
2. Name it, for example `lesson-notes`. Choose **Public**. Do not add a README. Click **Create repository**.

Your site address will be `https://YOUR-USERNAME.github.io/lesson-notes/`.

### 3. Upload the project
1. On the new repo page click **uploading an existing file**.
2. Drag **everything inside** this folder into the page (all files and folders, including the
   hidden `.github` folder and `.nojekyll`). Then click **Commit changes**.

> If your computer hides the `.github` folder, turn on "show hidden files", or use
> [GitHub Desktop](https://desktop.github.com), which uploads everything by itself.
> The `.github` folder matters: it contains the robot that builds the file list and publishes the site.

### 4. Enable GitHub Pages
**Settings** → **Pages** → under **Build and deployment**, set **Source** to **GitHub Actions**.

(This site publishes itself with the workflow in `.github/workflows/index.yml`. Choose
"GitHub Actions", not "Deploy from a branch" — otherwise new files would only appear after your *next* upload.)

### 5. Allow the workflow to write
**Settings** → **Actions** → **General** → **Workflow permissions** → choose **Read and write permissions** → **Save**.

Then open the **Actions** tab. If you see a yellow or failed run from step 3, open it and press
**Re-run all jobs**. When it turns green, your site is live at the address from step 2.

### 6. Set your details in `config.js`
Open `config.js` on GitHub, click the pencil, edit, then **Commit changes**.

| Setting | What to write |
|---|---|
| `repo.owner`, `repo.name`, `repo.branch` | Your GitHub username, the repo name and `main`. (On a normal `username.github.io/repo/` address these are detected automatically, so you may leave them empty.) |
| `contact.whatsapp` | Your number with country code, digits only. Empty = the contact tile and "report an error" buttons are hidden. |
| `contact.instagram` | Your handle without `@`. Optional. |
| `exam.date` | `'2027-01-15'` or `'2027-01-15T08:30'`. Empty = no countdown. |
| `reminders` | Your own daily lines: `{ ar: '…', en: '…' }`. Empty = hidden. The site never writes any text of its own here. |

Nothing is invented for you: every value left empty simply hides its feature.

### 7. Upload new files from your phone
1. Open your site, scroll to the bottom, tap **Add files** (or open the repo → `files` folder).
2. **Add file** → **Upload files** → choose the files → **Commit changes**.
3. Wait about a minute. The workflow rebuilds `files-index.json` and republishes the site.
   Classmates see the new files (with a "New" badge) the next time they open or refresh the site.

The bilingual **Owner guide** page (link in the site footer) repeats these steps.

---

## 8. File naming convention

```
Subject - Lesson title [Tag] [Tag].ext
```

Examples:

```
Tawheed - Lesson 3 [Summary].pdf
الفقه - الدرس 5 [ملخص] [طباعة].pdf
Tafsir - Lesson 12 audio.mp3
Exam - Midterm 2026 [Exam].pdf
```

- **Subject** = the text before the first ` - ` (space, dash, space). No ` - ` → the file goes under **Other / أخرى**.
- **Lesson number** = the first number in the title. Used for sorting (2 comes before 10) and for the lesson timeline.
- **Tags** in square brackets at the end, English or Arabic, capitals do not matter.
  They are removed from the title and shown as badges:

| Tag | Arabic | What it does |
|---|---|---|
| `[Full]` | `[كامل]` | "Full" badge |
| `[Summary]` | `[ملخص]` | "Summary" badge |
| `[Print]` | `[طباعة]` | Printer badge, "Print version" |
| `[Updated]` | `[محدث]` | "Updated" badge with the date; listed first in "Newest uploads" |
| `[Exam]` | `[اختبار]` | "Exam" badge; also listed in the Exam prep corner |

- Any other text in brackets stays in the title untouched.
- A subject named `Exam`, `اختبارات` or `نماذج اختبار` is also gathered in the Exam prep corner.
- File types: PDF, PowerPoint, Word, images (png, jpg, gif, webp) and audio (mp3, m4a, ogg, wav).
  PDFs and images preview in the page, audio plays in the built-in player, Word and PowerPoint show an
  info card with a Download button (previewing them would need an outside service, which this site never uses).

## 9. Descriptions, glossary terms and subject icons (all optional)

Three small files in the `data` folder. If a file is missing or has a typo, that feature quietly
hides; the site never breaks. The ones shipped are **samples**: replace their contents.

**`data/info.json`** — a short line under a file. The key is the exact file name:
```json
{
  "Tawheed - Lesson 3 [Summary].pdf": { "ar": "وصف قصير", "en": "Short description" }
}
```

**`data/glossary.json`** — terms shown in the Glossary tile, exactly as you write them:
```json
[
  { "term": "The term", "ar": "التعريف بالعربية", "en": "Definition in English", "subject": "Tawheed" }
]
```

**`data/subjects.json`** — display names, icon and tint per subject:
```json
{
  "Tawheed": { "ar": "التوحيد", "en": "Tawheed", "icon": "star-and-crescent", "tint": "a" }
}
```
Icons are chosen automatically from the subject name (توحيد، فقه، قرآن، تفسير، حديث، لغة/نحو، نظام/قانون، قضاء، سيرة and
their English spellings). To force one, use any of these names: `book`, `book-open`, `book-open-text`,
`book-bookmark`, `scroll`, `scales`, `gavel`, `bank`, `pen-nib`, `path`, `star-and-crescent`, `mosque`,
`exam`, `graduation-cap`, `folder`, `lightbulb`, `stack`. `tint` is `a` or `b` (the two colour families).

Tip: JSON is strict. Use double quotes and no comma after the last item.

## 10. Turning features on and off

In `config.js`, the `features` block has one line per feature: `true` = on, `false` = off.
For example `livingBackground: false` replaces the moving background with a calm static gradient,
and `quickGuide: false` removes the first-visit guide. Each feature is separate: switching one off
(or one failing) never affects the others. Raise `quickGuideVersion` to show the Quick Guide to everyone again.

## 11. Editing the texts and the Quick Guide lines

Every sentence on the site is in `translations.js`, once in the `en` block and once in the `ar` block.
Change only the text on the right-hand side. The Quick Guide lines are the entries starting with `guide.`.
To use Arabic-Indic digits (٠١٢٣) in Arabic, change `_numerals: 'latn'` to `'arab'` in the `ar` block.
To add a language, copy the `en` block and translate it.

## 12. Upload limits

- Uploading in the browser: up to **25 MB per file**.
- GitHub allows up to **100 MB per file**, but files over 25 MB need **GitHub Desktop**.
- Keep the whole repo small: ideally **under 1 GB**. Compress big PDFs and prefer mp3 for audio.
- Files over 10 MB show a "Large file, use Wi-Fi" notice to visitors.

## 13. Deleting the sample files

Delete these and commit; the list updates by itself:
- `files/Sample - Lesson 1 (delete me) [Summary].pdf`
- `files/عينة - الدرس 1 (ملف تجريبي احذفه).pdf`
- the sample entries inside `data/info.json`, `data/glossary.json` and `data/subjects.json`
  (or delete those three files completely).

Keep `files/.gitkeep` so the folder always exists.

## 14. Troubleshooting

**The site is not updating / new files are missing**
- Open the **Actions** tab. A green tick means it was published; wait a minute and refresh the site twice.
- A red cross: open the run and read the step that failed. Usually it is step 4 or 5 above
  (Pages source must be **GitHub Actions**; workflow permissions must be **Read and write**). Then **Re-run all jobs**.
- The workflow runs on the `main` (or `master`) branch. If your branch has another name, change it in
  `.github/workflows/index.yml` and in `config.js`.
- A phone may still show the old version for a moment: close and reopen the site, or tap **Refresh** on the
  "new version" message.

**A file is listed but will not open** — check that the name has no `/` or `\`, and that the upload finished.

**"Could not load the file list"** — the visitor is offline on a first visit, or `files-index.json` was deleted.
Run the workflow again (**Actions** → **Build file index and publish** → **Run workflow**).

**Rate limit** — the site reads the static `files-index.json`, so GitHub's limit of about 60 requests per hour
per network does not affect it. The GitHub API is only a backup when that file is missing.

**The background is slow on an old phone** — it already lowers its own quality and frame rate.
Visitors can tap the glasses icon (reading mode) for a still background; you can switch it off for
everyone with `livingBackground: false`.

**The link preview has no image in WhatsApp** — in `index.html`, change the two `icons/social-preview.png`
entries (`og:image` and `twitter:image`) to the full address,
`https://YOUR-USERNAME.github.io/lesson-notes/icons/social-preview.png`.

**After changing the site's code** (not needed for uploading notes) — raise `VERSION` in `service-worker.js`
(`'v1'` → `'v2'`) so old cached copies are cleared.

**Self-test** — open `tests.html` on your site. It checks the file-name rules, the file list and its
fallbacks, storage, the Quick Guide, the background and every feature, and shows PASS or FAIL.

---

## How it works (short)

| Part | What it does |
|---|---|
| `index.html`, `style.css`, `script.js` | The page, the look, and the small core (file list, grid, search, language, theme) |
| `boot.js` | Runs first: the one safe storage helper, and the saved language/theme before anything paints |
| `config.js`, `translations.js` | Your settings and all texts |
| `modules/` | One file per feature. Each has its own switch in `config.js` and its own safety net |
| `files/` | Your notes |
| `files-index.json` | The list of files, rebuilt automatically. Do not edit by hand |
| `scripts/build-index.mjs` | Builds that list: path, name, size, type and the date of the last commit that touched each file. Never reads file contents |
| `.github/workflows/index.yml` | On every push: builds the list, commits it (`[skip ci]`), publishes the site |
| `service-worker.js`, `manifest.webmanifest` | Offline use and "install as an app". Notes are kept offline only after you open them |
| `owner-guide.html`, `404.html`, `tests.html` | Owner guide, not-found page, self-test |
| `data/` | Optional descriptions, glossary, subject settings |
| `vendor/`, `fonts/`, `icons/` | Libraries, fonts and images, all stored locally |

The file list has three sources, in order: `files-index.json` → the GitHub API (one request) →
the last list saved on the visitor's device (with a "showing saved list" notice and a retry button).

### Decisions made while building

- **Publishing uses GitHub Actions** (one workflow builds the index *and* deploys). GitHub does not rebuild a
  branch-based Pages site for commits made by its own bot, so the fresh index would otherwise wait for your next upload.
- **A file's date** is the date of the last commit that added or changed it, so a replaced file counts as new again.
- **Subjects are ordered larger first**, then alphabetically, so tiles of similar height sit side by side and the grid has no half-empty tiles. Tiles show 6 files, with "Show all".
- **Arabic font: Tajawal** (clear on screens). English: Atkinson Hyperlegible for text, Lexend for headings.
- **Icons: Phosphor (duotone)**, embedded in `modules/icons.js`.
- **Audio opens an inline player under its row**; other files open the glass viewer.
- **Dark glass is tinted slightly darker than the first sketch** so small grey text passes WCAG AA even over the brightest orange (measured: at least 5.3:1 in dark and 5.2:1 in light at every scroll position).
- **The fine dot texture is a fixed CSS layer** above the shader (the shader renders at reduced resolution, where 2 px dots cannot exist).
- **Tiny features live inside the core renderer** with their own switches (sort, type chips, tag/"New" badges, "Newest uploads") instead of separate files; everything else is one module per feature.
- **`404.html` is self-contained** (GitHub shows it at any folder depth, where relative links to the stylesheet would break). It uses system fonts, and loads the living background and texts from the site when it can.
- **A strict Content-Security-Policy** in `index.html` makes the privacy line enforceable: the browser itself blocks any request to another site (except GitHub's API for the backup file list).
- **First visit**: language follows the device, theme follows the system (dark unless the system asks for light), reading mode follows "reduce motion".
- **The Awqat tile** is present in `config.js` → `extraTiles`, switched off.

## 15. Credits and licences

| What | Licence | Where |
|---|---|---|
| [JSZip](https://stuk.github.io/jszip/) 3.10 — zip for "Download all" | MIT (dual MIT / GPLv3) | `vendor/jszip.min.js`, `vendor/LICENSE-jszip.md` |
| [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) 2.0 by Kazuhiko Arase — QR tile | MIT | `vendor/qrcode.min.js`, `vendor/LICENSE-qrcode-generator.txt` |
| [Phosphor Icons](https://phosphoricons.com) — all icons | MIT | `modules/icons.js`, `vendor/LICENSE-phosphor-icons.txt` |
| [Tajawal](https://fonts.google.com/specimen/Tajawal) — Arabic font | SIL Open Font License 1.1 | `fonts/`, `fonts/LICENSE-Tajawal.txt` |
| [Atkinson Hyperlegible](https://www.brailleinstitute.org/freefont/) — English text | SIL Open Font License 1.1 | `fonts/`, `fonts/LICENSE-AtkinsonHyperlegible.txt` |
| [Lexend](https://www.lexend.com) — English headings | SIL Open Font License 1.1 | `fonts/`, `fonts/LICENSE-Lexend.txt` |

"QR Code" is a registered trademark of DENSO WAVE INCORPORATED.
The background shader, Quick Guide, animations and everything else were written by hand for this site.

Made by Sulaim · من إعداد سليم
