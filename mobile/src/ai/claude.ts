import type { ExtractedInsight, InsightKind } from '../brain';

/**
 * Calls the Claude Messages API with plain fetch. The official SDK has circular imports
 * that crash the app when Metro loads them in Expo Go, so the app talks HTTP directly.
 */

/** One place to change the model the app uses. */
export const CLAUDE_MODEL = 'claude-opus-5-5';
const API_URL = 'https://api.anthropic.com/v1/messages';

/** The parts of the Messages API this app uses. */
namespace Anthropic {
  export type TextBlock = { type: 'text'; text: string };
  export type ToolUseBlock = { type: 'tool_use'; id: string; name: string; input: unknown };
  export type ContentBlock = TextBlock | ToolUseBlock | { type: string; [key: string]: unknown };
  export type ToolResultBlockParam = { type: 'tool_result'; tool_use_id: string; content: string };
  export type MessageParam = { role: 'user' | 'assistant'; content: string | (ContentBlock | ToolResultBlockParam)[] };
  export type Tool = { name: string; description: string; strict?: boolean; input_schema: Record<string, unknown> };
  export type Message = { content: ContentBlock[]; stop_reason: string | null };
}

/** An error from the API, with its HTTP status (0 when the phone couldn't reach it). */
export class ClaudeError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const RETRYABLE = new Set([408, 409, 429, 500, 502, 503, 504, 529]);

async function createMessage(apiKey: string, body: Record<string, unknown>): Promise<Anthropic.Message> {
  let lastError: ClaudeError | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 800 * 2 ** attempt));
    let response: Response;
    try {
      response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          // The key belongs to the phone's owner and stays in its keychain, so calling from the app is fine.
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify(body),
      });
    } catch {
      lastError = new ClaudeError("Couldn't reach Claude.", 0);
      continue;
    }
    const json = await response.json().catch(() => null);
    if (response.ok && json) return json as Anthropic.Message;
    lastError = new ClaudeError(json?.error?.message ?? `HTTP ${response.status}`, response.status);
    if (!RETRYABLE.has(response.status)) break;
  }
  throw lastError ?? new ClaudeError('Unknown error', 0);
}

const pad = (n: number) => String(n).padStart(2, '0');
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "Tuesday 2026-10-20 09:00" in the phone's local time. */
export function localStamp(date: Date): string {
  return `${WEEKDAYS[date.getDay()]} ${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** "2026-10-21T19:00" (local) -> Date, or null. */
export function parseLocal(value: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(value ?? '');
  if (!m) return null;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

// ---------------------------------------------------------------------------
// Sorting an entry into tasks, shopping, skills and goals
// ---------------------------------------------------------------------------

const EXTRACTION_RULES = `You sort one voice-journal entry into things the person wants to track.

Kinds:
- task: a concrete thing to do soon (call, pay, book, fix, send, appointments and meetings with a time).
- shopping: one thing to buy. Split lists into one item each ("eggs, bread and atta" is three items). Title is just the item ("Eggs", "Running shoes").
- skill: an ability they are building or want to build (learning, practising, getting better at something).
- goal: a long-term outcome or a habit they want ("run a marathon", "buy a house", "read more", "be more patient").
Leave out feelings, recaps of things already done, other people's plans, and small talk.

Titles: short and clear, in their words, starting with a verb for tasks ("Call mom about Diwali plans"). No time words in the title.

Reminder time ("due"), for tasks and shopping only, as local time YYYY-MM-DDTHH:MM, or "" when they gave no time:
- a day with no time means 09:00; morning 08:00; afternoon 14:00; after work 18:00; evening/tonight 19:00; "later today"/"end of day" 17:00; "today" with no time 17:00 (or an hour from now if that has passed).
- "this weekend" is Saturday 10:00; "next week" is next Monday 09:00; "by Friday" is Friday 09:00; "on the 1st" is the next 1st.
- "in 2 hours" means exactly that from now. A time that already passed today moves to tomorrow.

facts: durable things worth remembering about the person to personalise later (family and friends' names and who they are, where they live, work, health, likes and dislikes). Only clear facts from this entry, written as short sentences ("Anaya is their daughter."). Usually none.`;

const EXTRACTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items', 'facts'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'title', 'sentence', 'due'],
        properties: {
          kind: { type: 'string', enum: ['task', 'shopping', 'skill', 'goal'] },
          title: { type: 'string' },
          sentence: { type: 'string', description: 'The part of the entry it came from, word for word.' },
          due: { type: 'string', description: 'YYYY-MM-DDTHH:MM local time, or empty.' },
        },
      },
    },
    facts: { type: 'array', items: { type: 'string' } },
  },
};

export interface ClaudeExtraction {
  items: ExtractedInsight[];
  facts: string[];
}

/** Asks Claude to sort an entry. Throws on network or key problems so the caller can fall back. */
export async function extractWithClaude(apiKey: string, entry: string, now: Date, knownFacts: string[] = []): Promise<ClaudeExtraction> {
  const response = await createMessage(apiKey, {
    model: CLAUDE_MODEL,
    max_tokens: 4000,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: EXTRACTION_SCHEMA } },
    system: EXTRACTION_RULES,
    messages: [
      {
        role: 'user',
        content:
          `Now: ${localStamp(now)}.\n` +
          (knownFacts.length ? `Already known about them (don't repeat): ${knownFacts.slice(-40).join(' ')}\n` : '') +
          `\nEntry:\n${entry}`,
      },
    ],
  });
  if (response.stop_reason === 'refusal') throw new Error('Claude declined this entry.');
  const parsed = JSON.parse(textOf(response)) as {
    items: { kind: InsightKind; title: string; sentence: string; due: string }[];
    facts: string[];
  };
  return {
    items: parsed.items.map((i) => ({
      kind: i.kind,
      title: i.title.trim(),
      sentence: i.sentence.trim() || i.title,
      confidence: 0.99,
      dueDate: i.kind === 'task' || i.kind === 'shopping' ? parseLocal(i.due) : null,
    })),
    facts: parsed.facts.map((f) => f.trim()).filter(Boolean),
  };
}

// ---------------------------------------------------------------------------
// The companion chat
// ---------------------------------------------------------------------------

export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
  at: string; // ISO
}

export interface CompanionContext {
  now: Date;
  facts: string[];
  openItems: { id: string; kind: InsightKind; title: string; due: Date | null }[];
  recentEntries: { at: Date; text: string }[];
}

/** What the companion can do in the app. */
export interface CompanionActions {
  addItem(kind: InsightKind, title: string, due: Date | null): void;
  completeItem(id: string): boolean;
  remember(fact: string): void;
}

const COMPANION_PERSONA = `You are the companion inside the user's personal voice journal app on their iPhone. Think of yourself as a warm, sharp friend who has read their journal: you remember what they said, notice patterns, and help them get things done.

How to talk:
- Short, natural replies, like a text from a friend (usually 1 to 4 sentences, or a short list when listing things). No headings.
- Be specific: use their names, dates and items from the journal instead of generic advice.
- Offer a useful suggestion when it fits: what to focus on today, what to buy, a nudge on a skill or goal, a gentle check-in when they sound low. Don't lecture.
- When they ask you to remember, add or remind them of something, use the tools, then confirm briefly.
- If something isn't in the journal, say so plainly rather than guessing.
- You are not a doctor or therapist. If they sound in real distress, be kind and suggest talking to someone they trust or a professional.`;

const COMPANION_TOOLS: Anthropic.Tool[] = [
  {
    name: 'add_item',
    description: 'Add a task, shopping item, skill or goal to their lists. Use when they ask you to remind them, add something, or agree to a suggestion.',
    strict: true,
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['kind', 'title', 'due'],
      properties: {
        kind: { type: 'string', enum: ['task', 'shopping', 'skill', 'goal'] },
        title: { type: 'string', description: 'Short title. For shopping, just the item.' },
        due: { type: 'string', description: 'Reminder time as local YYYY-MM-DDTHH:MM, or empty for none.' },
      },
    },
  },
  {
    name: 'complete_item',
    description: 'Mark one of their open items as done, by its id from the list in the context.',
    strict: true,
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['id'],
      properties: { id: { type: 'string' } },
    },
  },
  {
    name: 'remember',
    description: 'Save a lasting fact about them (people, places, preferences) so you remember it in future chats.',
    strict: true,
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['fact'],
      properties: { fact: { type: 'string' } },
    },
  },
];

function contextBlock(c: CompanionContext): string {
  const lines: string[] = [`Now: ${localStamp(c.now)}.`];
  lines.push('', 'What you know about them:', ...(c.facts.length ? c.facts.map((f) => `- ${f}`) : ['- (nothing yet)']));
  lines.push('', 'Their open items (id | kind | title | reminder):');
  if (!c.openItems.length) lines.push('- (none)');
  for (const i of c.openItems.slice(0, 80)) lines.push(`- ${i.id} | ${i.kind} | ${i.title} | ${i.due ? localStamp(i.due) : '-'}`);
  lines.push('', 'Recent journal entries, newest first:');
  let budget = 14_000;
  for (const e of c.recentEntries) {
    const line = `[${localStamp(e.at)}] ${e.text}`;
    if (budget - line.length < 0) break;
    budget -= line.length;
    lines.push(line);
  }
  if (!c.recentEntries.length) lines.push('(no entries yet)');
  return lines.join('\n');
}

/** One reply from the companion, running any actions it takes along the way. */
export async function companionReply(
  apiKey: string,
  history: ChatTurn[],
  context: CompanionContext,
  actions: CompanionActions,
): Promise<string> {
  const messages: Anthropic.MessageParam[] = history.slice(-20).map((t) => ({ role: t.role, content: t.text }));
  // The API needs the conversation to start with the user.
  while (messages.length && messages[0].role !== 'user') messages.shift();

  for (let round = 0; round < 5; round++) {
    const response = await createMessage(apiKey, {
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      output_config: { effort: 'low' },
      system: [
        { type: 'text', text: COMPANION_PERSONA },
        { type: 'text', text: contextBlock(context) },
      ],
      tools: COMPANION_TOOLS,
      messages,
    });
    if (response.stop_reason === 'refusal') return "Sorry, I can't help with that one.";
    if (response.stop_reason !== 'tool_use') return textOf(response) || 'Done.';

    messages.push({ role: 'assistant', content: response.content });
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const raw of response.content) {
      if (raw.type !== 'tool_use') continue;
      const block = raw as Anthropic.ToolUseBlock;
      const input = block.input as Record<string, string>;
      let result = 'ok';
      if (block.name === 'add_item') {
        actions.addItem(input.kind as InsightKind, input.title, parseLocal(input.due));
        result = `Added "${input.title}".`;
      } else if (block.name === 'complete_item') {
        result = actions.completeItem(input.id) ? 'Marked done.' : 'No open item with that id.';
      } else if (block.name === 'remember') {
        actions.remember(input.fact);
        result = 'Saved.';
      }
      results.push({ type: 'tool_result', tool_use_id: block.id, content: result });
    }
    messages.push({ role: 'user', content: results });
  }
  return 'Done.';
}

/** A friendly, readable message for an error from Claude. */
export function claudeErrorMessage(error: unknown): string {
  if (!(error instanceof ClaudeError)) return 'Something went wrong. Try again.';
  if (error.status === 401) return 'The Claude key was not accepted. Check it in Settings.';
  if (error.status === 403) return 'That Claude key is not allowed to use this model.';
  if (error.status === 400 && /credit/i.test(error.message)) return 'Your Claude account is out of credit. Add some at console.anthropic.com.';
  if (error.status === 429 || error.status === 529) return 'Claude is busy or the key is out of credit. Try again in a minute.';
  if (error.status === 0) return "Couldn't reach Claude. Check your internet.";
  return `Claude had a problem (${error.status}). Try again.`;
}
