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
  'raise', 'contribute', 'defrost', 'switch', 'teach', 'respond', 'bake', 'treat', 'attend', 'complete',
  'deposit', 'withdraw', 'share', 'post', 'research', 'compare', 'empty', 'vacuum', 'mop', 'dust',
  'sweep', 'paint', 'trim', 'mow', 'unpack', 'inform', 'notify', 'invite', 'thank', 'congratulate',
  'buzz', 'whatsapp', 'dm', 'google', 'download', 'print', 'scan', 'photocopy', 'courier', 'ship', 'renew',
]);
/** Words that point back at what was just said: ", pay it by Friday", ", order them". */
const BACK_OBJECTS = new Set(['it', 'them', 'that', 'this', 'those', 'these']);
/** How a want or a need can carry over to the next verb: "I want to move back and start a farm". */
const CARRIED = /^(.*?\b(?:want to|wants to|need to|needs to|have to|has to|got to|gotta|should|must|plan to|planning to|hope to|going to|gonna|wanna|love to|like to|goal is to|dream is to|plan is to|aim is to|remind me to|remember to|forget to|trying to|try to))\s/i;

/** Time words that can make up a whole fragment: "so tomorrow early morning before breakfast". */
const TIME_ONLY = new Set([
  'today', 'tonight', 'tomorrow', 'morning', 'afternoon', 'evening', 'night', 'early', 'late', 'later', 'before',
  'after', 'breakfast', 'lunch', 'dinner', 'bed', 'bedtime', 'sleeping', 'work', 'office', 'at', 'around', 'by', 'on',
  'in', 'the', 'this', 'next', 'week', 'weekend', 'month', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday',
  'saturday', 'sunday', 'am', 'pm', "o'clock", 'sharp', 'first', 'thing', 'latest', 'maybe', 'ideally', 'probably',
  'so', 'then', 'and', 'or', 'half', 'an', 'a', 'hour', 'hours', 'minutes', 'mins', 'noon', 'midnight', 'eod', 'end',
  'of', 'day', 'asap', 'please', 'itself', 'only', 'max', 'at', 'least', 'latest', 'possible', 'if',
]);
const TIME_ANCHOR = /^(today|tonight|tomorrow|morning|afternoon|evening|night|monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekend|week|month|noon|midnight|eod|breakfast|lunch|dinner|bed|bedtime|\d+(am|pm|st|nd|rd|th)?)$/;

/** True for a fragment that only says when: "tomorrow early morning", "at 5 then". */
export function onlySaysWhen(fragment: string): boolean {
  const tokens = words(fragment);
  return tokens.length > 0 && tokens.every((t) => TIME_ONLY.has(t) || /^\d+(am|pm|st|nd|rd|th)?$/.test(t)) && tokens.some((t) => TIME_ANCHOR.test(t));
}
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
  const schedule = scheduleList(chunk);
  if (schedule) return schedule;
  const parts = chunk.split(/\s+/).filter(Boolean);
  if (parts.length <= 4) return [chunk];
  const sentences: string[] = [];
  let current: string[] = [];
  /** A want or need to carry into the next thought ("I want to"), set when splitting before a bare verb. */
  let carry = '';
  const flush = (nextCarry = '') => {
    if (current.length) {
      const text = current.join(' ');
      // "so tomorrow early morning" only says when the thought before it should happen.
      if (sentences.length && onlySaysWhen(text)) sentences[sentences.length - 1] += ` ${text}`;
      else sentences.push(carry && !CARRIED.test(text) ? `${carry} ${text}` : text);
    }
    current = [];
    carry = nextCarry;
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
        // "I want to move back and start a farm": the second verb shares the want.
        const shared = ACTION_VERBS.has(next) && !STARTERS.has(next) ? CARRIED.exec(current.join(' '))?.[1] ?? '' : '';
        flush(shared ? shared.replace(/^[ ,]+/, '') : '');
        i = j - 1; // drop the connectors
        continue;
      }
    }
    const leadIn = NO_SPLIT_AFTER.has(words(current.join(' ')).join(' '));
    // ", pay it by Friday" points back at what came before, so it stays with it.
    const pointsBack = ACTION_VERBS.has(word) && BACK_OBJECTS.has(words(parts[i + 1] ?? '')[0] ?? '');
    if (afterComma && current.length >= 2 && !leadIn && !pointsBack && (STARTERS.has(word) || ACTION_VERBS.has(word))) {
      flush();
    }
    current.push(parts[i]);
  }
  flush();
  return sentences.map((s) => s.replace(/^[ ,]+|[ ,]+$/g, '')).filter(Boolean);
}

const DAY_LEAD = /^(today|tonight|tomorrow|(?:on |this |next )?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b[:,]?\s*/i;
const HAS_CLOCK = /\b(?:at|around|by)\s+\d{1,2}(?:[:.]\d{2})?\b|\b\d{1,2}(?:[:.]\d{2})?\s?(?:am|pm)\b/i;

/**
 * A dictated schedule, one item per comma: "Tomorrow: gym at 7, standup at 10, dentist at 4".
 * Each becomes its own thought, and the day said at the start goes with all of them.
 */
function scheduleList(chunk: string): string[] | null {
  const parts = chunk.split(/,|\band then\b|\bthen\b|\band\b/i).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  if (!parts.every((p) => HAS_CLOCK.test(p) && words(p).length <= 7)) return null;
  const day = DAY_LEAD.exec(parts[0])?.[1] ?? '';
  return parts.map((p, i) => {
    if (i === 0 || !day || DAY_LEAD.test(p)) return p.replace(/^(\w+):\s*/, '$1 ');
    return `${p} ${day.toLowerCase()}`;
  });
}
