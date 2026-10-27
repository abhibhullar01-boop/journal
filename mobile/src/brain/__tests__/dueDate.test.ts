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

// A wide sweep of everyday phrasing, at two times of day. Tuesday 20 October 2026.
const sweep = (nowAt: Date, cases: [string, Date | null][]) => {
  for (const [phrase, want] of cases) {
    assert.equal(dueDateIn(phrase, nowAt)?.getTime() ?? null, want?.getTime() ?? null, `"${phrase}" at ${nowAt.getHours()}:00`);
  }
};

test('everyday phrasing in the morning', () => {
  const morning = at(2026, 10, 20, 9);
  sweep(morning, [
    ['call mom tomorrow night', at(2026, 10, 21, 19)],
    ['call mom later today', at(2026, 10, 20, 17)],
    ['call mom at 5.30 pm', at(2026, 10, 20, 17, 30)],
    ['call mom at 7 am', at(2026, 10, 21, 7)],
    ['call mom at 9 tonight', at(2026, 10, 20, 21)],
    ['call mom at 8 in the morning', at(2026, 10, 21, 8)],
    ['call mom at midnight', at(2026, 10, 20, 23, 59)],
    ['call mom in a couple of hours', at(2026, 10, 20, 11)],
    ['call mom in a few minutes', at(2026, 10, 20, 9, 5)],
    ['call mom in 10 mins', at(2026, 10, 20, 9, 10)],
    ['call mom Friday at 3', at(2026, 10, 23, 15)],
    ['call mom on Friday evening', at(2026, 10, 23, 19)],
    ['call mom on Tuesday', at(2026, 10, 27, 9)],
    ['call mom on the weekend', at(2026, 10, 24, 10)],
    ['call mom next month', at(2026, 11, 1, 9)],
    ['call mom by the end of the week', at(2026, 10, 23, 17)],
    ['call mom on November 5', at(2026, 11, 5, 9)],
    ['call mom on 5th Nov at 6 pm', at(2026, 11, 5, 18)],
    ['pay rent on the 1st of next month', at(2026, 11, 1, 9)],
    ['dentist on the 28th at 4', at(2026, 10, 28, 16)],
    ['call mom in 3 days', at(2026, 10, 23, 9)],
    ['call mom in a week', at(2026, 10, 27, 9)],
    ['book a follow up in three weeks', null],
    ['renew the passport, it expires next month', null],
    ['call mom after dinner', at(2026, 10, 20, 21)],
    ['take my pills before bed', at(2026, 10, 20, 22)],
    ['call mom eod', at(2026, 10, 20, 17)],
    ['call mom at 18:00', at(2026, 10, 20, 18)],
    ['call mom on monday morning', at(2026, 10, 26, 8)],
    ['remind me in 2 hours to take the clothes out', at(2026, 10, 20, 11)],
    ['I may call mom', null],
    ['call mom every Sunday', null],
  ]);
});

test('everyday phrasing in the evening: passed times move on', () => {
  const evening = at(2026, 10, 20, 18);
  sweep(evening, [
    ['call mom this afternoon', at(2026, 10, 21, 14)],
    ['call mom at 5', at(2026, 10, 21, 17)],
    ['call mom later today', at(2026, 10, 20, 19)],
    ['call mom tonight', at(2026, 10, 20, 19)],
    ['call mom in an hour', at(2026, 10, 20, 19)],
    ['call mom at 6 30', at(2026, 10, 20, 18, 30)],
    ['call mom after work', at(2026, 10, 21, 18)],
    ['call mom tomorrow', at(2026, 10, 21, 9)],
  ]);
});

test('the day of the thing itself: reminders come the day before', () => {
  // Monday 26 October 2026, 8:30 am
  const monday = at(2026, 10, 26, 8, 30);
  sweep(monday, [
    ["Pay the credit card bill before the 18th or there's a late fee", at(2026, 11, 17, 9)],
    ['Book train tickets to Amritsar for the 14th', at(2026, 11, 13, 9)],
    ['Book the vet appointment for Thursday', at(2026, 10, 28, 9)],
    ['Order the cake for Saturday', at(2026, 10, 30, 9)],
    ["Review the slides for Thursday's demo tonight", at(2026, 10, 26, 19)],
    ['Remind me on Saturday to order the cake', at(2026, 10, 31, 9)],
    ['Book his eye test for next week', at(2026, 11, 2, 9)],
  ]);
});

test('clock times said every which way', () => {
  const monday = at(2026, 10, 26, 8, 30);
  sweep(monday, [
    ['Dentist appointment Wednesday 4:30pm', at(2026, 10, 28, 16, 30)],
    ['Print the handouts before 10', at(2026, 10, 26, 9, 30)],
    ["Order from Domino's around 8", at(2026, 10, 26, 20)],
    ['Call the bank at 10', at(2026, 10, 26, 10)],
    ['call mom at 8 in the morning', at(2026, 10, 27, 8)],
    ["the bill is due Friday, pay it on Thursday", at(2026, 10, 29, 9)],
    ['we should do a farewell dinner for him this weekend', at(2026, 10, 31, 10)],
    ["he hasn't replied in a week", null],
  ]);
});
