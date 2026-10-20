/** Lowercase words made of letters, digits and inner apostrophes. "Don't forget!" -> ["don't", "forget"] */
export function words(text: string): string[] {
  const lowered = text.toLowerCase().replace(/’/g, "'");
  const matches = lowered.match(/[a-z0-9'\u00c0-\u024f]+/g) ?? [];
  return matches.map((w) => w.replace(/^'+|'+$/g, '')).filter((w) => w.length > 0);
}

/**
 * Unigrams plus bigrams ("need to", "get better"). Bigrams carry most of the signal
 * that separates "I need to call" (task) from "I need to work on my" (skill).
 */
export function features(text: string): string[] {
  const tokens = words(text);
  const result = [...tokens];
  for (let i = 0; i < tokens.length - 1; i++) {
    result.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return result;
}
