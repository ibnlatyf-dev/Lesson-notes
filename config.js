/* =====================================================================
 * Lesson Notes Hub — config.js
 * The ONE place to change settings. Edit the values, save, upload.
 * Any value left empty simply hides its feature (nothing breaks).
 * ===================================================================== */

export const CONFIG = {
  /* ---- Your GitHub repo -------------------------------------------------
   * Used for the "Add files" link and as a backup way to list files.
   * If you leave owner/name empty and the site runs on
   * https://YOURNAME.github.io/REPO/ they are detected automatically. */
  repo: {
    owner: '',      // your GitHub username, e.g. 'sulaim'
    name: '',       // the repo name, e.g. 'lesson-notes'
    branch: 'main', // the branch GitHub Pages publishes
  },

  /* ---- Where things live (normally leave these alone) ------------------- */
  filesDir: 'files',
  indexPath: 'files-index.json',
  data: {
    info: 'data/info.json',         // short descriptions per file (optional)
    glossary: 'data/glossary.json', // glossary terms (optional)
    subjects: 'data/subjects.json', // subject names / icons / tints (optional)
  },

  /* ---- Contact (F24, F30). Leave empty to hide the contact tile ---------
   * whatsapp: full number with country code, digits only, e.g. '9665XXXXXXXX'
   *           (or a full https://wa.me/... link)
   * instagram: your handle without the @                                    */
  contact: {
    whatsapp: '',
    instagram: '',
  },

  /* ---- Credits tile (F25). Optional links: [{ label: 'My page', url: 'https://…' }] */
  credits: {
    links: [],
  },

  /* ---- Exam countdown (F9). Empty = hidden.
   * Format: 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM' (your local time). */
  exam: {
    date: '',
    name: { ar: '', en: '' }, // optional label, e.g. { ar: 'اختبار التوحيد', en: 'Tawheed exam' }
  },

  /* ---- Daily reminder line (F29). Empty = hidden.
   * ONLY you add texts here. The site never invents any.
   * Example: { ar: 'نص عربي', en: 'English text' }                          */
  reminders: [],

  /* ---- Quick Guide (F34). Raise this number to show the guide again to everyone. */
  quickGuideVersion: 1,

  /* ---- Small numbers you may tune -------------------------------------- */
  newDays: 7,          // files newer than this many days get the "New" badge
  largeFileMB: 10,     // files bigger than this get the "Large file" notice
  zipWarnMB: 50,       // "Download all" warns above this total size
  offlineFileMaxMB: 20, // opened files up to this size are kept for offline use

  /* ---- Feature switches: true = on, false = off ------------------------- */
  features: {
    livingBackground: true, // F37 the flowing colour background (false = calm static gradient)
    quickGuide: true,       // F34 first-visit Quick Guide
    help: true,             // F35 Help button, menu and tile
    preview: true,          // F1  preview before download
    zipDownload: true,      // F2  "Download all" per subject
    favourites: true,       // F3  stars + "My files"
    updatedNotice: true,    // F4  "3 new files since your last visit"
    share: true,            // F5  share button per file
    sort: true,             // F6  sort control
    pwa: true,              // F7  offline install (service worker)
    qrTile: true,           // F8  QR code tile
    countdown: true,        // F9  exam countdown (also needs exam.date)
    audioPlayer: true,      // F10 audio lessons player
    descriptions: true,     // F11 description line from data/info.json
    recent: true,           // F12 "Recently opened"
    subjectIcons: true,     // F13 subject cover icons
    timeline: true,         // F14 lesson timeline
    typeFilter: true,       // F15 file-type chips
    tagBadges: true,        // F16–F18 Full / Summary / Print / Updated / Exam badges
    shortcuts: true,        // F19 keyboard shortcuts
    textSize: true,         // F20 A- / A+
    readingMode: true,      // F21 reading-friendly mode
    privacyNote: true,      // F22 privacy line in the footer
    ownerLinks: true,       // F23 "Add files" + owner guide links in the footer
    contact: true,          // F24 contact tile (also needs contact details)
    credits: true,          // F25 credits tile
    glossary: true,         // F26 glossary tile (also needs data/glossary.json)
    examCorner: true,       // F27 exam prep corner
    done: true,             // F28 "mark as done" + progress rings
    reminder: true,         // F29 daily reminder line (also needs reminders above)
    report: true,           // F30 "report an error" per file (needs contact.whatsapp)
    largeFileWarning: true, // F31 "Large file, use Wi-Fi"
    newBadges: true,        // F33 "New" badges
    newest: true,           // "Newest uploads" tile
    backToTop: true,        // small "back to top" button
    extraTiles: true,       // the optional tiles listed below
  },

  /* ---- Extra tiles. Set enabled: true and fill in to show one. ----------
   * The Awqat app tile is kept here, switched OFF, for later. */
  extraTiles: [
    {
      id: 'awqat',
      enabled: false,
      icon: 'sparkle',
      title: { ar: '', en: '' },
      text: { ar: '', en: '' },
      url: '',
      linkLabel: { ar: '', en: '' },
    },
  ],
};
