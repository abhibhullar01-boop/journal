import seedEvaluation from './data/seed_evaluation.json';
import seedTraining from './data/seed_training.json';
import { dueDateIn } from './dueDate';
import { NaiveBayesModel, NaiveBayesState } from './naiveBayes';
import { ruleDistribution } from './rules';
import { splitSentences } from './splitter';
import { titleFor } from './titles';
import { ALL_KINDS, Classification, emptyScores, ExtractedInsight, InsightKind, LabeledSentence } from './types';

export const SEED_TRAINING = seedTraining as LabeledSentence[];
/** Hand-written sentences the model never trains on. Used to measure accuracy. */
export const SEED_EVALUATION = seedEvaluation as LabeledSentence[];

export interface AnalyzerState {
  model: NaiveBayesState;
  ruleWeight: number;
  personalExamples: number;
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
    public model: NaiveBayesModel,
    /** How much the cue phrases count against the learned model (0 to 1). */
    public ruleWeight = 0.35,
    /** Number of corrections the user has taught it. */
    public personalExamples = 0,
  ) {}

  /** A fresh model trained on the bundled seed data. */
  static baseline(): JournalAnalyzer {
    const model = new NaiveBayesModel();
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
      const { kind, confidence } = this.classify(sentence);
      if (kind === 'none') continue;
      result.push({
        kind,
        title: titleFor(sentence),
        sentence,
        confidence,
        dueDate: kind === 'task' ? dueDateIn(sentence, now) : null,
      });
    }
    return result;
  }

  /** Teach it the right answer for a sentence (a fix, or a confirmation). */
  learn(sentence: string, kind: InsightKind): void {
    this.model.learn(sentence, kind, JournalAnalyzer.correctionWeight);
    this.personalExamples += 1;
  }

  toJSON(): AnalyzerState {
    return { model: this.model.toJSON(), ruleWeight: this.ruleWeight, personalExamples: this.personalExamples };
  }

  static fromJSON(state: AnalyzerState): JournalAnalyzer {
    return new JournalAnalyzer(NaiveBayesModel.fromJSON(state.model), state.ruleWeight, state.personalExamples);
  }
}
