import { features } from './tokenizer';
import { ALL_KINDS, emptyScores, InsightKind, LabeledSentence, Scores } from './types';

/**
 * A small multinomial Naive Bayes text model. Cheap enough to retrain on the phone
 * every time the user corrects a label, and its state is plain counts, so it saves as JSON.
 */
export interface NaiveBayesState {
  exampleWeight: Record<string, number>;
  featureCounts: Record<string, Record<string, number>>;
  totalFeatures: Record<string, number>;
  vocabulary: string[];
}

export class NaiveBayesModel {
  exampleWeight: Record<string, number> = {};
  private featureCounts: Record<string, Record<string, number>> = {};
  private totalFeatures: Record<string, number> = {};
  private vocabulary = new Set<string>();
  smoothing = 1;

  get vocabularySize(): number {
    return this.vocabulary.size;
  }

  train(samples: LabeledSentence[]): void {
    for (const sample of samples) this.learn(sample.text, sample.label);
  }

  /** Adds one example. Weight above 1 lets the user's corrections take over from the seed data. */
  learn(text: string, kind: InsightKind, weight = 1): void {
    this.exampleWeight[kind] = (this.exampleWeight[kind] ?? 0) + weight;
    const counts = (this.featureCounts[kind] ??= {});
    for (const feature of features(text)) {
      counts[feature] = (counts[feature] ?? 0) + weight;
      this.totalFeatures[kind] = (this.totalFeatures[kind] ?? 0) + weight;
      this.vocabulary.add(feature);
    }
  }

  /**
   * Probability of each kind. Priors are uniform on purpose, so a burst of corrections
   * in one category doesn't make every sentence lean that way.
   */
  probabilities(text: string): Scores {
    const fs = features(text);
    const vocabularyCount = this.vocabulary.size + 1;
    const logScores = emptyScores();
    for (const kind of ALL_KINDS) {
      const counts = this.featureCounts[kind] ?? {};
      const total = this.totalFeatures[kind] ?? 0;
      let score = 0;
      for (const f of fs) {
        score += Math.log(((counts[f] ?? 0) + this.smoothing) / (total + this.smoothing * vocabularyCount));
      }
      logScores[kind] = score;
    }
    const max = Math.max(...ALL_KINDS.map((k) => logScores[k]));
    const result = emptyScores();
    let sum = 0;
    for (const kind of ALL_KINDS) {
      result[kind] = Math.exp(logScores[kind] - max);
      sum += result[kind];
    }
    for (const kind of ALL_KINDS) result[kind] /= sum;
    return result;
  }

  toJSON(): NaiveBayesState {
    return {
      exampleWeight: this.exampleWeight,
      featureCounts: this.featureCounts,
      totalFeatures: this.totalFeatures,
      vocabulary: [...this.vocabulary],
    };
  }

  static fromJSON(state: NaiveBayesState): NaiveBayesModel {
    const model = new NaiveBayesModel();
    model.exampleWeight = { ...state.exampleWeight };
    model.featureCounts = JSON.parse(JSON.stringify(state.featureCounts));
    model.totalFeatures = { ...state.totalFeatures };
    model.vocabulary = new Set(state.vocabulary);
    return model;
  }
}
