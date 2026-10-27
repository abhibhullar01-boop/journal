import type { ExtractedInsight, InsightKind } from '../brain';
import { searchWeb } from './websearch';

/**
 * Calls the Claude Messages API with plain fetch. The official SDK has circular imports
 * that crash the app when Metro loads them in Expo Go, so the app talks HTTP directly.
 */

/** Models, fastest that does the job well. Each falls back to the next if the account can't use it. */
export const CHAT_MODELS = ['claude-sonnet-5-5', 'claude-opus-5-5'];
export const SORT_MODELS = ['claude-haiku-5-5', 'claude-sonnet-5-5'];
/** Kept for screens that name the model. */
export const CLAUDE_MODEL = CHAT_MODELS[0];
const API_URL = 'https://api.anthropic.com/v1/messages';

/** The parts of the Messages API this app uses. */
namespace Anthropic {
  export type TextBlock = { type: 'text'; text: string; citations?: unknown[]; cache_control?: { type: 'ephemeral' } };
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

/** The app swaps in Expo's fetch, which can stream; tests use the global one. */
let fetchImpl: (url: string, init: any) => Promise<Response> = (url, init) => globalThis.fetch(url, init);
export function setFetch(f: (url: string, init: any) => Promise<any>): void {
  fetchImpl = f;
}

const RETRYABLE = new Set([408, 409, 429, 500, 502, 503, 504, 529]);
/** Models this account turned out not to have, so later calls skip them. */
const unavailableModels = new Set<string>();

function headers(apiKey: string) {
  return {
    'content-type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    // The key belongs to the phone's owner and stays in its keychain, so calling from the app is fine.
    'anthropic-dangerous-direct-browser-access': 'true',
  };
}

/**
 * Reads a server-sent event stream into a whole message, calling `onText` as words arrive.
 * Thinking blocks are rebuilt with their text and signature, because a tool round must send them
 * back unchanged.
 */
async function readStream(
  response: Response,
  onText?: (delta: string) => void,
  onBlock?: (block: Anthropic.ContentBlock) => void,
  onThinking?: (delta: string) => void,
): Promise<Anthropic.Message> {
  const content: Anthropic.ContentBlock[] = [];
  const partialJson: Record<number, string> = {};
  let stopReason: string | null = null;
  let streamError: ClaudeError | null = null;

  const handle = (data: string) => {
    let event: any;
    try {
      event = JSON.parse(data);
    } catch {
      return;
    }
    switch (event.type) {
      case 'content_block_start':
        content[event.index] = { ...event.content_block };
        if (event.content_block.type === 'text' && event.content_block.text) onText?.(event.content_block.text);
        onBlock?.(content[event.index]);
        break;
      case 'content_block_delta': {
        const block = content[event.index] as any;
        const d = event.delta;
        if (!block) break;
        if (d.type === 'text_delta') {
          block.text = (block.text ?? '') + d.text;
          onText?.(d.text);
        } else if (d.type === 'input_json_delta') {
          partialJson[event.index] = (partialJson[event.index] ?? '') + d.partial_json;
        } else if (d.type === 'citations_delta') {
          block.citations = [...(block.citations ?? []), d.citation];
        } else if (d.type === 'thinking_delta') {
          block.thinking = (block.thinking ?? '') + d.thinking;
          onThinking?.(d.thinking);
        } else if (d.type === 'signature_delta') {
          block.signature = (block.signature ?? '') + d.signature;
        }
        break;
      }
      case 'content_block_stop': {
        const block = content[event.index] as any;
        if (block && partialJson[event.index] !== undefined) {
          try {
            block.input = JSON.parse(partialJson[event.index] || '{}');
          } catch {
            block.input = {};
          }
        }
        break;
      }
      case 'message_delta':
        if (event.delta?.stop_reason) stopReason = event.delta.stop_reason;
        break;
      case 'error':
        streamError = new ClaudeError(event.error?.message ?? 'Stream error', event.error?.type === 'overloaded_error' ? 529 : 500);
        break;
    }
  };

  const consume = (text: string, flush: boolean) => {
    const events = text.split(/\r?\n\r?\n/);
    const rest = flush ? '' : events.pop() ?? '';
    for (const raw of events) {
      const data = raw
        .split(/\r?\n/)
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trimStart())
        .join('\n');
      if (data) handle(data);
    }
    return rest;
  };

  const reader = (response.body as any)?.getReader?.();
  if (reader) {
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer = consume(buffer + decoder.decode(value, { stream: true }), false);
    }
    consume(buffer + decoder.decode(), true);
  } else {
    // No streaming body on this platform: read it all at once.
    consume(await response.text(), true);
  }
  if (streamError) throw streamError;
  return { content: content.filter(Boolean), stop_reason: stopReason };
}

interface CallOptions {
  models: string[];
  stream?: boolean;
  /** Skip extended thinking where the model allows it: the replies here are short and speed matters. */
  fast?: boolean;
  onText?: (delta: string) => void;
  onBlock?: (block: Anthropic.ContentBlock) => void;
  onThinking?: (delta: string) => void;
}

/**
 * The lowest thinking setting each model accepts. Sonnet 5.5 calls it "between_tools" (only short
 * notes between tool calls); Haiku 5.5 can switch thinking off. Opus can't, so it relies on low effort.
 */
const QUICK_THINKING: Record<string, { type: string }> = {
  'claude-sonnet-5-5': { type: 'between_tools' },
  'claude-haiku-5-5': { type: 'disabled' },
};
/** Models that turned the quick setting down, so later calls leave it out. */
const quickThinkingRefused = new Set<string>();

/** Calls the Messages API with retries, trying the next model when one isn't available. */
async function createMessage(apiKey: string, body: Record<string, unknown>, options: CallOptions): Promise<Anthropic.Message> {
  const models = options.models.filter((m) => !unavailableModels.has(m));
  if (!models.length) models.push(options.models[options.models.length - 1]);
  let lastError: ClaudeError | null = null;
  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt) await new Promise((r) => setTimeout(r, 800 * 2 ** attempt));
      const thinking = options.fast && !quickThinkingRefused.has(model) ? QUICK_THINKING[model] : undefined;
      let response: Response;
      try {
        response = await fetchImpl(API_URL, {
          method: 'POST',
          headers: headers(apiKey),
          body: JSON.stringify({ ...body, model, ...(thinking ? { thinking } : {}), ...(options.stream ? { stream: true } : {}) }),
        });
      } catch {
        lastError = new ClaudeError("Couldn't reach Claude.", 0);
        continue;
      }
      if (response.ok) {
        const isStream = options.stream && (response.headers.get('content-type') ?? '').includes('event-stream');
        if (isStream) {
          try {
            return await readStream(response, options.onText, options.onBlock, options.onThinking);
          } catch (error) {
            lastError = error instanceof ClaudeError ? error : new ClaudeError("Couldn't reach Claude.", 0);
            if (!RETRYABLE.has(lastError.status) && lastError.status !== 0) throw lastError;
            continue;
          }
        }
        const json = await response.json().catch(() => null);
        if (json) {
          const message = json as Anthropic.Message;
          // Non-streaming reply to a streaming caller: still show the words.
          if (options.onText) options.onText(textOf(message));
          return message;
        }
      }
      const json = await response.json().catch(() => null);
      lastError = new ClaudeError(json?.error?.message ?? `HTTP ${response.status}`, response.status);
      if (response.status === 400 && thinking && /thinking/i.test(lastError.message)) {
        // This model doesn't take the quick setting: ask again straight away without it.
        quickThinkingRefused.add(model);
        attempt = -1;
        continue;
      }
      if (!RETRYABLE.has(response.status)) break;
    }
    // A model this key can't use: try the next one.
    if (lastError && (lastError.status === 404 || (lastError.status === 400 && /model/i.test(lastError.message)) || lastError.status === 403)) {
      unavailableModels.add(model);
      continue;
    }
    break;
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
    // Web search splits a reply into many text blocks around citations; they join back seamlessly.
    .join('');
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
The entry is a message in a chat with their companion, so it may be a question or request to the companion ("what should I cook tonight?", "find me running shoes under 5000", "how am I doing on my goals?"). Those are not items, unless they clearly state something they intend to do or buy ("I need new running shoes, find me some" has the shopping item "Running shoes").

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
    max_tokens: 4000,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: EXTRACTION_SCHEMA } },
    // The rules are the same for every entry, so they're cached between messages.
    system: [{ type: 'text', text: EXTRACTION_RULES, cache_control: { type: 'ephemeral' } }],
    messages: [
      {
        role: 'user',
        content:
          `Now: ${localStamp(now)}.\n` +
          (knownFacts.length ? `Already known about them (don't repeat): ${knownFacts.slice(-40).join(' ')}\n` : '') +
          `\nEntry:\n${entry}`,
      },
    ],
  }, { models: SORT_MODELS, fast: true });
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
  /** Older journal messages that are no longer in the chat history sent along. */
  olderEntries: { at: Date; text: string }[];
  /** What the app already saved from their latest message. */
  justSaved: { kind: InsightKind; title: string; due: Date | null }[];
}

/** What the companion can do in the app. */
export interface CompanionActions {
  /** Returns the new item's id. */
  addItem(kind: InsightKind, title: string, due: Date | null): string | null;
  completeItem(id: string): boolean;
  remember(fact: string): void;
}

export interface CompanionResult {
  text: string;
  addedItemIds: string[];
}

/** The website has a document; the phone app and the tests don't. */
const ON_WEB = typeof (globalThis as { document?: unknown }).document !== 'undefined';

const COMPANION_PERSONA = `You are the companion inside the user's personal journal app ${ON_WEB ? 'on the web (they also have it on their iPhone)' : 'on their iPhone'}. Think of yourself as a warm, sharp friend who has read their journal: you remember what they said, notice patterns, and help them get things done.

How the app works:
- There is one ongoing chat, and it is also their journal. They drop in many times a day: quick notes, voice dumps, questions, venting. Each of their messages starts with its local time in brackets. Use the time of day and what they already said today.
- Their latest message ends with an <app_context> block from the app: the time now, their open items, and what the app just saved. They didn't write it and can't see it.
- After each message the app itself pulls out tasks, things to buy, skills and goals, sets reminders, and shows them as cards under their message. Don't add those again and don't list them back; at most mention one detail in passing ("I'll ping you at 7").
- Use add_item only for something new you suggested and they agreed to, or something they ask you to add that isn't in their latest message.
- When you change their lists, write your short reply first and call the tools in the same response.

How to talk:
- Short, natural replies, like a text from a friend: usually 1 to 3 sentences, or a short list. Plain text with **bold** and "- " bullets only, no headings or tables.
- A quick note or a brain dump needs only a short acknowledgement, or a useful nudge if one fits. Don't ask a question every time.
- Be specific: use their names, dates and items from the journal instead of generic advice.
- Offer a useful suggestion when it fits: what to focus on, what to buy, a nudge on a skill or goal, a gentle check-in when they sound low. Don't lecture.
- If something isn't in the journal, say so plainly rather than guessing.
- You are not a doctor or therapist. If they sound in real distress, be kind and suggest talking to someone they trust or a professional.

Links and shopping:
- When they want to buy something, compare products, find a place, a recipe, a video or anything on the web, search the web (one or two focused searches), then give 2 to 4 good options.
- If the search fails or finds nothing useful, say so in one line and offer what you can; never invent links. Don't talk about your tools.
- Put each option on its own line as a markdown link to the real page you found, then a few words: "- [Asics Gel-Contend 9](https://...) about ₹4,000, cushioned and good for beginners". The app shows each link as a card with its picture, so link the product page itself, never a search page or a made-up address.
- Prefer stores that deliver where they live (from what you know about them; India if you don't know). Show prices in their currency.`;

const COMPANION_TOOLS: Anthropic.Tool[] = [
  {
    name: 'add_item',
    description:
      "Add a task, shopping item, skill or goal to their lists. Only for something not already in their latest message (the app saves those itself): a suggestion they agreed to, or an explicit ask to add something.",
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

/** Claude's own web search: the basic version is fastest. Some accounts have it switched off. */
const WEB_SEARCH_TOOLS = [
  { type: 'web_search_20250305', name: 'web_search', max_uses: 3, user_location: { type: 'approximate', country: 'IN' } },
  { type: 'web_search_20260209', name: 'web_search', max_uses: 3 },
];
let webSearchLevel = 0;
let webSearchOffSince = 0;
let webSearchProblem: string | null = null;
/** After a while, try Claude's web search again (the setting may have been switched on). */
const WEB_SEARCH_RETRY_MS = 10 * 60_000;

/** For Settings: whether Claude's own web search works, and why not. */
export function webSearchStatus(): { working: boolean | null; problem: string | null } {
  if (webSearchLevel >= WEB_SEARCH_TOOLS.length) return { working: false, problem: webSearchProblem };
  return { working: webSearchProblem ? false : null, problem: webSearchProblem };
}

/** The phone's own backup search, offered when Claude's web search is unavailable. */
const BACKUP_SEARCH_TOOL: Anthropic.Tool = {
  name: 'search_web',
  description:
    'Search the web (results come back as titles, links and snippets). Use it to find products, prices, places, recipes and anything current. Link the result pages themselves.',
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['query'],
    properties: { query: { type: 'string', description: 'What to search for, e.g. "black formal trousers men Myntra".' } },
  },
};

function currentTools(): unknown[] {
  if (webSearchLevel >= WEB_SEARCH_TOOLS.length && Date.now() - webSearchOffSince > WEB_SEARCH_RETRY_MS) webSearchLevel = 0;
  const serverSearch = webSearchLevel < WEB_SEARCH_TOOLS.length;
  return [...COMPANION_TOOLS, serverSearch ? WEB_SEARCH_TOOLS[webSearchLevel] : BACKUP_SEARCH_TOOL];
}

/** What changes slowly (facts, older journal): its own cached block after the persona. */
function memoryBlock(c: CompanionContext): string {
  const lines: string[] = ['What you know about them:', ...(c.facts.length ? c.facts.slice(-60).map((f) => `- ${f}`) : ['- (nothing yet)'])];
  if (c.olderEntries.length) {
    lines.push('', 'Older journal messages (before the chat below), newest first:');
    let budget = 6_000;
    for (const e of c.olderEntries) {
      const line = `[${localStamp(e.at)}] ${e.text}`;
      if (budget - line.length < 0) break;
      budget -= line.length;
      lines.push(line);
    }
  }
  return lines.join('\n');
}

/** What changes every message: the time, open items and what was just saved. Sent after their latest words. */
function contextBlock(c: CompanionContext): string {
  const lines: string[] = ['<app_context>', `Now: ${localStamp(c.now)}.`, '', 'Their open items (id | kind | title | reminder):'];
  if (!c.openItems.length) lines.push('- (none)');
  for (const i of c.openItems.slice(0, 50)) lines.push(`- ${i.id} | ${i.kind} | ${i.title} | ${i.due ? localStamp(i.due) : '-'}`);
  lines.push('', 'Saved by the app from their latest message:');
  if (!c.justSaved.length) lines.push('- (nothing)');
  for (const i of c.justSaved) lines.push(`- ${i.kind}: ${i.title}${i.due ? ` (reminder ${localStamp(i.due)})` : ''}`);
  lines.push('</app_context>');
  return lines.join('\n');
}

/** Adds a time stamp to each message so Claude can see how the day went. */
function stampMessage(t: ChatTurn): string {
  return t.role === 'user' ? `[${localStamp(new Date(t.at))}] ${t.text}` : t.text;
}

const CACHE = { type: 'ephemeral' } as const;

/**
 * The chat as API messages: one text block per message, with back-to-back messages from the same
 * side grouped (the API wants turns to alternate, starting with the user). Earlier messages never
 * change, so everything up to the newest message is a stable, cacheable prefix.
 */
function chatMessages(history: ChatTurn[]): { role: 'user' | 'assistant'; content: Anthropic.TextBlock[] }[] {
  const messages: { role: 'user' | 'assistant'; content: Anthropic.TextBlock[] }[] = [];
  for (const t of history) {
    const text = stampMessage(t).trim();
    if (!text) continue;
    const last = messages[messages.length - 1];
    if (last && last.role === t.role) last.content.push({ type: 'text', text });
    else messages.push({ role: t.role, content: [{ type: 'text', text }] });
  }
  while (messages.length && messages[0].role !== 'user') messages.shift();
  return messages;
}

/**
 * The request the companion runs on. Three cache points: the persona (with the tools before it),
 * the memory block, and the newest message. The per-message context goes after the last cache
 * point, so the next message reads everything before it from the cache.
 */
function companionRequest(history: ChatTurn[], context: CompanionContext, warm = false) {
  const system = [
    { type: 'text', text: COMPANION_PERSONA, cache_control: CACHE },
    { type: 'text', text: memoryBlock(context), cache_control: CACHE },
  ];
  const messages: Anthropic.MessageParam[] = chatMessages(history);
  const last = messages[messages.length - 1] as { role: string; content: Anthropic.TextBlock[] } | undefined;
  if (last) last.content[last.content.length - 1].cache_control = CACHE;
  // A warm-up ends on a placeholder; a reply ends on the app's context for this moment.
  const tail: Anthropic.TextBlock = { type: 'text', text: warm ? '(The user is about to write.)' : contextBlock(context) };
  if (last?.role === 'user') last.content.push(tail);
  else messages.push({ role: 'user', content: [tail] });
  return { system, messages, tools: currentTools() };
}

/**
 * Loads the conversation into Claude's cache while they type or talk, so the reply starts sooner.
 * It costs a fraction of a normal message and produces no reply (max_tokens 0).
 */
export async function warmCompanion(apiKey: string, history: ChatTurn[], context: CompanionContext): Promise<void> {
  const { system, messages, tools } = companionRequest(history, context, true);
  await createMessage(apiKey, { max_tokens: 0, output_config: { effort: 'low' }, system, tools, messages }, { models: CHAT_MODELS, fast: true });
}

/** Live progress while the companion writes. */
export interface CompanionProgress {
  /** The reply so far. */
  onText?(text: string): void;
  /** What it's doing, e.g. "Searching the web…", or null. */
  onStatus?(status: string | null): void;
}

/** What a web search error code means, in plain words. */
function searchProblem(code: string): string {
  if (code === 'max_uses_exceeded') return '';
  if (code === 'too_many_requests') return 'Web search is busy right now.';
  if (code === 'unavailable') return 'Web search is temporarily unavailable.';
  return `Web search error: ${code}.`;
}

/** The first line of a working note, short enough for the status line. */
function noteLine(note: string): string | null {
  const line = note.trim().split('\n').find((l) => l.trim())?.trim();
  if (!line) return null;
  return line.length > 80 ? `${line.slice(0, 78).trimEnd()}…` : line;
}

/** One reply from the companion, running any actions it takes along the way. */
export async function companionReply(
  apiKey: string,
  history: ChatTurn[],
  context: CompanionContext,
  actions: CompanionActions,
  progress: CompanionProgress = {},
): Promise<CompanionResult> {
  const { system, messages } = companionRequest(history, context);
  const addedItemIds: string[] = [];
  let text = '';
  let paused = false;

  for (let round = 0; round < 8; round++) {
    const serverSearch = webSearchLevel < WEB_SEARCH_TOOLS.length;
    // Same tools as the warm-up unless web search just fell back to another version.
    const tools = currentTools();
    const before = text ? `${text}${paused ? '' : '\n\n'}` : '';
    let live = '';
    let note = '';
    let response: Anthropic.Message;
    try {
      response = await createMessage(
        apiKey,
        { max_tokens: 6000, output_config: { effort: 'low' }, system, tools, messages },
        {
          models: CHAT_MODELS,
          stream: true,
          fast: true,
          onText(delta) {
            live += delta;
            progress.onText?.((before + (paused ? live : live.trimStart())).trim());
            progress.onStatus?.(null);
          },
          onBlock(block) {
            if (block.type === 'server_tool_use' || (block.type === 'tool_use' && (block as any).name === 'search_web')) progress.onStatus?.('Searching the web…');
            if (block.type === 'thinking') note = '';
          },
          onThinking(delta) {
            // Short working notes ("Looking for trousers under ₹2,000") make a good live status.
            note += delta;
            const line = noteLine(note);
            if (line) progress.onStatus?.(line);
          },
        },
      );
    } catch (error) {
      // Claude's web search isn't allowed on this account: try the other version, then the phone's own search.
      if (serverSearch && error instanceof ClaudeError && error.status === 400 && /web.?search|server tool|tool type|not enabled|not available/i.test(error.message)) {
        webSearchProblem = error.message;
        webSearchLevel++;
        if (webSearchLevel >= WEB_SEARCH_TOOLS.length) webSearchOffSince = Date.now();
        round--;
        continue;
      }
      throw error;
    }
    progress.onStatus?.(null);
    if (response.stop_reason === 'refusal') return { text: "Sorry, I can't help with that one.", addedItemIds };

    // Note why a web search came back empty, for Settings.
    for (const block of response.content as any[]) {
      if (block.type === 'web_search_tool_result' && block.content?.type === 'web_search_tool_result_error') {
        const problem = searchProblem(block.content.error_code);
        if (problem) webSearchProblem = problem;
      } else if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
        webSearchProblem = null;
      }
    }

    const part = paused ? textOf(response) : textOf(response).trim();
    if (part.trim()) text = text ? `${text}${paused ? '' : '\n\n'}${part}` : part;
    paused = response.stop_reason === 'pause_turn';
    if (paused) {
      // A long web search paused; sending it back lets it carry on.
      messages.push({ role: 'assistant', content: response.content });
      continue;
    }
    if (response.stop_reason !== 'tool_use') break;

    messages.push({ role: 'assistant', content: response.content });
    const results: Anthropic.ToolResultBlockParam[] = [];
    let needsAnswer = false;
    for (const raw of response.content) {
      if (raw.type !== 'tool_use') continue;
      const block = raw as Anthropic.ToolUseBlock;
      const input = block.input as Record<string, string>;
      let result = 'ok';
      if (block.name === 'add_item') {
        const id = actions.addItem(input.kind as InsightKind, input.title, parseLocal(input.due));
        if (id) addedItemIds.push(id);
        result = id ? `Added "${input.title}". The app shows it as a card under your reply.` : 'Could not add that.';
      } else if (block.name === 'complete_item') {
        result = actions.completeItem(input.id) ? 'Marked done.' : 'No open item with that id.';
      } else if (block.name === 'remember') {
        actions.remember(input.fact);
        result = 'Saved.';
      } else if (block.name === 'search_web') {
        needsAnswer = true;
        progress.onStatus?.('Searching the web…');
        const found = await searchWeb(input.query ?? '');
        result = found.length
          ? found.map((r, i) => `${i + 1}. ${r.title}\n${r.url}\n${r.snippet}`).join('\n\n')
          : 'The search returned nothing. Say you could not find links this time; do not make links up.';
      }
      results.push({ type: 'tool_result', tool_use_id: block.id, content: result });
    }
    // Only list changes and a reply is already written: no need for another round trip.
    if (!needsAnswer && text.trim()) break;
    messages.push({ role: 'user', content: results });
  }
  progress.onStatus?.(null);
  return { text: text.trim() || 'Done.', addedItemIds };
}

/** A friendly, readable message for an error from Claude. */
export function claudeErrorMessage(error: unknown): string {
  if (!(error instanceof ClaudeError)) return 'Something went wrong. Try again.';
  if (error.status === 401) return 'The Claude key was not accepted. Check it in Settings.';
  if (error.status === 403) return 'That Claude key is not allowed to use this model.';
  if (error.status === 400 && /credit/i.test(error.message)) return 'Your Claude account is out of credit. Add some at platform.claude.com.';
  if (error.status === 429 || error.status === 529) return 'Claude is busy or the key is out of credit. Try again in a minute.';
  if (error.status === 0) return "Couldn't reach Claude. Check your internet.";
  return `Claude had a problem (${error.status}). Try again.`;
}
