/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { features, splitSentences, titleFor, words } from '../index';

test('tokenizer', () => {
  assert.deepEqual(words('Don’t forget: call Mom!'), ["don't", 'forget', 'call', 'mom']);
  assert.deepEqual(features('need to go'), ['need', 'to', 'go', 'need to', 'to go']);
});

test('splits on punctuation', () => {
  assert.deepEqual(splitSentences('Long day. Need to call mom at 5 p.m. tomorrow! Was it fun? Yes'), [
    'Long day.', 'Need to call mom at 5 p.m. tomorrow!', 'Was it fun?', 'Yes',
  ]);
});

test('splits run-on dictation', () => {
  assert.deepEqual(splitSentences('I went to the gym and I need to buy milk but my goal is to run a marathon'), [
    'I went to the gym', 'I need to buy milk', 'my goal is to run a marathon',
  ]);
});

test('leaves short phrases alone', () => {
  assert.deepEqual(splitSentences('Salt and I agree'), ['Salt and I agree']);
});

test('titles', () => {
  assert.equal(titleFor('Um, I really need to call mom tomorrow.'), 'Call mom tomorrow');
  assert.equal(titleFor('I want to get better at public speaking'), 'Public speaking');
  assert.equal(titleFor('My goal is to run a marathon by next year.'), 'Run a marathon by next year');
  assert.equal(titleFor("Don't forget to water the plants"), 'Water the plants');
  assert.equal(titleFor('My long-term plan is to open a cafe'), 'Open a cafe');
  assert.equal(titleFor('Buy milk'), 'Buy milk');
});
