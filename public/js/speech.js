import { TEXT } from './i18n.js';

const $ = (id) => document.getElementById(id);
let getLang = () => 'hi';

// Read aloud. First choice is the ElevenLabs voice (via our server, which holds the key):
// only the summary and steps are sent, never the photo or the details list.
// Fallback is a voice installed on this computer. Online browser voices (localService false)
// are skipped because they would send the text to a cloud service without saying so.
const canSpeak = 'speechSynthesis' in window;
let ttsOnline = false;
let audio = null;
let audioAbort = null;
let cachedAudio = { text: '', url: '' }; // replaying the same letter costs no extra credits


function pickVoice() {
  if (!canSpeak) return null;
  const prefix = getLang() === 'hi' ? 'hi' : 'en';
  const local = speechSynthesis.getVoices()
    .filter((v) => v.localService && v.lang.toLowerCase().startsWith(prefix));
  return local.find((v) => /-in$/i.test(v.lang)) || local[0] || null;
}

export function updateListen() {
  const hasVoice = ttsOnline || Boolean(pickVoice());
  $('listen').hidden = !hasVoice;
  $('voiceNote').hidden = hasVoice || !canSpeak;
  $('ttsNote').hidden = !ttsOnline;
}

export function stopSpeaking() {
  if (canSpeak) speechSynthesis.cancel();
  audioAbort?.abort();
  audioAbort = null;
  audio?.pause();
  audio = null;
  $('listen').classList.remove('speaking');
  $('listenLabel').textContent = TEXT[getLang()].listen;
  updateListen();
}

function spokenText(includeDetails) {
  const t = TEXT[getLang()];
  return [
    $('urgency').textContent,
    $('deadline').hidden ? '' : $('deadlineText').textContent,
    `${t.whatSays}. ${$('summary').textContent}`,
    `${t.whatToDo}. ${$('action').textContent}`,
    includeDetails ? `${t.details}. ${[...$('details').children].map((li) => li.textContent).join('. ')}` : '',
  ].filter(Boolean).join('\n');
}

async function speakOnline(text) {
  if (cachedAudio.text !== text) {
    audioAbort = new AbortController();
    const res = await fetch('/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: audioAbort.signal,
    });
    if (!res.ok) throw new Error(`speak failed: ${res.status}`);
    const url = URL.createObjectURL(await res.blob());
    if (cachedAudio.url) URL.revokeObjectURL(cachedAudio.url);
    cachedAudio = { text, url };
  }
  audio = new Audio(cachedAudio.url);
  audio.onended = stopSpeaking;
  await audio.play();
  $('listenLabel').textContent = TEXT[getLang()].stop;
}

function speakLocal(voice, text) {
  // One utterance per sentence: browsers can cut off a single long utterance part-way.
  const sentences = text.split(/(?<=[।.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
  speechSynthesis.cancel();
  sentences.forEach((sentence, i) => {
    const u = new SpeechSynthesisUtterance(sentence);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = 0.9;
    if (i === sentences.length - 1) u.onend = stopSpeaking;
    speechSynthesis.speak(u);
  });
}

async function speakResult() {
  $('listen').classList.add('speaking');
  $('listenLabel').textContent = ttsOnline ? TEXT[getLang()].preparing : TEXT[getLang()].stop;
  if (ttsOnline) {
    try {
      await speakOnline(spokenText(false));
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
      // No internet or the voice service failed: fall through to the local voice.
    }
  }
  const voice = pickVoice();
  $('listenLabel').textContent = TEXT[getLang()].stop;
  if (voice) speakLocal(voice, spokenText(true));
  else stopSpeaking();
}

export function initSpeech(langGetter) {
  getLang = langGetter;
  fetch('/config')
    .then((r) => r.json())
    .then((c) => { ttsOnline = Boolean(c.tts); updateListen(); })
    .catch(() => {});
  $('listen').addEventListener('click', () => {
    if ($('listen').classList.contains('speaking')) stopSpeaking();
    else speakResult();
  });
  // Browsers load the voice list after the page, so re-check when it arrives.
  if (canSpeak) speechSynthesis.addEventListener('voiceschanged', updateListen);
}
