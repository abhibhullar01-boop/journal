/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluate, JournalAnalyzer, SEED_EVALUATION, SEED_TRAINING, summary } from '../index';

const analyzer = JournalAnalyzer.baseline();

test('seed data loads and never overlaps the test set', () => {
  assert.ok(SEED_TRAINING.length > 500);
  assert.equal(SEED_EVALUATION.length, 80);
  const train = new Set(SEED_TRAINING.map((s) => s.text));
  assert.ok(SEED_EVALUATION.every((s) => !train.has(s.text)));
});

test('baseline stays accurate on sentences it never saw', () => {
  const report = evaluate(analyzer, SEED_EVALUATION);
  console.log(summary(report));
  assert.ok(report.accuracy >= 0.85, `accuracy ${report.accuracy}`);
  for (const [kind, s] of Object.entries(report.perKind)) {
    assert.ok(s.correct / s.total >= 0.75, kind);
  }
});

test('classifies typical sentences', () => {
  assert.equal(analyzer.classify('I need to call the dentist tomorrow').kind, 'task');
  assert.equal(analyzer.classify('I want to get better at public speaking').kind, 'skill');
  assert.equal(analyzer.classify('Someday I want to run a marathon').kind, 'goal');
  assert.equal(analyzer.classify('I felt really calm after my walk').kind, 'none');
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
