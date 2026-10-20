/// <reference types="node" />
import { JournalAnalyzer } from '../analyzer';
import { benchSummary, BenchEntry, runBench } from './bench';
import tuning from './eval_entries.json';
import holdout from './eval_entries_b.json';
import chat from './eval_entries_c.json';
import fresh from './eval_entries_d.json';

const analyzer = JournalAnalyzer.baseline();
for (const [name, set] of [['Tuning set (A)', tuning], ['Untouched set (B)', holdout], ['Chat set (C)', chat], ['Untouched chat set (D)', fresh]] as const) {
  console.log(`\n== ${name}: ${set.entries.length} entries ==`);
  console.log(benchSummary(runBench(analyzer, set.entries as BenchEntry[], new Date(set.now))));
}
