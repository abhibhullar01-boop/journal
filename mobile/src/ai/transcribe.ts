/**
 * Speech to text with OpenAI's transcription models. Much more accurate than the iPhone
 * keyboard mic on accents, names and mixed English/Hindi/Punjabi.
 */
const MODELS = ['gpt-4o-transcribe', 'whisper-1'];

export class TranscriptionError extends Error {
  constructor(message: string, readonly badKey = false) {
    super(message);
  }
}

/**
 * Transcribes a recording. `vocabulary` (names and words from your journal) helps it spell
 * people and places the way you do.
 */
export async function transcribe(uri: string, apiKey: string, vocabulary: string[] = []): Promise<string> {
  const prompt = [
    'A personal voice journal. The speaker is from India and talks in English, sometimes with Hindi or Punjabi words.',
    'Write everything in English letters, with normal punctuation.',
    vocabulary.length ? `Names and words that may come up: ${vocabulary.slice(0, 60).join(', ')}.` : '',
  ].join(' ');

  let lastError: unknown = null;
  for (const model of MODELS) {
    const form = new FormData();
    // React Native's FormData accepts a file by uri.
    form.append('file', { uri, name: 'entry.m4a', type: 'audio/m4a' } as unknown as Blob);
    form.append('model', model);
    form.append('prompt', prompt);
    form.append('response_format', 'json');
    try {
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });
      const body = await response.json().catch(() => ({}));
      if (response.status === 401) throw new TranscriptionError('The OpenAI key was not accepted. Check it in Settings.', true);
      if (response.status === 429) throw new TranscriptionError('OpenAI says the key is out of credit or busy. Check billing on platform.openai.com.');
      if (!response.ok) {
        lastError = new TranscriptionError(body?.error?.message ?? `Transcription failed (${response.status}).`);
        continue; // try the next model
      }
      return String(body.text ?? '').trim();
    } catch (error) {
      if (error instanceof TranscriptionError && (error.badKey || error.message.includes('credit'))) throw error;
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new TranscriptionError('Could not reach OpenAI. Check your internet.');
}
