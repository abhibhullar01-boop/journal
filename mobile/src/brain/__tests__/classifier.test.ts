/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BenchEntry, runBench } from '../bench/bench';
import holdout from '../bench/eval_entries_b.json';
import { evaluate, JournalAnalyzer, SEED_EVALUATION, SEED_TRAINING, summary } from '../index';

const analyzer = JournalAnalyzer.baseline();

test('seed data loads and never overlaps the test set', () => {
  assert.ok(SEED_TRAINING.length > 4000);
  assert.equal(SEED_EVALUATION.length, 86);
  const train = new Set(SEED_TRAINING.map((s) => s.text));
  assert.ok(SEED_EVALUATION.every((s) => !train.has(s.text)));
});

test('baseline stays accurate on sentences it never saw', () => {
  const report = evaluate(analyzer, SEED_EVALUATION);
  console.log(summary(report));
  assert.ok(report.accuracy >= 0.9, `accuracy ${report.accuracy}`);
  for (const [kind, s] of Object.entries(report.perKind)) {
    assert.ok(s.correct / s.total >= 0.75, kind);
  }
});

test('classifies typical sentences', () => {
  assert.equal(analyzer.classify('I need to call the dentist tomorrow').kind, 'task');
  assert.equal(analyzer.classify('I want to get better at public speaking').kind, 'skill');
  assert.equal(analyzer.classify('Someday I want to run a marathon').kind, 'goal');
  assert.equal(analyzer.classify('I felt really calm after my walk').kind, 'none');
  assert.equal(analyzer.classify("We're out of milk").kind, 'shopping');
  assert.equal(analyzer.classify('Called mom, she sounds better').kind, 'none');
  assert.equal(analyzer.classify('Carry the documents').kind, 'task');
});

test('shopping lists become one item per thing', () => {
  const insights = analyzer.analyze('pick up the kids at 3 then groceries, we need eggs bread and atta');
  assert.deepEqual(insights.map((i) => [i.kind, i.title]), [
    ['task', 'Pick up the kids at 3'], ['shopping', 'Eggs'], ['shopping', 'Bread'], ['shopping', 'Atta'],
  ]);
  assert.deepEqual(analyzer.analyze('Maybe I need more sleep.'), []);
});

test('scores well on whole journal entries it never trained on', () => {
  const now = new Date(holdout.now);
  const result = runBench(analyzer, holdout.entries as BenchEntry[], now);
  assert.ok(result.f1 >= 0.8, `F1 ${result.f1}`);
  assert.equal(result.dueCorrect, result.dueTotal);
});

test('analyzes run-on dictation', () => {
  const entry = 'Today was busy and I need to email Sarah tomorrow and I want to learn Spanish and my goal is to move to Spain in five years';
  const insights = analyzer.analyze(entry);
  assert.deepEqual(insights.map((i) => i.kind), ['task', 'skill', 'goal']);
  assert.equal(insights[0].title, 'Email Sarah tomorrow');
  assert.ok(insights[0].dueDate);
  assert.equal(insights[2].dueDate, null);
});

test('short fragments and "and someday" clauses', () => {
  const entry = 'Long day. I need to email Sarah tomorrow at 10 and I want to get better at public speaking and someday I want to run a marathon.';
  const insights = analyzer.analyze(entry);
  assert.deepEqual(insights.map((i) => i.kind), ['task', 'skill', 'goal']);
  assert.deepEqual(insights.map((i) => i.title), ['Email Sarah tomorrow at 10', 'Public speaking', 'Run a marathon']);
});

test('corrections personalize the model', () => {
  const personal = JournalAnalyzer.fromJSON(JSON.parse(JSON.stringify(analyzer.toJSON())));
  const sentence = 'Gym session with coach Mike';
  for (let i = 0; i < 3; i++) personal.learn(sentence, 'skill');
  assert.equal(personal.classify(sentence).kind, 'skill');
  assert.equal(personal.personalExamples, 3);
  assert.equal(personal.classify('I need to pay rent tomorrow').kind, 'task');
  // The baseline copy is untouched.
  assert.equal(analyzer.personalExamples, 0);
});

test('model round-trips through JSON', () => {
  const personal = JournalAnalyzer.baseline();
  personal.learn('Climbing session at the wall', 'skill');
  const restored = JournalAnalyzer.fromJSON(JSON.parse(JSON.stringify(personal)));
  assert.deepEqual(restored.classify('Climbing session at the wall'), personal.classify('Climbing session at the wall'));
  assert.equal(restored.personalExamples, 1);
});

test('bundled model weights are up to date with the seed data (run `npm run train` if this fails)', () => {
  const fresh = JournalAnalyzer.trainFromSeed().model.exportWeights();
  const bundled = analyzer.model.exportWeights();
  assert.equal(Object.keys(bundled.weights).length, Object.keys(fresh.weights).length);
  const retrained = JournalAnalyzer.trainFromSeed();
  for (const s of SEED_EVALUATION) assert.equal(analyzer.classify(s.text).kind, retrained.classify(s.text).kind, s.text);
});

test('chat messages: questions and requests to the companion are not saved as items', async () => {
  const sets = [await import('../bench/eval_entries_c.json'), await import('../bench/eval_entries_d.json')];
  for (const set of sets) {
    const data = (set as any).default ?? set;
    const result = runBench(analyzer, data.entries as BenchEntry[], new Date(data.now));
    assert.ok(result.f1 >= 0.9, `F1 ${result.f1}: ${result.problems.join('; ')}`);
    assert.equal(result.dueCorrect, result.dueTotal, result.problems.join('; '));
  }
  for (const ask of ['What should I cook tonight?', 'find me running shoes under 5000', 'thanks!', 'Help me plan my day', 'Should I take the job?']) {
    assert.deepEqual(analyzer.analyze(ask), [], ask);
  }
  const [reminder] = analyzer.analyze('hey can you remind me to call the electrician tomorrow at 10');
  assert.equal(reminder.title, 'Call the electrician tomorrow at 10');
  assert.deepEqual(analyzer.analyze('add paneer and curd to my list').map((i) => i.title), ['Paneer', 'Curd']);
});
