/**
 * Speech to text with OpenAI. `gpt-transcribe` (July 2026) is the most accurate and handles
 * switching between English, Hindi and Punjabi mid-sentence; older models are fallbacks.
 */
const MODELS = ['gpt-transcribe', 'gpt-4o-transcribe', 'whisper-1'] as const;
type Model = (typeof MODELS)[number];

/** Languages the speaker may use, as hints (gpt-transcribe only). */
const LANGUAGES = ['en', 'hi', 'pa'];

export class TranscriptionError extends Error {
  constructor(message: string, readonly badKey = false) {
    super(message);
  }
}

/** Models this key turned out not to have, so later recordings skip straight past them. */
const unavailable = new Set<Model>();

/** A keyword can't hold <, > or line breaks, or the whole request is rejected. */
export function cleanKeywords(words: string[], limit = 50): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of words) {
    const word = raw.replace(/[<>\r\n]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!word || word.length > 40 || seen.has(word.toLowerCase())) continue;
    seen.add(word.toLowerCase());
    out.push(word);
    if (out.length >= limit) break;
  }
  return out;
}

function prompt(vocabulary: string[], withNames: boolean): string {
  return [
    'A personal voice journal: quick notes, to-dos, shopping and thoughts.',
    'The speaker is from India and talks in English, sometimes with Hindi or Punjabi words.',
    'Write everything in English letters, with normal punctuation.',
    withNames && vocabulary.length ? `Names and words that may come up: ${vocabulary.slice(0, 40).join(', ')}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

/** The form for one try. `hints` adds the language and keyword hints gpt-transcribe accepts. */
function form(uri: string, model: Model, vocabulary: string[], hints: boolean): FormData {
  const data = new FormData();
  // React Native's FormData accepts a file by uri.
  data.append('file', { uri, name: 'entry.m4a', type: 'audio/m4a' } as unknown as Blob);
  data.append('model', model);
  if (model === 'gpt-transcribe') {
    data.append('prompt', prompt(vocabulary, false));
    if (hints) {
      for (const language of LANGUAGES) data.append('languages[]', language);
      for (const keyword of cleanKeywords(vocabulary)) data.append('keywords[]', keyword);
    }
  } else {
    // whisper-1 reads at most 224 tokens of prompt; the names matter most.
    data.append('prompt', prompt(vocabulary, true));
  }
  return data;
}

/**
 * Transcribes a recording. `vocabulary` (names and words from your journal) helps it spell
 * people and places the way you do.
 */
export async function transcribe(uri: string, apiKey: string, vocabulary: string[] = []): Promise<string> {
  let lastError: unknown = null;
  for (const model of MODELS) {
    if (unavailable.has(model) && model !== MODELS[MODELS.length - 1]) continue;
    // gpt-transcribe gets one try with language and keyword hints, then one plain try.
    const tries = model === 'gpt-transcribe' ? [true, false] : [false];
    for (const hints of tries) {
      try {
        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}` },
          body: form(uri, model, vocabulary, hints),
        });
        const body = await response.json().catch(() => ({}));
        if (response.status === 401) throw new TranscriptionError('The OpenAI key was not accepted. Check it in Settings.', true);
        if (response.status === 429) throw new TranscriptionError('OpenAI says the key is out of credit or busy. Check billing on platform.openai.com.');
        if (response.ok) return String(body.text ?? '').trim();
        lastError = new TranscriptionError(body?.error?.message ?? `Transcription failed (${response.status}).`);
        // A 400 with hints may be a hint it didn't like: the plain try comes next.
        if (hints && response.status === 400) continue;
        // No access to this model: don't ask it again.
        if (response.status === 403 || response.status === 404 || (response.status === 400 && /model/i.test(body?.error?.message ?? ''))) {
          unavailable.add(model);
        }
        break;
      } catch (error) {
        if (error instanceof TranscriptionError && (error.badKey || error.message.includes('credit'))) throw error;
        lastError = error;
        break; // network trouble: try the next model
      }
    }
  }
  throw lastError instanceof Error ? lastError : new TranscriptionError('Could not reach OpenAI. Check your internet.');
}
