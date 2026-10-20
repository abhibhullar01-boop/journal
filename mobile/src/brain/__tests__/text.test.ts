/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { features, shoppingItems, splitSentences, titleFor, words } from '../index';

test('tokenizer', () => {
  assert.deepEqual(words('Don’t forget: call Mom!'), ["don't", 'forget', 'call', 'mom']);
  assert.deepEqual(features('so need to go'), ['so', 'need', 'to', 'go', 'so need', 'need to', 'to go', '^need', '^need to', '#short']);
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

test('splits instructions joined by commas, "and" and "then"', () => {
  assert.deepEqual(splitSentences('Meeting with the bank at 10:30 tomorrow, carry the documents'), [
    'Meeting with the bank at 10:30 tomorrow', 'carry the documents',
  ]);
  assert.deepEqual(splitSentences('need to email HR about leave next week and ask Neha for the report'), [
    'need to email HR about leave next week', 'ask Neha for the report',
  ]);
  assert.deepEqual(splitSentences('Note to self, renew the car insurance'), ['Note to self, renew the car insurance']);
});

test('shopping items', () => {
  assert.deepEqual(shoppingItems('groceries, we need eggs bread and atta'), ['Eggs', 'Bread', 'Atta']);
  assert.deepEqual(shoppingItems('Buy a new phone charger, mine broke'), ['New phone charger']);
  assert.deepEqual(shoppingItems('order peanut butter and olive oil on Amazon'), ['Peanut butter', 'Olive oil']);
  assert.deepEqual(shoppingItems('Milk is finished'), ['Milk']);
  assert.deepEqual(shoppingItems('I should cut down on coffee'), []);
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
