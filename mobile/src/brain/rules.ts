import { isShoppingItem } from './shopping';
import { ACTION_VERBS } from './splitter';
import { contentWords, words } from './tokenizer';
import { emptyScores, Scores } from './types';

type Cue = [phrase: string, weight: number];

/**
 * Hand-written cue phrases. They keep the model sensible on phrasing the seed data
 * never covered, and they are easy to read and tweak.
 */
export const CUES: Record<'task' | 'shopping' | 'skill' | 'goal', Cue[]> = {
  task: [
    ['need to', 1.0], ['have to', 1.0], ['has to', 1.0], ['got to', 1.0], ['gotta', 1.0],
    ['must', 0.8], ['should', 0.6], ['remember to', 1.5], ['remind me', 1.5],
    ["don't forget", 1.5], ["don't let me forget", 1.5], ['forget to', 1.0], ['to do', 1.0], ['todo', 1.5],
    ['note to self', 1.0], ['make sure', 0.8], ['appointment', 1.2], ['meeting with', 1.0],
    ['tomorrow', 1.0], ['tonight', 1.0], ['today', 0.3], ['this afternoon', 1.0],
    ['this weekend', 0.7], ['next week', 0.7], ['by friday', 1.0], ['by monday', 1.0],
    ['on monday', 0.7], ['on tuesday', 0.7], ['on wednesday', 0.7], ['on thursday', 0.7],
    ['on friday', 0.7], ['on saturday', 0.7], ['on sunday', 0.7], ['end of day', 1.0],
    ['after work', 0.8], ['day after tomorrow', 1.0],
    ['call', 0.8], ['email', 0.8], ['text', 0.4], ['message', 0.5], ['pick up', 0.7],
    ['book', 0.5], ['schedule', 0.6], ['submit', 0.8], ['pay', 0.7], ['send', 0.7],
    ['reply', 0.7], ['return', 0.5], ['renew', 0.8], ['cancel', 0.8], ['transfer', 0.6],
    ['clean', 0.4], ['fix', 0.5], ['apologize', 0.8], ['ask', 0.4], ['drop', 0.5], ['carry', 0.6],
    ['water the', 0.8], ['lock the', 0.8], ['prepare', 0.6], ['review', 0.5],
  ],
  shopping: [
    ['buy', 1.5], ['groceries', 2.0], ['grocery', 2.0], ['shopping list', 2.5], ['shopping', 0.8],
    ['out of', 1.0], ["we're out", 1.5], ['ran out', 1.5], ['running low', 2.0], ['purchase', 1.5],
    ['amazon', 0.8], ['blinkit', 1.5], ['zepto', 1.5], ['bigbasket', 1.5], ['instamart', 1.5],
    ['we need', 0.8], ['grab some', 1.2], ['pick up some', 1.2], ['need more', 0.6],
  ],
  skill: [
    ['learn', 1.5], ['learning', 1.5], ['practice', 1.5], ['practicing', 1.5],
    ['practiced', 1.5], ['get better at', 2.0], ['getting better at', 2.0],
    ['improve my', 1.5], ['improving', 1.0], ['skill', 1.5], ['skills', 1.5],
    ['course', 1.0], ['lesson', 1.0], ['class', 0.6], ['tutorial', 1.0], ['study', 1.0],
    ['studying', 1.0], ['master', 1.0], ['get good at', 2.0], ['work on my', 1.2],
    ['working on my', 1.2], ['how to', 0.5], ['get into', 0.6], ['revise', 0.8],
  ],
  goal: [
    ['goal', 2.0], ['goals', 2.0], ['dream', 2.0], ['someday', 2.0], ['one day', 1.5],
    ['eventually', 1.5], ['long term', 1.5], ['aspire', 2.0], ['years', 1.0],
    ['decade', 1.5], ['by next year', 1.5], ['this year', 0.8], ['before i turn', 1.5],
    ["i'd love to", 0.7], ['hope to', 0.8], ['become', 1.0], ['future', 1.0],
    ['plan is', 1.0], ['retire', 1.0], ['vision', 1.0], ['be able to', 0.8],
    ['want to be', 0.6], ['more often', 0.6], ['every month', 0.4], ['cut down', 1.5], ['cut back', 1.5],
    ['quit', 1.0], ['give up', 1.0],
  ],
};

const SKILL_VERBS = new Set(['learn', 'practice', 'practise', 'study', 'revise']);

/** Common past-tense verbs that open a recap ("Called mom", "Went to the gym"). */
const PAST_OPENERS = new Set([
  'went', 'had', 'did', 'made', 'took', 'got', 'saw', 'ate', 'met', 'spent', 'felt', 'was', 'were',
  'came', 'left', 'slept', 'woke', 'bought', 'paid', 'sent', 'told', 'gave', 'found', 'thought',
  'heard', 'read', 'ran', 'drove', 'wrote', 'fought', 'kept', 'brought', 'caught', 'taught',
  'already', 'finally', 'just',
]);
const MODALS = /\b(need|needs|have to|has to|got to|gotta|should|must|will|i'll|want|wanna|going to|gonna|remind|remember|don't forget|plan|hope|someday|eventually|goal|dream)\b/;
const OTHER_PEOPLE = new Set(['she', "she's", 'he', "he's", 'they', "they're", 'her', 'his', 'their']);
/** Cues that a sentence is a recap, a feeling or someone else's news rather than something to track. */
function noneScore(text: string): number {
  const tokens = contentWords(text);
  if (tokens.length === 0) return 3;
  const first = tokens[0];
  const padded = ` ${tokens.join(' ')} `;
  let score = 0;
  const hasModal = MODALS.test(padded);
  if (!hasModal && (PAST_OPENERS.has(first) || (first.endsWith('ed') && first.length > 4))) score += 1.5;
  if (first === 'i' && tokens[1] && (PAST_OPENERS.has(tokens[1]) || tokens[1].endsWith('ed')) && !hasModal) score += 1.0;
  if (OTHER_PEOPLE.has(first)) score += 1.5;
  const imperative = ACTION_VERBS.has(first) || SKILL_VERBS.has(first);
  if (tokens.length <= 3 && !hasModal && !imperative) score += 0.8;
  if (/ (i think|i guess|i feel|feeling|felt|grateful|honestly|lol|haha) /.test(padded)) score += 0.5;
  return score;
}

/** Sum of matched cue weights per kind. */
export function ruleScores(text: string): Scores {
  const tokens = words(text);
  const padded = ` ${tokens.join(' ')} `;
  const result = emptyScores();
  for (const kind of ['task', 'shopping', 'skill', 'goal'] as const) {
    for (const [phrase, weight] of CUES[kind]) {
      if (padded.includes(` ${phrase} `)) result[kind] += weight;
    }
  }
  // Grocery and household words ("milk", "atta", "toilet paper") lean towards shopping.
  const cuttingBack = /\b(cut down|cut back|less|quit|stop|avoid|reduce|no more|give up)\b/.test(padded);
  if (!cuttingBack && tokens.some((t, i) => isShoppingItem(t) || isShoppingItem(`${t} ${tokens[i + 1] ?? ''}`))) result.shopping += 1.0;
  // An instruction that opens with a verb: "Carry the documents", "Revise SQL".
  const first = contentWords(text)[0] ?? '';
  if (SKILL_VERBS.has(first)) result.skill += 1.0;
  else if (ACTION_VERBS.has(first)) result.task += 1.0;
  result.none = noneScore(text);
  return result;
}

/** Scores as a distribution. "none" gets a base weight, so cue-less sentences lean to "none". */
export function ruleDistribution(text: string): Scores {
  const raw = ruleScores(text);
  raw.none += 1;
  const total = raw.task + raw.shopping + raw.skill + raw.goal + raw.none;
  return {
    task: raw.task / total,
    shopping: raw.shopping / total,
    skill: raw.skill / total,
    goal: raw.goal / total,
    none: raw.none / total,
  };
}
