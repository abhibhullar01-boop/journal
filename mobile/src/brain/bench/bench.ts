import type { JournalAnalyzer } from '../analyzer';
import type { ExtractedInsight, InsightKind } from '../types';

/** One hand-labelled journal entry and what should come out of it. */
export interface BenchEntry {
  text: string;
  items: { kind: InsightKind; must: string[]; due: string | null }[];
}

export interface BenchResult {
  expected: number;
  predicted: number;
  matched: number;
  precision: number;
  recall: number;
  f1: number;
  /** Matched tasks whose reminder time is right (including correctly having none). */
  dueCorrect: number;
  dueTotal: number;
  problems: string[];
}

function localIso(date: Date | null): string | null {
  if (!date) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Scores whole-entry extraction: did it find each expected item (right kind, title containing
 * the key words), did it invent extra ones, and are reminder times right.
 */
export function runBench(analyzer: JournalAnalyzer, entries: BenchEntry[], now: Date): BenchResult {
  let expected = 0;
  let predicted = 0;
  let matched = 0;
  let dueCorrect = 0;
  let dueTotal = 0;
  const problems: string[] = [];

  for (const entry of entries) {
    const found: ExtractedInsight[] = analyzer.analyze(entry.text, now);
    const unused = new Set(found.map((_, i) => i));
    expected += entry.items.length;
    predicted += found.length;

    for (const want of entry.items) {
      const index = [...unused].find((i) => {
        const title = found[i].title.toLowerCase();
        return found[i].kind === want.kind && want.must.every((w) => title.includes(w.toLowerCase()));
      });
      if (index === undefined) {
        const sameWords = found.find((f) => want.must.every((w) => f.title.toLowerCase().includes(w.toLowerCase())));
        problems.push(
          sameWords
            ? `WRONG KIND  expected ${want.kind}, got ${sameWords.kind}: "${sameWords.title}"`
            : `MISSED      ${want.kind} [${want.must.join(' ')}] in: ${entry.text.slice(0, 70)}…`,
        );
        continue;
      }
      unused.delete(index);
      matched++;
      if (want.kind === 'task') {
        dueTotal++;
        const got = localIso(found[index].dueDate);
        if (got === want.due) dueCorrect++;
        else problems.push(`WRONG TIME  "${found[index].title}": expected ${want.due ?? 'none'}, got ${got ?? 'none'}`);
      }
    }
    for (const i of unused) {
      problems.push(`EXTRA       ${found[i].kind}: "${found[i].title}"  (from: ${found[i].sentence})`);
    }
  }

  const precision = predicted ? matched / predicted : 1;
  const recall = expected ? matched / expected : 1;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { expected, predicted, matched, precision, recall, f1, dueCorrect, dueTotal, problems };
}

export function benchSummary(r: BenchResult): string {
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  return [
    `Items found: ${r.matched}/${r.expected} (recall ${pct(r.recall)}), precision ${pct(r.precision)}, F1 ${pct(r.f1)}`,
    `Reminder times right: ${r.dueCorrect}/${r.dueTotal}`,
    ...r.problems.map((p) => `  ${p}`),
  ].join('\n');
}
