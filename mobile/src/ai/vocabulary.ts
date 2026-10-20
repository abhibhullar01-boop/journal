const COMMON = new Set([
  'I', 'The', 'A', 'An', 'And', 'But', 'So', 'Also', 'Then', 'Today', 'Tomorrow', 'Tonight', 'Yesterday', 'My',
  'We', 'He', 'She', 'They', 'It', 'This', 'That', 'Need', 'Remind', 'Remember', 'Maybe', 'Okay', 'Ok', 'Um',
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Had', 'Went', 'Got', 'Just',
]);

/**
 * Names and unusual words from the journal ("Priya", "Mohali", "Blinkit"), most used first.
 * Passed to the transcription model so it spells them the way you do.
 */
export function journalVocabulary(texts: string[], facts: string[] = [], limit = 60): string[] {
  const counts = new Map<string, number>();
  for (const text of [...texts, ...facts]) {
    for (const match of text.matchAll(/\b([A-Z][a-zA-Z']{2,})\b/g)) {
      const word = match[1].replace(/'s$/, '');
      // Skip everyday words that are only capitalised because they start a sentence.
      if (COMMON.has(word) || /(ed|ing|ly)$/.test(word)) continue;
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([w]) => w);
}
