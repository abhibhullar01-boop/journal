import { words } from './tokenizer';

const CONNECTORS = new Set(['and', 'but', 'so', 'also', 'then', 'plus', 'oh']);
/** Words that start a new thought after a connector: "...and I...", "...and someday...". */
const STARTERS = new Set([
  'i', "i'm", 'im', "i've", 'ive', "i'll", 'ill', "i'd", 'my', 'remember', "don't", 'need',
  'someday', 'eventually', 'tomorrow', 'tonight', 'later',
]);
const TITLES = new Set(['dr.', 'mr.', 'mrs.', 'ms.', 'st.', 'vs.']);

/**
 * Splits a journal entry into sentences, including run-on dictation such as
 * "I went to the gym and I need to call mom and my goal is to run a marathon".
 */
export function splitSentences(text: string): string[] {
  return punctuationChunks(text)
    .flatMap(splitRunOn)
    .filter((chunk) => /[a-z]/i.test(chunk));
}

/** Splits on . ! ? ; and new lines, leaving "p.m.", "3.30" and "Dr. Lee" alone. */
export function punctuationChunks(text: string): string[] {
  const chars = [...text.replace(/’/g, "'")];
  const chunks: string[] = [];
  let current = '';
  const push = () => {
    const trimmed = current.trim();
    if (trimmed) chunks.push(trimmed);
    current = '';
  };
  chars.forEach((ch, i) => {
    if (ch === '\n' || ch === ';') {
      push();
    } else if (ch === '!' || ch === '?') {
      current += ch;
      push();
    } else if (ch === '.') {
      current += ch;
      const nextIsBoundary = i + 1 >= chars.length || /\s/.test(chars[i + 1]);
      const lastWord = current.split(' ').pop() ?? '';
      const isAbbreviation = lastWord.slice(0, -1).includes('.') || TITLES.has(lastWord.toLowerCase());
      if (nextIsBoundary && !isAbbreviation) push();
    } else {
      current += ch;
    }
  });
  push();
  return chunks;
}

/** Breaks "... and I ..." / "... but my ..." into separate sentences. */
export function splitRunOn(chunk: string): string[] {
  const parts = chunk.split(/\s+/).filter(Boolean);
  if (parts.length <= 5) return [chunk];
  const sentences: string[] = [];
  let current: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const word = words(parts[i])[0] ?? '';
    const next = i + 1 < parts.length ? words(parts[i + 1])[0] ?? '' : '';
    if (CONNECTORS.has(word) && STARTERS.has(next) && current.length >= 3) {
      sentences.push(current.join(' '));
      current = [];
      continue; // drop the connector
    }
    current.push(parts[i]);
  }
  if (current.length) sentences.push(current.join(' '));
  return sentences.map((s) => s.replace(/^[ ,]+|[ ,]+$/g, ''));
}
