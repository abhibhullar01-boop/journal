/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { features, shoppingItems, splitSentences, taskTitle, titleFor, withoutWhen, words } from '../index';

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
    'need to email HR about leave next week', 'need to ask Neha for the report',
  ]);
  assert.deepEqual(splitSentences('Note to self, renew the car insurance'), ['Note to self, renew the car insurance']);
});

test('shopping items', () => {
  assert.deepEqual(shoppingItems('groceries, we need eggs bread and atta'), ['Eggs', 'Bread', 'Atta']);
  assert.deepEqual(shoppingItems('Buy a new phone charger, mine broke'), ['Phone charger']);
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

test('task titles leave the time to the reminder', () => {
  assert.equal(taskTitle('Um, I really need to call mom tomorrow.'), 'Call mom');
  assert.equal(taskTitle('Remind me to call mom about the trip tomorrow evening'), 'Call mom about the trip');
  assert.equal(taskTitle('Meeting with Alex at 10 tomorrow'), 'Meeting with Alex');
  assert.equal(taskTitle('Dentist appointment tomorrow at 4'), 'Dentist appointment');
  assert.equal(taskTitle('Pay the internet bill by Friday.'), 'Pay the internet bill');
  assert.equal(taskTitle('Pick up the kids at 4:30 pm'), 'Pick up the kids');
  assert.equal(taskTitle('Submit the report by end of day'), 'Submit the report');
  assert.equal(taskTitle('Pay rent on the 1st'), 'Pay rent');
  assert.equal(taskTitle('Remind me in 2 hours to take the clothes out'), 'Take the clothes out');
  // The reminder comes the day before, so the title keeps the day of the cab.
  assert.equal(taskTitle('Book the cab for Monday morning'), 'Book the cab for Monday morning');
  assert.equal(taskTitle('Call the bank tomorrow morning about the card'), 'Call the bank about the card');
  assert.equal(taskTitle('Flight to Delhi on 5 November'), 'Flight to Delhi');
  assert.equal(withoutWhen('Tomorrow'), 'Tomorrow', 'never empties a title');
  assert.equal(taskTitle('Return the jacket'), 'Return the jacket');
  assert.equal(taskTitle('Prepare notes before the meeting'), 'Prepare notes before the meeting');
});

test('run-on dictation keeps what belongs together', () => {
  // A want carries over to the next verb.
  assert.deepEqual(splitSentences('Long term I want to move back to Punjab and start a small farm'), [
    'Long term I want to move back to Punjab', 'Long term I want to start a small farm',
  ]);
  // A fragment that only says when goes back to its thought.
  assert.deepEqual(splitSentences('Need to get my blood test done, fasting, so tomorrow early morning before breakfast'), [
    'Need to get my blood test done, fasting, tomorrow early morning before breakfast',
  ]);
  // ", pay it" points back at what came before.
  assert.deepEqual(splitSentences('Water bill still pending, pay it by Friday'), ['Water bill still pending, pay it by Friday']);
  // A dictated schedule: one item per comma, and the day goes with each.
  assert.deepEqual(splitSentences('Tomorrow: gym at 7, standup at 10, dentist at 4'), [
    'Tomorrow gym at 7', 'standup at 10 tomorrow', 'dentist at 4 tomorrow',
  ]);
});

test('shopping lists in everyday speech', () => {
  assert.deepEqual(shoppingItems('ok so groceries for the week: atta, toor dal, bhindi, tamatar and some paneer'), [
    'Atta', 'Toor dal', 'Bhindi', 'Tamatar', 'Paneer',
  ]);
  assert.deepEqual(shoppingItems('Need a new phone cover and screen guard, the old one cracked'), ['Phone cover', 'Screen guard']);
  assert.deepEqual(shoppingItems("Order the cat food and litter on Amazon, Simba's almost out"), ['Cat food', 'Litter']);
  assert.deepEqual(shoppingItems("And we're out of toothpaste and dish soap"), ['Toothpaste', 'Dish soap']);
  assert.deepEqual(shoppingItems('need to stock up on snacks and cold drinks'), ['Snacks', 'Cold drinks']);
  assert.deepEqual(shoppingItems('Need to apologize to her tonight'), []);
  assert.deepEqual(shoppingItems('Also need to get her a nice saree'), ['Nice saree']);
});
