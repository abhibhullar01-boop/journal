import seedEvaluation from './data/seed_evaluation.json';
import seedTraining from './data/seed_training.json';
import seedWeights from './data/model_weights.json';
import { dueDateIn } from './dueDate';
import { ModelWeights, SoftmaxModel } from './softmax';
import { ruleDistribution } from './rules';
import { mentionsOnlyIntangibles, shoppingItems } from './shopping';
import { contentWords } from './tokenizer';
import { splitSentences } from './splitter';
import { titleFor } from './titles';
import { ALL_KINDS, Classification, emptyScores, ExtractedInsight, InsightKind, LabeledSentence } from './types';

const BACK_REFERENCES = new Set(['it', "it's", 'its', 'that', "that's", 'this', 'which', 'they', "they're"]);

/** True for sentences that start by pointing back at something already said. */
function refersBack(sentence: string): boolean {
  return BACK_REFERENCES.has(contentWords(sentence)[0] ?? '');
}

export const SEED_TRAINING = seedTraining as LabeledSentence[];
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

  /** Trains the starting model from the seed data. Used by `npm run train`. */
  static trainFromSeed(): JournalAnalyzer {
    const model = new SoftmaxModel();
    model.train(SEED_TRAINING);
    return new JournalAnalyzer(model);
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
    for (const sentence of splitSentences(entry)) {
      const classification = this.classify(sentence);
      let { kind } = classification;
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
      result.push({ kind, title: titleFor(sentence), sentence, confidence, dueDate });
    }
    return result;
  }

  /** Teach it the right answer for a sentence (a fix, or a confirmation). */
  learn(sentence: string, kind: InsightKind): void {
    this.model.learn(sentence, kind, JournalAnalyzer.correctionWeight);
    this.corrections.push({ text: sentence, label: kind });
  }

  toJSON(): AnalyzerState {
    return { version: 2, corrections: this.corrections };
  }

  /** Rebuilds the model from saved corrections. Older saved formats start fresh from the baseline. */
  static fromJSON(state: Partial<AnalyzerState> | null | undefined, base?: JournalAnalyzer): JournalAnalyzer {
    const analyzer = base ?? JournalAnalyzer.baseline();
    if (state?.version === 2) for (const c of state.corrections ?? []) analyzer.learn(c.text, c.label);
    return analyzer;
  }
}
