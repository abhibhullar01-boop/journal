/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { claudeErrorMessage, companionReply, extractWithClaude, localStamp, parseLocal } from '../claude';
import { journalVocabulary } from '../vocabulary';

/** Replaces fetch with canned Messages API replies and records each request body. */
function mockClaude(replies: object[]) {
  const requests: any[] = [];
  const headers: any[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (_url: any, init: any) => {
    requests.push(JSON.parse(init.body));
    headers.push(init.headers);
    const body = replies[Math.min(requests.length - 1, replies.length - 1)];
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { requests, headers, restore: () => (globalThis.fetch = original) };
}

const message = (content: object[], stop_reason = 'end_turn') => ({
  id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content, stop_reason,
  stop_sequence: null, usage: { input_tokens: 10, output_tokens: 10 },
});

test('local time helpers', () => {
  const d = new Date(2026, 9, 20, 9, 5);
  assert.equal(localStamp(d), 'Tuesday 2026-10-20 09:05');
  assert.equal(parseLocal('2026-10-21T19:00')?.getTime(), new Date(2026, 9, 21, 19, 0).getTime());
  assert.equal(parseLocal(''), null);
});

test('extraction asks for structured output and maps the answer', async () => {
  const answer = {
    items: [
      { kind: 'task', title: 'Call mom about Diwali plans', sentence: 'call mom tomorrow evening', due: '2026-10-21T19:00' },
      { kind: 'shopping', title: 'Milk', sentence: 'buy milk', due: '' },
      { kind: 'goal', title: 'Run a half marathon', sentence: 'my goal is a half marathon', due: '2026-12-01T09:00' },
    ],
    facts: ['Anaya is their daughter.'],
  };
  const mock = mockClaude([message([{ type: 'text', text: JSON.stringify(answer) }])]);
  try {
    const result = await extractWithClaude('sk-ant-test', 'entry text', new Date(2026, 9, 20, 9, 0));
    const req = mock.requests[0];
    assert.equal(req.model, 'claude-opus-5-5');
    assert.equal(mock.headers[0]['x-api-key'], 'sk-ant-test');
    assert.equal(mock.headers[0]['anthropic-version'], '2023-06-01');
    assert.equal(req.output_config.format.type, 'json_schema');
    assert.match(req.messages[0].content, /Tuesday 2026-10-20 09:00/);
    assert.deepEqual(result.items.map((i) => [i.kind, i.title]), [
      ['task', 'Call mom about Diwali plans'], ['shopping', 'Milk'], ['goal', 'Run a half marathon'],
    ]);
    assert.equal(result.items[0].dueDate?.getTime(), new Date(2026, 9, 21, 19, 0).getTime());
    assert.equal(result.items[1].dueDate, null);
    assert.equal(result.items[2].dueDate, null, 'goals never get reminders');
    assert.deepEqual(result.facts, ['Anaya is their daughter.']);
  } finally {
    mock.restore();
  }
});

test('companion runs its tools and then answers', async () => {
  const mock = mockClaude([
    message([
      { type: 'tool_use', id: 'tu_1', name: 'add_item', input: { kind: 'task', title: 'Call mom', due: '2026-10-21T19:00' } },
      { type: 'tool_use', id: 'tu_2', name: 'complete_item', input: { id: 'item-1' } },
    ], 'tool_use'),
    message([{ type: 'text', text: "Done! I'll remind you tomorrow at 7." }]),
  ]);
  const added: string[] = [];
  const completed: string[] = [];
  try {
    const reply = await companionReply(
      'sk-ant-test',
      [{ role: 'assistant', text: 'old greeting', at: '' }, { role: 'user', text: 'remind me to call mom tomorrow evening', at: '' }],
      { now: new Date(2026, 9, 20, 9, 0), facts: ['Lives in Mohali.'], openItems: [{ id: 'item-1', kind: 'task', title: 'Pay rent', due: null }], recentEntries: [{ at: new Date(2026, 9, 19, 20, 0), text: 'Long day.' }] },
      { addItem: (_k, title) => added.push(title), completeItem: (id) => (completed.push(id), true), remember: () => {} },
    );
    assert.equal(reply, "Done! I'll remind you tomorrow at 7.");
    assert.deepEqual(added, ['Call mom']);
    assert.deepEqual(completed, ['item-1']);
    const first = mock.requests[0];
    assert.equal(first.messages[0].role, 'user', 'history starts with the user');
    assert.match(first.system[1].text, /Lives in Mohali/);
    assert.match(first.system[1].text, /item-1 \| task \| Pay rent/);
    const second = mock.requests[1];
    const results = second.messages[second.messages.length - 1].content;
    assert.deepEqual(results.map((r: any) => r.tool_use_id), ['tu_1', 'tu_2']);
  } finally {
    mock.restore();
  }
});

test('journal vocabulary picks out names', () => {
  assert.deepEqual(journalVocabulary(['Had lunch with Priya. Simran called.', 'Need to call Priya about Blinkit.']), ['Priya', 'Simran', 'Blinkit']);
});

test('API errors become readable messages', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }), { status: 401 })) as typeof fetch;
  try {
    await assert.rejects(extractWithClaude('bad', 'x', new Date()), (e: unknown) => claudeErrorMessage(e).includes('not accepted'));
  } finally {
    globalThis.fetch = original;
  }
});
