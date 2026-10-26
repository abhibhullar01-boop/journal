import { features } from './tokenizer';
import { ALL_KINDS, emptyScores, InsightKind, LabeledSentence, Scores } from './types';

/**
 * A small multinomial logistic regression ("softmax") text model over word and
 * word-pair features. It trains in well under a second on the phone, so the app
 * simply retrains it from the seed data plus the user's corrections at start-up.
 *
 * Unlike Naive Bayes it weighs features against each other, so "called mom" (a recap)
 * and "call mom" (a task) don't get confused just because they share "mom".
 */
export class SoftmaxModel {
  private weights = new Map<string, number[]>();
  private bias: number[] = ALL_KINDS.map(() => 0);
  /** Learning rate and L2 penalty for training. */
  learningRate = 0.3;
  l2 = 1e-3;
  /** Class biases make short, cue-less sentences lean to whichever class has the most of them. Off by default. */
  useBias = false;

  get vocabularySize(): number {
    return this.weights.size;
  }

  private row(feature: string): number[] {
    let w = this.weights.get(feature);
    if (!w) {
      w = ALL_KINDS.map(() => 0);
      this.weights.set(feature, w);
    }
    return w;
  }

  private logits(fs: string[]): number[] {
    const z = [...this.bias];
    for (const f of fs) {
      const w = this.weights.get(f);
      if (!w) continue;
      for (let k = 0; k < z.length; k++) z[k] += w[k];
    }
    return z;
  }

  private static softmax(z: number[]): number[] {
    const max = Math.max(...z);
    const e = z.map((v) => Math.exp(v - max));
    const sum = e.reduce((a, b) => a + b, 0);
    return e.map((v) => v / sum);
  }

  /** One gradient step on one example. */
  private step(fs: string[], label: number, rate: number): void {
    const p = SoftmaxModel.softmax(this.logits(fs));
    for (let k = 0; k < p.length; k++) {
      const g = p[k] - (k === label ? 1 : 0);
      if (this.useBias) this.bias[k] -= rate * g;
      for (const f of fs) {
        const w = this.row(f);
        w[k] -= rate * (g + this.l2 * w[k]);
      }
    }
  }

  /** Trains from scratch-or-onwards over the samples. Deterministic for the same input. */
  train(samples: LabeledSentence[], epochs = 10): void {
    const data = samples.map((s) => ({ fs: uniqueFeatures(s.text), label: ALL_KINDS.indexOf(s.label) }));
    const order = data.map((_, i) => i);
    let seed = 12345;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let epoch = 0; epoch < epochs; epoch++) {
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      const rate = this.learningRate / (1 + epoch * 0.5);
      for (const i of order) this.step(data[i].fs, data[i].label, rate);
    }
  }

  /** Learns one correction. Weight above 1 repeats the step so the fix sticks. */
  learn(text: string, kind: InsightKind, weight = 1): void {
    const fs = uniqueFeatures(text);
    const label = ALL_KINDS.indexOf(kind);
    for (let i = 0; i < weight * 4; i++) this.step(fs, label, this.learningRate);
  }

  /**
   * Compact, rounded weights for bundling with the app (see `npm run train`). Words whose weights
   * are all tiny are left out: it halves the file and changes no score on any test set.
   */
  exportWeights(): ModelWeights {
    const weights: Record<string, number[]> = {};
    const keys = [...this.weights.keys()].sort();
    for (const key of keys) {
      const w = this.weights.get(key)!;
      if (w.every((v) => Math.abs(v) < 0.05)) continue;
      weights[key] = w.map((v) => Math.round(v * 100) / 100);
    }
    return { kinds: [...ALL_KINDS], weights };
  }

  static fromWeights(data: ModelWeights): SoftmaxModel {
    const model = new SoftmaxModel();
    for (const [key, w] of Object.entries(data.weights)) {
      model.weights.set(key, ALL_KINDS.map((kind) => w[data.kinds.indexOf(kind)] ?? 0));
    }
    return model;
  }

  probabilities(text: string): Scores {
    const p = SoftmaxModel.softmax(this.logits(uniqueFeatures(text)));
    const result = emptyScores();
    ALL_KINDS.forEach((k, i) => (result[k] = p[i]));
    return result;
  }
}

export interface ModelWeights {
  kinds: string[];
  weights: Record<string, number[]>;
  /** How many sentences it was trained on. */
  examples?: number;
}

function uniqueFeatures(text: string): string[] {
  return [...new Set(features(text))];
}
