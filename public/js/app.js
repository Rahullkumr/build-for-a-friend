// Page logic: photo upload, resize, streaming progress and showing the explanation.
import { TEXT } from './i18n.js';
import { initSpeech, stopSpeaking } from './speech.js';

const MAX_PIXELS = 900000;      // dense Hindi text became unreadable at 768px long side
const EXPECTED_READ_MS = 35000; // rough time to read the image on this laptop
const EXPECTED_CHARS = 1100;    // rough length of a full answer

const MOON = 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z';
const SUN = 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4';

const $ = (id) => document.getElementById(id);
let lang = 'hi';
let lastImage = null;
let controller = null;
let timer = null;

function applyLanguage() {
  document.documentElement.lang = lang;
  for (const el of document.querySelectorAll('[data-t]')) el.textContent = TEXT[lang][el.dataset.t];
  for (const b of document.querySelectorAll('.lang button')) b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
  applyTheme();
  stopSpeaking();
}

// The button shows the mode it switches to: moon + "Dark" while light, sun + "Light" while dark.
function applyTheme() {
  const dark = document.documentElement.dataset.theme === 'dark';
  $('themeIcon').setAttribute('d', dark ? SUN : MOON);
  $('themeLabel').textContent = dark ? TEXT[lang].toLight : TEXT[lang].toDark;
}

function setTheme(theme, remember) {
  document.documentElement.dataset.theme = theme;
  if (remember) {
    try { localStorage.setItem('theme', theme); } catch {}
  }
  applyTheme();
}

// Shrinks big photos to ~900k pixels: readable text, ~35s to read instead of ~95s.
async function resizeToJpeg(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, Math.sqrt(MAX_PIXELS / (bitmap.width * bitmap.height)));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.9);
}

// Letters in India write dates day-first: 15-10-2026, 15/10/2026, 15.10.2026.
function daysUntil(text) {
  const m = /(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(text || '');
  if (!m) return null;
  const due = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  if (due.getMonth() !== Number(m[2]) - 1) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due - today) / 86400000);
}

function setProgress(phase, chars, startedAt) {
  const t = TEXT[lang];
  $('status').textContent = phase === 'writing' ? t.writing : t.reading;
  const pct = phase === 'writing'
    ? 40 + Math.min(chars / EXPECTED_CHARS, 1) * 58
    : Math.min((Date.now() - startedAt) / EXPECTED_READ_MS, 1) * 38;
  $('bar').style.width = `${pct}%`;
}

function showError(message) {
  $('progress').hidden = true;
  $('errorText').textContent = message;
  $('error').hidden = false;
  $('again').hidden = false;
  $('pick').hidden = false;
}

function showResult(data, seconds) {
  const t = TEXT[lang];
  const urgency = ['high', 'medium', 'low'].includes(data.urgency) ? data.urgency : 'medium';
  $('result').className = `card result ${urgency}`;
  $('urgency').className = `badge ${urgency}`;
  $('urgency').textContent = t.urgency[urgency];
  $('docType').textContent = data.document_type;
  $('summary').textContent = data.summary;
  $('action').textContent = data.action_needed;

  const deadline = $('deadline');
  if (data.deadline) {
    const days = daysUntil(data.deadline);
    $('deadlineText').textContent = `${t.deadline}: ${data.deadline}` + (days === null ? '' : ` · ${t.daysLeft(days)}`);
    deadline.className = `deadline${urgency === 'high' || (days !== null && days <= 7) ? ' high' : ''}`;
    deadline.hidden = false;
  } else {
    deadline.hidden = true;
  }

  $('details').replaceChildren(...(data.key_details || []).map((d) => {
    const li = document.createElement('li');
    li.textContent = d;
    return li;
  }));
  $('note').textContent = t.note(seconds);

  $('progress').hidden = true;
  $('result').hidden = false;
  $('again').hidden = false;
  $('pick').hidden = false;
  $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function explain(image) {
  controller?.abort();
  controller = new AbortController();
  clearInterval(timer);
  stopSpeaking();

  $('result').hidden = true;
  $('error').hidden = true;
  $('again').hidden = true;
  $('steps').hidden = true;
  $('pick').classList.add('compact');
  $('pick').hidden = true; // no new photo while one is being read
  $('thumb').src = image;
  $('progress').hidden = false;

  const startedAt = Date.now();
  let phase = 'reading';
  let chars = 0;
  const tick = () => {
    setProgress(phase, chars, startedAt);
    $('elapsed').textContent = TEXT[lang].elapsed(Math.round((Date.now() - startedAt) / 1000));
  };
  tick();
  timer = setInterval(tick, 1000);

  try {
    const res = await fetch('/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image, lang }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(res.status === 413 || res.status === 400 ? TEXT[lang].badPhoto : TEXT[lang].failed);
    }

    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let newline;
      while ((newline = buffer.indexOf('\n')) !== -1) {
        const event = JSON.parse(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        if (event.type === 'progress') {
          phase = event.phase;
          chars = event.chars;
          setProgress(phase, chars, startedAt);
        } else if (event.type === 'result') {
          showResult(event.data, event.seconds);
        } else if (event.type === 'error') {
          showError(TEXT[lang].failed);
        }
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') return;
    showError(err instanceof TypeError ? TEXT[lang].offline : err.message);
  } finally {
    clearInterval(timer);
  }
}

$('pick').addEventListener('click', () => $('file').click());
$('again').addEventListener('click', () => $('file').click());

async function useFile(file) {
  if (!file) return;
  try {
    lastImage = await resizeToJpeg(file);
  } catch {
    showError(TEXT[lang].badPhoto);
    return;
  }
  explain(lastImage);
}

$('file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  useFile(file);
});

// A photo can also be dragged from a folder onto the big button.
const pick = $('pick');
for (const type of ['dragenter', 'dragover']) {
  pick.addEventListener(type, (e) => { e.preventDefault(); pick.classList.add('dragging'); });
}
pick.addEventListener('dragleave', () => pick.classList.remove('dragging'));
pick.addEventListener('drop', (e) => {
  e.preventDefault();
  pick.classList.remove('dragging');
  useFile(e.dataTransfer.files[0]);
});
// Stop a photo dropped beside the button from opening in place of the app.
for (const type of ['dragover', 'drop']) window.addEventListener(type, (e) => e.preventDefault());

// Switching language re-explains the current letter in the new language.
for (const b of document.querySelectorAll('.lang button')) {
  b.addEventListener('click', () => {
    if (b.dataset.lang === lang) return;
    lang = b.dataset.lang;
    applyLanguage();
    if (lastImage) explain(lastImage);
  });
}

$('theme').addEventListener('click', () => {
  setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', true);
});

// Follow the computer's light/dark setting until a choice is made with the button.
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  let saved = null;
  try { saved = localStorage.getItem('theme'); } catch {}
  if (!saved) setTheme(e.matches ? 'dark' : 'light', false);
});

initSpeech(() => lang);
applyLanguage();
