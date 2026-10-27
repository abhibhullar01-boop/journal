import { words } from './tokenizer';

const FILLERS = new Set(['um', 'uh', 'so', 'and', 'also', 'okay', 'ok', 'well', 'oh', 'then', 'plus', 'anyway', 'basically', 'hey', 'hi', 'please', 'pls', 'alright']);

/** Lead-ins to drop. Longer ones come first so "i really need to" wins over "i need to". */
const LEAD_INS: string[][] = [
  'one of my goals is to', 'my long-term plan is to', 'my long term plan is to',
  'over the next few years i want to', 'this year my goal is to', 'my big goal is to',
  'someday i want to', 'one day i want to', "one day i'd love to", 'eventually i want to',
  'long term i want to', 'in five years i want to', "i'd love to one day",
  'i really want to get good at', 'i really need to', 'i really want to',
  'i want to get better at', 'i want to build my skills in', "i'm trying to improve my",
  'i need to work on my', "i'm working on my", 'i want to improve at',
  'can you remind me to', 'could you remind me to', 'would you remind me to', 'can you please remind me to',
  'please remind me to', 'pls remind me to', 'can you set a reminder to', 'set a reminder to', 'ping me to',
  'remind me later to', "don't let me forget to", "don't forget to", 'make sure i', 'note to self', 'reminder to', 'remember to', 'remind me to',
  'i still need to', 'i need to', 'i have to', "i've got to", 'i got to', 'i gotta',
  'i should', 'i must', 'need to', 'have to', 'got to', 'gotta',
  'my goal is to', 'my goal is', 'my dream is to', 'i aspire to', 'i hope to',
  'i plan to', "i'm going to", 'i am going to', 'i will', "i'll", 'i wanna',
  "i'd like to", 'i would like to', "i'd love to", 'i would love to', 'i want to',
  "i'm", "i've been",
].map((s) => s.split(' '));

/** Turns a spoken sentence into a short title: "Um, I really need to call mom tomorrow." -> "Call mom tomorrow" */
export function titleFor(sentence: string): string {
  // "remind me in 2 hours to take the clothes out" -> "take the clothes out"
  const cleaned = sentence
    .replace(/’/g, "'")
    .replace(/\b(?:can you |could you |please |pls )*remind me (?:in|at|around|after|before|by|on)\b[^,]{1,25}?\bto\s+/i, '');
  const parts = cleaned.split(/\s+/).filter(Boolean);
  let changed = true;
  while (changed && parts.length > 0) {
    changed = false;
    // "long-term," -> "long-term", "Don't" -> "don't"
    const lowered = parts.map((p) => words(p).join('-'));
    if (FILLERS.has(lowered[0]) && parts.length > 1) {
      parts.shift();
      changed = true;
      continue;
    }
    for (const leadIn of LEAD_INS) {
      if (leadIn.length < parts.length && leadIn.every((w, i) => lowered[i] === w)) {
        parts.splice(0, leadIn.length);
        changed = true;
        break;
      }
    }
  }
  let title = parts.join(' ').replace(/^[ ,.!?;:]+|[ ,.!?;:]+$/g, '');
  if (title) title = title[0].toUpperCase() + title.slice(1);
  return title || sentence;
}

const WEEKDAY = '(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)';
const PART = '(?:morning|afternoon|evening|night)';
const MONTH = '(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)';
const COUNT = '(?:\\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty|forty-five)';
const ORDINAL = '\\d{1,2}(?:st|nd|rd|th)';

/** Time phrases the reminder already covers, so the title doesn't repeat them. */
const WHEN = new RegExp(
  `(?:^|[\\s,])(?:${[
    `(?:on |by )?(?:the )?day after tomorrow(?: ${PART})?`,
    `(?:first thing )?(?:by |until )?tomorrow(?: early)?(?: ${PART})?`,
    'early (?:in the )?morning',
    '(?:before|after) breakfast',
    'first thing in the morning',
    'later today',
    '(?:by )?tonight',
    `(?:by |until )?today`,
    `this (?:${PART}|weekend|week)`,
    `(?:on |by )?next (?:week|month|${WEEKDAY})`,
    `(?:on |by |this |until |till )?${WEEKDAY}(?: ${PART})?`,
    `in the ${PART}`,
    `(?:at |around |by )?\\d{1,2}(?:[:.]\\d{2})? ?(?:am|pm|a\\.m\\.?|p\\.m\\.?)`,
    `(?:at |around |by )\\d{1,2}(?:[:.]\\d{2})?(?: (?:o'clock|sharp))?`,
    'at (?:noon|midnight)',
    'in half an hour',
    'in a (?:couple|few) (?:of )?(?:hours|minutes|mins)',
    `in ${COUNT} (?:minutes?|mins?|hours?|hrs?|days?|weeks?)`,
    '(?:after|before) (?:work|lunch|dinner|bed)',
    '(?:by )?(?:the )?end of (?:the )?(?:day|week|month)',
    'eod',
    'asap',
    `(?:on |by )?the ${ORDINAL}(?: of ${MONTH})?`,
    `(?:on |by )?${MONTH} ${ORDINAL.replace('(?:st|nd|rd|th)', '(?:st|nd|rd|th)?')}`,
    `(?:on |by )?\\d{1,2}(?:st|nd|rd|th)? (?:of )?${MONTH}`,
  ].join('|')})(?=$|[\\s,.!?])`,
  'gi',
);

/** "Call mom tomorrow at 5 about the trip" -> "Call mom about the trip". Used when the item has a reminder. */
export function withoutWhen(title: string): string {
  let out = title;
  for (let i = 0; i < 3; i++) {
    // "for the 14th" and "before the 18th" stay: the reminder comes the day before, so the title keeps the date.
    const next = out.replace(WHEN, (match: string, offset: number, all: string) =>
      /\b(?:for|before)$/i.test(all.slice(0, offset).trimEnd()) && /\d|day\b|tomorrow/i.test(match) ? match : ' ',
    );
    if (next === out) break;
    out = next;
  }
  out = out.replace(/\s{2,}/g, ' ').replace(/\s+([,.!?])/g, '$1').trim();
  // Words left hanging at the end: "Pay rent on", "Call mom and".
  for (let i = 0; i < 3; i++) out = out.replace(/(?:[\s,]+(?:and|on|by|at|for|to|until|till|before|around|from|so|then))+[\s,.!?]*$/i, '').replace(/[\s,;:]+$/, '');
  out = out.replace(/^[\s,]+/, '');
  if (out.length < 3) return title;
  return out[0].toUpperCase() + out.slice(1);
}

/** The title for a task: the words that matter, without the time (the reminder shows it). */
export function taskTitle(sentence: string): string {
  return withoutWhen(titleFor(sentence));
}
