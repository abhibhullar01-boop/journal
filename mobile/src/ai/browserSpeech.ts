/**
 * The browser's own speech recognition (Chrome, Edge and Safari have it), so the website can
 * listen even without an OpenAI key. Less accurate than OpenAI, but free and it shows the words
 * as you speak.
 */

interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEvent {
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type RecognitionConstructor = new () => Recognition;

function recognitionClass(): RecognitionConstructor | null {
  const g = globalThis as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor; document?: unknown };
  if (!g.document) return null;
  return g.SpeechRecognition ?? g.webkitSpeechRecognition ?? null;
}

export function browserSpeechAvailable(): boolean {
  return recognitionClass() !== null;
}

export interface Listening {
  /** Stops listening and gives back everything heard. */
  stop(): Promise<string>;
  /** Stops and throws the words away. */
  cancel(): void;
}

const join = (a: string, b: string) => [a.trim(), b.trim()].filter(Boolean).join(' ');

const BLOCKED = 'Microphone access is blocked. Allow it for this site (the icon left of the web address), then try again.';

/**
 * Starts listening. `onWords` gets the words so far, as they come. `onFail` is called once if
 * the browser can't listen (blocked microphone, no speech service).
 */
export function startListening(onWords: (soFar: string) => void, onFail: (message: string) => void, lang = 'en-IN'): Listening {
  const Recognition = recognitionClass();
  if (!Recognition) throw new Error('This browser has no speech recognition.');
  const recognition = new Recognition();
  recognition.lang = lang;
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  /** Words from earlier sessions: browsers end a session after a pause, and we start a new one. */
  let earlier = '';
  /** This session's words, final and still-changing. */
  let current = '';
  let stopping = false;
  let cancelled = false;
  let failed = false;
  let finished: ((text: string) => void) | null = null;
  const heard = () => join(earlier, current);

  recognition.onresult = (event) => {
    let text = '';
    for (let i = 0; i < event.results.length; i++) text = join(text, event.results[i][0].transcript);
    current = text;
    onWords(heard());
  };
  recognition.onerror = (event) => {
    if (cancelled || failed) return;
    // A pause with no speech is normal; the session just restarts.
    if (event.error === 'no-speech' || event.error === 'aborted') return;
    failed = true;
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed' || event.error === 'audio-capture') onFail(BLOCKED);
    else if (event.error === 'network') onFail("The browser's speech service couldn't be reached. Check your internet, or type instead.");
    else onFail("The browser couldn't listen. You can type instead.");
  };
  recognition.onend = () => {
    earlier = heard();
    current = '';
    if (!stopping && !cancelled && !failed) {
      try {
        recognition.start();
        return;
      } catch {
        // fall through and finish
      }
    }
    finished?.(earlier);
    finished = null;
  };
  recognition.start();

  return {
    stop: () =>
      new Promise<string>((resolve) => {
        stopping = true;
        finished = resolve;
        try {
          recognition.stop();
        } catch {
          resolve(heard());
          return;
        }
        // Some browsers never fire `end` after stop(): don't wait forever.
        setTimeout(() => {
          if (finished) {
            finished = null;
            resolve(heard());
          }
        }, 2500);
      }),
    cancel: () => {
      cancelled = true;
      try {
        recognition.abort();
      } catch {
        // already stopped
      }
    },
  };
}
