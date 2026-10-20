import type { JournalAnalyzer } from './analyzer';
import { ALL_KINDS, InsightKind, KIND_LABEL, LabeledSentence } from './types';

export interface EvaluationReport {
  total: number;
  correct: number;
  accuracy: number;
  perKind: Record<InsightKind, { correct: number; total: number }>;
  misses: { text: string; expected: InsightKind; predicted: InsightKind }[];
}

export function evaluate(analyzer: JournalAnalyzer, samples: LabeledSentence[]): EvaluationReport {
  const perKind = Object.fromEntries(ALL_KINDS.map((k) => [k, { correct: 0, total: 0 }])) as EvaluationReport['perKind'];
  const misses: EvaluationReport['misses'] = [];
  let correct = 0;
  for (const sample of samples) {
    const predicted = analyzer.classify(sample.text).kind;
    perKind[sample.label].total++;
    if (predicted === sample.label) {
      perKind[sample.label].correct++;
      correct++;
    } else {
      misses.push({ text: sample.text, expected: sample.label, predicted });
    }
  }
  return { total: samples.length, correct, accuracy: samples.length ? correct / samples.length : 0, perKind, misses };
}

export function summary(report: EvaluationReport): string {
  const lines = [`Accuracy: ${(report.accuracy * 100).toFixed(1)}% (${report.correct}/${report.total})`];
  for (const kind of ALL_KINDS) {
    const s = report.perKind[kind];
    if (s.total) lines.push(`  ${KIND_LABEL[kind]}: ${s.correct}/${s.total}`);
  }
  for (const m of report.misses) lines.push(`  miss: expected ${m.expected}, got ${m.predicted}: ${m.text}`);
  return lines.join('\n');
}
