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
