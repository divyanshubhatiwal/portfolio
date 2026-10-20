// Voice mode for the chat, using the browser's built-in speech APIs (no extra service or cost):
//  - mic button: speak a question (speech recognition; Chrome and Edge, hidden elsewhere)
//  - speaker toggle: read answers aloud (speech synthesis; most browsers)
import { $, storageGet, storageSet } from './dom';

// Speech recognition isn't in TypeScript's DOM types yet, so describe the small part we use.
interface Recognition extends EventTarget {
  lang: string; interimResults: boolean; maxAlternatives: number;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}
type RecognitionCtor = new () => Recognition;

/** Plain text for reading aloud: drop the "Sources" list and citation numbers. */
function speakable(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  div.querySelectorAll('.cites, .cite').forEach((el) => el.remove());
  return (div.textContent ?? '').replace(/\s+/g, ' ').trim();
}

export interface Voice { readAloud(html: string): void }

export function initVoice(): Voice {
  const input = $<HTMLInputElement>('#chat-input'), form = $<HTMLFormElement>('#chat-form');
  const mic = $<HTMLButtonElement>('#chat-mic'), speaker = $<HTMLButtonElement>('#chat-speak'), note = $('#chat-voice-note');
  const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
  let speaking = storageGet('chat-speak', localStorage) === '1';

  // ---- read answers aloud ----
  const setSpeaker = (on: boolean) => {
    speaking = on;
    storageSet('chat-speak', on ? '1' : '0', localStorage);
    speaker?.setAttribute('aria-pressed', String(on));
    speaker?.setAttribute('aria-label', on ? 'Stop reading answers aloud' : 'Read answers aloud');
    if (!on) synth?.cancel();
  };
  if (speaker) {
    if (!synth) speaker.hidden = true;
    else { speaker.hidden = false; setSpeaker(speaking); speaker.addEventListener('click', () => setSpeaker(!speaking)); }
  }

  // ---- speak a question ----
  const Ctor = (window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor })
    .SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: RecognitionCtor }).webkitSpeechRecognition;
  if (mic && input && form) {
    if (!Ctor) mic.hidden = true;
    else {
      mic.hidden = false;
      let rec: Recognition | null = null;
      const stop = () => { mic.classList.remove('listening'); mic.setAttribute('aria-pressed', 'false'); rec = null; };
      mic.addEventListener('click', () => {
        if (rec) { rec.stop(); return; }
        synth?.cancel();
        if (note && !storageGet('voice-noted', localStorage)) {
          note.hidden = false; // one-time privacy note: the browser's speech service does the transcription
          storageSet('voice-noted', '1', localStorage);
        }
        rec = new Ctor();
        rec.lang = navigator.language || 'en-US';
        rec.interimResults = true;
        rec.maxAlternatives = 1;
        let finalText = '';
        rec.onresult = (e) => {
          let interim = '';
          for (const r of Array.from(e.results)) {
            if (r.isFinal) finalText = r[0]?.transcript ?? finalText;
            else interim += r[0]?.transcript ?? '';
          }
          input.value = (finalText || interim).trim();
        };
        rec.onerror = () => stop();
        rec.onend = () => { stop(); if (input.value.trim()) form.requestSubmit(); };
        mic.classList.add('listening');
        mic.setAttribute('aria-pressed', 'true');
        rec.start();
      });
    }
  }

  return {
    readAloud(html: string) {
      if (!speaking || !synth) return;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(speakable(html));
      u.lang = navigator.language || 'en-US';
      u.rate = 1.02;
      synth.speak(u);
    },
  };
}
