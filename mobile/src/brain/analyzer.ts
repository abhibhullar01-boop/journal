import seedEvaluation from './data/seed_evaluation.json';
import seedWeights from './data/model_weights.json';
import { dueDateIn } from './dueDate';
import { ModelWeights, SoftmaxModel } from './softmax';
import { isCompanionRequest, ruleDistribution } from './rules';
import { mentionsOnlyIntangibles, shoppingItems } from './shopping';
import { contentWords } from './tokenizer';
import { punctuationChunks, splitRunOn } from './splitter';
import { titleFor, withoutWhen } from './titles';
import { ALL_KINDS, Classification, emptyScores, ExtractedInsight, InsightKind, LabeledSentence } from './types';

/** A specific, near time: tomorrow, tonight, a weekday or a clock time. */
const SOON = /\b(tomorrow|tonight|this (afternoon|evening)|(on|for) (monday|tuesday|wednesday|thursday|friday|saturday|sunday)|at \d|\d ?(am|pm))\b/;

const BACK_REFERENCES = new Set(['it', "it's", 'its', 'that', "that's", 'this', 'which', 'they', "they're"]);

const GOAL_LEAD = /^(.*?\b(?:want to|wants to|love to|like to|hope to|plan to|planning to|goal is to|dream is to|plan is to|aim is to|going to|gonna|wanna))\s/;

/** True when both sentences open with the same want ("Long term I want to ..."), as the splitter leaves them. */
function sameLeadIn(a: string, b: string): boolean {
  const lead = GOAL_LEAD.exec(a.toLowerCase())?.[1];
  return lead !== undefined && lead === GOAL_LEAD.exec(b.toLowerCase())?.[1];
}

/** Three or more known things to buy, listed after a colon or a shopping word. */
function looksLikeShoppingList(sentence: string): boolean {
  const lower = sentence.toLowerCase();
  if (!/:|\b(grocery|groceries|shopping|buy|get|order|need|out of|low on)\b/.test(lower)) return false;
  if (/^\s*(bought|got|picked|ordered|we bought|i bought)\b/.test(lower)) return false;
  return shoppingItems(sentence).length >= 3;
}

/** True for sentences that start by pointing back at something already said. */
function refersBack(sentence: string): boolean {
  return BACK_REFERENCES.has(contentWords(sentence)[0] ?? '');
}

/** How many example sentences the bundled model was trained on. */
export const SEED_SIZE = (seedWeights as ModelWeights).examples ?? 0;
/** Hand-written sentences the model never trains on. Used to measure accuracy. */
export const SEED_EVALUATION = seedEvaluation as LabeledSentence[];

/** What gets saved on the phone: just the user's corrections. The model is rebuilt from them. */
export interface AnalyzerState {
  version: 2;
  corrections: LabeledSentence[];
}

/**
 * The brain of the app: splits an entry into sentences, classifies each one as a task,
 * skill, goal or reflection, and pulls out titles and reminder times.
 *
 * It blends a Naive Bayes model trained on seed sentences (and later on the user's own
 * corrections) with hand-written cue phrases that keep it sensible on unfamiliar phrasing.
 */
export class JournalAnalyzer {
  /** Corrections count this many times more than a seed sentence. */
  static correctionWeight = 3;

  constructor(
    public model: SoftmaxModel,
    /** How much the cue phrases count against the learned model (0 to 1). */
    public ruleWeight = 0.35,
  ) {}

  /** Sentences the user has taught it (fixes and confirmations), oldest first. */
  corrections: LabeledSentence[] = [];

  get personalExamples(): number {
    return this.corrections.length;
  }

  /** The starting model, trained on the seed data ahead of time (`npm run train`). */
  static baseline(): JournalAnalyzer {
    return new JournalAnalyzer(SoftmaxModel.fromWeights(seedWeights as ModelWeights));
  }

  classify(sentence: string): Classification {
    const learned = this.model.probabilities(sentence);
    const rules = ruleDistribution(sentence);
    const scores = emptyScores();
    for (const kind of ALL_KINDS) {
      scores[kind] = (1 - this.ruleWeight) * learned[kind] + this.ruleWeight * rules[kind];
    }
    let best: InsightKind = 'task';
    for (const kind of ALL_KINDS) if (scores[kind] > scores[best]) best = kind;
    return { kind: best, confidence: scores[best], scores };
  }

  /** Every trackable item in an entry, in the order it was said. */
  analyze(entry: string, now: Date = new Date()): ExtractedInsight[] {
    const result: ExtractedInsight[] = [];
    // A question or request to the companion is answered in the chat, not tracked. Its whole
    // sentence goes, including the context after a comma ("suggest dinner, we have eggs").
    const sentences = punctuationChunks(entry)
      .filter((chunk) => !isCompanionRequest(chunk))
      .flatMap(splitRunOn)
      .filter((s) => /[a-z]/i.test(s));
    for (const sentence of sentences) {
      const classification = this.classify(sentence);
      let { kind } = classification;
      // "Grocery run tomorrow: onions, tomatoes, ginger" is a shopping list, whatever else it says.
      if (kind !== 'shopping' && looksLikeShoppingList(sentence)) kind = 'shopping';
      const { confidence, scores } = classification;
      let items: string[] = [];
      if (kind === 'shopping') {
        items = shoppingItems(sentence);
        if (!items.length) {
          if (mentionsOnlyIntangibles(sentence)) continue; // "need more sleep": nothing to buy
          // Nothing to buy after all ("order it around 7"): use the next best reading.
          kind = (['task', 'skill', 'goal', 'none'] as InsightKind[]).reduce((a, b) => (scores[b] > scores[a] ? b : a));
        }
      }
      if (kind === 'none') continue;
      // "Practice it once tomorrow", "revise SQL tonight": a skill on a set day is something to do.
      if (kind === 'skill' && SOON.test(` ${sentence.toLowerCase()} `) && dueDateIn(sentence, now)) kind = 'task';
      // "It's slow but I'm getting better" refers back to the last thing said; it's not a new item.
      if ((kind === 'skill' || kind === 'goal') && refersBack(sentence)) continue;
      const dueDate = kind === 'task' || kind === 'shopping' ? dueDateIn(sentence, now) : null;
      if (kind === 'shopping') {
        // One item per thing to buy, so each can be ticked off on its own.
        for (const title of items) {
          result.push({ kind, title, sentence, confidence, dueDate: items.length > 1 ? null : dueDate });
        }
        continue;
      }
      // The reminder shows the time, so a task's title leaves it out ("Call mom", not "Call mom tomorrow at 5").
      const title = kind === 'task' && dueDate ? withoutWhen(titleFor(sentence)) : titleFor(sentence);
      // "Long term I want to move back to Punjab and start a farm" is one dream, said in two parts.
      const last = result[result.length - 1];
      if (kind === 'goal' && last?.kind === 'goal' && sameLeadIn(last.sentence, sentence)) {
        last.title = `${last.title} and ${title[0].toLowerCase()}${title.slice(1)}`;
        last.sentence = `${last.sentence} and ${sentence}`;
        continue;
      }
      result.push({ kind, title, sentence, confidence, dueDate });
    }
    return result;
  }

  /** Most examples kept on the phone; the oldest go first. */
  static maxCorrections = 3000;

  /**
   * Teach it the right answer for a sentence: a fix or confirmation from the user
   * (counts 3x by default), or a label from Claude (weight 1), so it keeps getting better offline.
   */
  learn(sentence: string, kind: InsightKind, weight = JournalAnalyzer.correctionWeight): void {
    this.model.learn(sentence, kind, weight);
    this.corrections.push({ text: sentence, label: kind, weight });
    if (this.corrections.length > JournalAnalyzer.maxCorrections) this.corrections.shift();
  }

  toJSON(): AnalyzerState {
    return { version: 2, corrections: this.corrections };
  }

  /** Rebuilds the model from saved corrections. Older saved formats start fresh from the baseline. */
  static fromJSON(state: Partial<AnalyzerState> | null | undefined, base?: JournalAnalyzer): JournalAnalyzer {
    const analyzer = base ?? JournalAnalyzer.baseline();
    if (state?.version === 2) for (const c of state.corrections ?? []) analyzer.learn(c.text, c.label, c.weight);
    return analyzer;
  }
}
