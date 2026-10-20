/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dueDateIn } from '../index';

// Local time, so it passes in any time zone. Wednesday 15 October 2025, 10:30.
const at = (y: number, mo: number, d: number, h: number, mi = 0) => new Date(y, mo - 1, d, h, mi);
const now = at(2025, 10, 15, 10, 30);
const due = (s: string) => dueDateIn(s, now)?.getTime() ?? null;

test('no time cue', () => {
  assert.equal(due('I need to buy milk'), null);
});

test('relative days', () => {
  assert.equal(due('Call mom tomorrow'), at(2025, 10, 16, 9).getTime());
  assert.equal(due('Call mom tomorrow evening'), at(2025, 10, 16, 19).getTime());
  assert.equal(due('Finish the laundry tonight'), at(2025, 10, 15, 19).getTime());
  assert.equal(due('Pay the bill this afternoon'), at(2025, 10, 15, 14).getTime());
  assert.equal(due('Back up my laptop first thing in the morning'), at(2025, 10, 16, 8).getTime());
});

test('weekdays and weeks', () => {
  assert.equal(due('Submit the report by Friday'), at(2025, 10, 17, 9).getTime());
  assert.equal(due('Renew the permit on Monday'), at(2025, 10, 20, 9).getTime());
  assert.equal(due('Clean the garage this weekend'), at(2025, 10, 18, 10).getTime());
  assert.equal(due('Schedule a call next week'), at(2025, 10, 20, 9).getTime());
  assert.equal(due('Team sync on Wednesday'), at(2025, 10, 22, 9).getTime());
});

test('clock times', () => {
  assert.equal(due('Pick up the kids at 3'), at(2025, 10, 15, 15).getTime());
  assert.equal(due('Dentist at 4:30 pm tomorrow'), at(2025, 10, 16, 16, 30).getTime());
  assert.equal(due('Meeting at 11 tomorrow'), at(2025, 10, 16, 11).getTime());
  assert.equal(due('Call the bank at 9 a.m. on Friday'), at(2025, 10, 17, 9).getTime());
  assert.equal(due('Gym at 7pm'), at(2025, 10, 15, 19).getTime());
  assert.equal(due('Take vitamins at 8 am'), at(2025, 10, 16, 8).getTime());
});

test('"today" in the past becomes an hour from now', () => {
  const late = at(2025, 10, 15, 18);
  assert.equal(dueDateIn('Send the invoice later today', late)?.getTime(), late.getTime() + 3600_000);
});

test('more spoken time phrases', () => {
  // now = Wednesday 15 Oct 2025, 10:30
  assert.equal(due('Dentist day after tomorrow at 11'), at(2025, 10, 17, 11).getTime());
  assert.equal(due('Call the plumber in 2 hours'), now.getTime() + 2 * 3600_000);
  assert.equal(due('Ping Ravi in half an hour'), now.getTime() + 30 * 60_000);
  assert.equal(due('Transfer rent on the 1st'), at(2025, 11, 1, 9).getTime());
  assert.equal(due('Submit the GST return by the 25th'), at(2025, 10, 25, 9).getTime());
  assert.equal(due('Renew the insurance before the end of the month'), at(2025, 10, 31, 9).getTime());
  assert.equal(due('Call Ravi uncle after work'), at(2025, 10, 15, 18).getTime());
  assert.equal(due('Pay the bill today'), at(2025, 10, 15, 17).getTime());
  assert.equal(due('Call Airtel in the afternoon'), at(2025, 10, 15, 14).getTime());
  assert.equal(due('Dinner with Priya tonight at 8'), at(2025, 10, 15, 20).getTime());
  assert.equal(due('Yoga every Monday'), null);
});
