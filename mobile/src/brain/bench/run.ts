/// <reference types="node" />
// Scores whole journal entries against hand-labelled sets.
//   npm run bench            (every set)
//   npm run bench -- A E     (only the sets named)
import { JournalAnalyzer } from '../analyzer';
import { benchSummary, BenchEntry, runBench } from './bench';
import tuning from './eval_entries.json';
import holdout from './eval_entries_b.json';
import chat from './eval_entries_c.json';
import fresh from './eval_entries_d.json';
import everyday from './eval_entries_e.json';
import everydayHoldout from './eval_entries_f.json';

const SETS = [
  ['A', 'Tuning set', tuning],
  ['B', 'Untouched set', holdout],
  ['C', 'Chat set', chat],
  ['D', 'Untouched chat set', fresh],
  ['E', 'Everyday set', everyday],
  ['F', 'Everyday holdout set', everydayHoldout],
] as const;

const wanted = process.argv.slice(2).map((s) => s.toUpperCase());
const analyzer = JournalAnalyzer.baseline();
for (const [letter, name, set] of SETS) {
  if (wanted.length && !wanted.includes(letter)) continue;
  console.log(`\n== ${name} (${letter}): ${set.entries.length} entries ==`);
  console.log(benchSummary(runBench(analyzer, set.entries as BenchEntry[], new Date(set.now))));
}
