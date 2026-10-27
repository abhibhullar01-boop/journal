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
  // How the thought opens matters most: "Call mom" vs "Called mom" vs "She wants to".
  const content = contentWords(text);
  if (content.length) result.push(`^${content[0]}`);
  if (content.length > 1) result.push(`^${content[0]} ${content[1]}`);
  if (content.length <= 3) result.push('#short');
  return result;
}

const LEADING_FILLERS = new Set([
  'um', 'uh', 'so', 'and', 'also', 'okay', 'ok', 'well', 'oh', 'then', 'plus', 'anyway', 'like',
  'yeah', 'alright', 'honestly', 'but',
]);

/** Words of the sentence with spoken fillers at the start removed ("um so call mom" -> "call mom"). */
export function contentWords(text: string): string[] {
  const tokens = words(text);
  let i = 0;
  while (i < tokens.length - 1 && LEADING_FILLERS.has(tokens[i])) i++;
  return tokens.slice(i);
}
