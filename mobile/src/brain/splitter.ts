import { words } from './tokenizer';

const CONNECTORS = new Set(['and', 'but', 'so', 'also', 'then', 'plus', 'oh']);
/** Words that start a new thought after a connector or comma: "...and I...", ", maybe call...". */
const STARTERS = new Set([
  'i', "i'm", 'im', "i've", 'ive', "i'll", 'ill', "i'd", 'my', 'we', "we're", "we've", "let's",
  'remember', 'remind', "don't", 'dont', 'need', 'gotta', 'maybe', 'please', 'someday',
  'eventually', 'tomorrow', 'tonight', 'later',
]);
/** Verbs that open an instruction: "...and ask Neha for the report", ", carry the documents". */
export const ACTION_VERBS = new Set([
  'call', 'email', 'text', 'message', 'ping', 'buy', 'get', 'grab', 'order', 'pick', 'drop', 'book',
  'pay', 'send', 'reply', 'ask', 'tell', 'check', 'review', 'finish', 'submit', 'renew', 'cancel',
  'return', 'fix', 'clean', 'water', 'lock', 'carry', 'take', 'bring', 'schedule', 'prepare', 'revise',
  'print', 'sign', 'transfer', 'apologize', 'apologise', 'visit', 'meet', 'wash', 'iron', 'pack',
  'confirm', 'update', 'file', 'follow', 'practice', 'practise', 'learn', 'start', 'make', 'write',
  'collect', 'recharge', 'plan', 'invest', 'register', 'apply', 'upload', 'link', 'set', 'charge',
  'refill', 'feed', 'wish', 'talk', 'cook', 'shut', 'sort', 'clear', 'rehearse', 'mail', 'remind',
  'study', 'read', 'look', 'install', 'backup', 'reschedule', 'add', 'put', 'hang', 'find', 'fill',
  'throw', 'move', 'go', 'help', 'organise', 'organize', 'repair', 'replace', 'arrange', 'chase',
]);
/** Lead-ins that belong to the clause after their comma: "Note to self, renew ...". */
const NO_SPLIT_AFTER = new Set(['note to self', 'reminder', 'to do', 'todo', 'okay so', 'ok so', 'oh and', 'and also', 'one more thing', 'first thing', 'also']);
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

/**
 * Breaks run-on dictation into separate thoughts:
 * "... and I ...", "... but my ...", "... and ask Neha ...", "... at 3 then groceries",
 * "..., maybe call Airtel", "..., carry the documents".
 */
export function splitRunOn(chunk: string): string[] {
  const parts = chunk.split(/\s+/).filter(Boolean);
  if (parts.length <= 4) return [chunk];
  const sentences: string[] = [];
  let current: string[] = [];
  const flush = () => {
    if (current.length) sentences.push(current.join(' '));
    current = [];
  };
  for (let i = 0; i < parts.length; i++) {
    const word = words(parts[i])[0] ?? '';
    const afterComma = i > 0 && parts[i - 1].endsWith(',');
    if (CONNECTORS.has(word) && current.length >= 3) {
      // Skip a run of connectors ("and also", "and then") and look at what follows.
      let j = i;
      while (j < parts.length && CONNECTORS.has(words(parts[j])[0] ?? '')) j++;
      const next = j < parts.length ? words(parts[j])[0] ?? '' : '';
      const run = parts.slice(i, j).map((p) => words(p)[0]);
      const opensThought = STARTERS.has(next) || ACTION_VERBS.has(next);
      if (next && (opensThought || run.includes('then') || (run.includes('also') && afterComma))) {
        flush();
        i = j - 1; // drop the connectors
        continue;
      }
    }
    const leadIn = NO_SPLIT_AFTER.has(words(current.join(' ')).join(' '));
    if (afterComma && current.length >= 2 && !leadIn && (STARTERS.has(word) || ACTION_VERBS.has(word))) {
      flush();
    }
    current.push(parts[i]);
  }
  flush();
  return sentences.map((s) => s.replace(/^[ ,]+|[ ,]+$/g, '')).filter(Boolean);
}
