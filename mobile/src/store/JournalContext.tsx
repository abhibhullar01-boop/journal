import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ChatTurn, claudeErrorMessage, companionReply, extractWithClaude } from '../ai/claude';
import { useKeys } from '../ai/keys';
import { AnalyzerState, dueDateIn, ExtractedInsight, InsightKind, JournalAnalyzer } from '../brain';
import { cancelReminder, notifySaved, refreshDigests, scheduleReminder } from './reminders';
import { CaptureMode, DEFAULT_PREFERENCES, JournalEntry, Preferences, ThreadMessage, TrackedItem } from './types';

const DATA_KEY = 'voice-journal/data/v1';
const MODEL_KEY = 'voice-journal/model/v2';

interface Stored {
  entries: JournalEntry[];
  items: TrackedItem[];
  /** Things the companion knows about the user ("Anaya is their daughter."). */
  facts: string[];
  /** The one ongoing conversation, oldest first. Your messages are also your journal entries. */
  thread: ThreadMessage[];
  prefs: Preferences;
}

/** Items added by the companion belong to this pseudo entry. */
export const CHAT_ENTRY_ID = 'chat';

/** How many recent messages go to Claude as the conversation; older ones go in as journal notes. */
const HISTORY_SENT = 40;

const NO_KEY_NOTICE =
  "I saved that, and sorted it on your phone. To chat back and double-check how things are sorted, add your Claude key in Settings (the gear at the top).";

interface JournalContextValue {
  ready: boolean;
  entries: JournalEntry[];
  items: TrackedItem[];
  facts: string[];
  thread: ThreadMessage[];
  prefs: Preferences;
  /** The companion is writing a reply. */
  replying: boolean;
  /** The reply as it's being written, and what the companion is doing ("Searching the web…"). */
  draft: { text: string; status: string | null } | null;
  /** Entries Claude is still sorting. */
  refining: string[];
  analyzer: JournalAnalyzer;
  /** Changes whenever the model learns, so screens can re-evaluate. */
  modelVersion: number;
  /** Sends a message: it is saved as a journal entry, sorted into your lists, and the companion replies. */
  send(text: string, source: CaptureMode): void;
  /** Deletes one of your messages and everything found in it. */
  deleteMessage(id: string): void;
  /** Asks the companion to try again after an error. */
  retry(): void;
  deleteEntry(id: string): void;
  reanalyze(entryId: string): void;
  toggleDone(itemId: string): void;
  removeItem(itemId: string): void;
  snooze(itemId: string, minutes?: number): void;
  recategorize(itemId: string, kind: InsightKind): void;
  confirm(itemId: string): void;
  addItem(kind: InsightKind, title: string, due: Date | null): string | null;
  forgetFact(index: number): void;
  setPref<K extends keyof Preferences>(key: K, value: Preferences[K]): void;
  resetModel(): void;
}

const JournalContext = createContext<JournalContextValue | null>(null);

let counter = 0;
const newId = () => `${Date.now().toString(36)}-${(counter++).toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function toItem(entryId: string, createdAt: string, insight: ExtractedInsight): TrackedItem {
  return {
    id: newId(),
    entryId,
    kind: insight.kind,
    title: insight.title,
    sentence: insight.sentence,
    confidence: insight.confidence,
    dueDate: insight.dueDate ? insight.dueDate.toISOString() : null,
    done: false,
    completedAt: null,
    createdAt,
    confirmed: false,
    notificationId: null,
  };
}

function addFacts(existing: string[], incoming: string[]): string[] {
  const seen = new Set(existing.map((f) => f.toLowerCase()));
  const fresh = incoming.filter((f) => !seen.has(f.toLowerCase()));
  return [...existing, ...fresh].slice(-200);
}

/** Older versions kept entries and chat apart. Weave them into one thread, by time. */
function migrate(saved: Partial<Stored> & { chat?: ChatTurn[] }): Stored {
  const entries = saved.entries ?? [];
  let thread = saved.thread;
  if (!thread) {
    const fromEntries: ThreadMessage[] = entries.map((e) => ({
      id: e.id,
      role: 'user',
      text: e.text,
      at: e.createdAt,
      entryId: e.id,
      source: e.source,
    }));
    const fromChat: ThreadMessage[] = (saved.chat ?? []).map((t) => ({ id: newId(), role: t.role, text: t.text, at: t.at || new Date(0).toISOString() }));
    thread = [...fromEntries, ...fromChat].sort((a, b) => a.at.localeCompare(b.at));
  }
  return {
    entries,
    items: saved.items ?? [],
    facts: saved.facts ?? [],
    thread,
    prefs: { ...DEFAULT_PREFERENCES, ...(saved.prefs ?? {}) },
  };
}

export function JournalProvider({ children }: { children: ReactNode }) {
  const keys = useKeys();
  const [ready, setReady] = useState(false);
  const [data, setDataState] = useState<Stored>({ entries: [], items: [], facts: [], thread: [], prefs: DEFAULT_PREFERENCES });
  const [modelVersion, setModelVersion] = useState(0);
  const [refining, setRefining] = useState<string[]>([]);
  const [replying, setReplying] = useState(false);
  const [draft, setDraft] = useState<{ text: string; status: string | null } | null>(null);
  const analyzerRef = useRef<JournalAnalyzer | null>(null);
  if (!analyzerRef.current) analyzerRef.current = JournalAnalyzer.baseline();
  // Latest data for async work that finishes after a render. Kept in step with every update.
  const dataRef = useRef(data);
  const setData = useCallback((change: (current: Stored) => Stored) => {
    dataRef.current = change(dataRef.current);
    setDataState(dataRef.current);
  }, []);
  const replyingRef = useRef(false);
  const replyAgain = useRef(false);

  // Load saved journal and personalised model.
  useEffect(() => {
    (async () => {
      try {
        const [rawData, rawModel] = await Promise.all([AsyncStorage.getItem(DATA_KEY), AsyncStorage.getItem(MODEL_KEY)]);
        if (rawData) setData(() => migrate(JSON.parse(rawData)));
        if (rawModel) {
          analyzerRef.current = JournalAnalyzer.fromJSON(JSON.parse(rawModel) as AnalyzerState);
          setModelVersion((v) => v + 1);
        }
      } catch (error) {
        console.warn('Could not load the journal', error);
      } finally {
        setReady(true);
      }
    })();
  }, [setData]);

  // Save after every change, and keep the digest notifications current.
  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(DATA_KEY, JSON.stringify(data)).catch((e) => console.warn('Could not save', e));
    const timer = setTimeout(() => refreshDigests(data.items).catch(() => {}), 1500);
    return () => clearTimeout(timer);
  }, [data, ready]);

  const saveModel = useCallback(() => {
    AsyncStorage.setItem(MODEL_KEY, JSON.stringify(analyzerRef.current)).catch(() => {});
    setModelVersion((v) => v + 1);
  }, []);

  const scheduleAll = useCallback(
    (items: TrackedItem[]) => {
      for (const item of items) {
        scheduleReminder(item).then((notificationId) => {
          if (notificationId) {
            setData((c) => ({ ...c, items: c.items.map((i) => (i.id === item.id ? { ...i, notificationId } : i)) }));
          }
        });
      }
    },
    [setData],
  );

  const localItems = useCallback((entry: JournalEntry): TrackedItem[] => {
    return analyzerRef.current!.analyze(entry.text, new Date(entry.createdAt)).map((i) => toItem(entry.id, entry.createdAt, i));
  }, []);

  /** Tells the phone what was saved from an entry, if the user wants that. */
  const announce = useCallback((entryId: string) => {
    if (!dataRef.current.prefs.savedNotifications) return;
    const saved = dataRef.current.items.filter((i) => i.entryId === entryId);
    if (saved.length) notifySaved(saved).catch(() => {});
  }, []);

  /**
   * Lets Claude re-sort an entry. Replaces the quick on-phone result for items the user hasn't
   * touched yet, and teaches the on-phone model from Claude's answer.
   */
  const refineWithClaude = useCallback(
    async (entry: JournalEntry) => {
      const apiKey = keys.anthropic;
      if (!apiKey) {
        announce(entry.id);
        return;
      }
      setRefining((r) => [...r, entry.id]);
      try {
        const result = await extractWithClaude(apiKey, entry.text, new Date(entry.createdAt), dataRef.current.facts);
        // The message may have been deleted while Claude was working.
        if (!dataRef.current.entries.some((e) => e.id === entry.id)) return;
        const current = dataRef.current.items.filter((i) => i.entryId === entry.id);
        const touched = current.filter((i) => i.done || i.confirmed);
        const replaced = current.filter((i) => !i.done && !i.confirmed);
        const touchedTitles = new Set(touched.map((i) => i.title.toLowerCase()));
        const fresh = result.items
          .filter((i) => !touchedTitles.has(i.title.toLowerCase()))
          .map((i) => toItem(entry.id, entry.createdAt, i));
        replaced.forEach((i) => cancelReminder(i.notificationId));
        const replacedIds = new Set(replaced.map((i) => i.id));
        setData((c) => ({
          ...c,
          items: [...c.items.filter((i) => !replacedIds.has(i.id)), ...fresh],
          facts: addFacts(c.facts, result.facts),
        }));
        scheduleAll(fresh);
        for (const i of result.items) analyzerRef.current!.learn(i.sentence, i.kind, 1);
        saveModel();
      } catch (error) {
        console.warn('Claude could not sort the entry; keeping the on-phone result.', error);
      } finally {
        setRefining((r) => r.filter((id) => id !== entry.id));
        announce(entry.id);
      }
    },
    [keys.anthropic, scheduleAll, saveModel, announce, setData],
  );

  const addItem = useCallback(
    (kind: InsightKind, title: string, due: Date | null): string | null => {
      if (kind === 'none' || !title.trim()) return null;
      const now = new Date().toISOString();
      const item = toItem(CHAT_ENTRY_ID, now, { kind, title: title.trim(), sentence: title.trim(), confidence: 1, dueDate: due });
      item.confirmed = true;
      setData((c) => ({ ...c, items: [...c.items, item] }));
      scheduleAll([item]);
      return item.id;
    },
    [setData, scheduleAll],
  );

  const appendMessage = useCallback(
    (message: Omit<ThreadMessage, 'id' | 'at'>) => {
      setData((c) => ({ ...c, thread: [...c.thread, { id: newId(), at: new Date().toISOString(), ...message }] }));
    },
    [setData],
  );

  /** The companion answers everything since its last reply. Runs again if more arrives meanwhile. */
  const reply = useCallback(async () => {
    const apiKey = keys.anthropic;
    if (replyingRef.current) {
      replyAgain.current = true;
      return;
    }
    if (!apiKey) {
      const last = [...dataRef.current.thread].reverse().find((m) => m.role === 'assistant');
      if (last?.text !== NO_KEY_NOTICE) appendMessage({ role: 'assistant', text: NO_KEY_NOTICE, error: true });
      return;
    }
    replyingRef.current = true;
    setReplying(true);
    try {
      do {
        replyAgain.current = false;
        const current = dataRef.current;
        const conversation = current.thread.filter((m) => !m.error);
        const history = conversation.slice(-HISTORY_SENT);
        const firstShown = history[0]?.at ?? new Date().toISOString();
        const latestUser = [...history].reverse().find((m) => m.role === 'user');
        // Show the words as they arrive, a few times a second.
        let shown = { text: '', status: null as string | null };
        let timer: ReturnType<typeof setTimeout> | null = null;
        const show = (change: Partial<typeof shown>) => {
          shown = { ...shown, ...change };
          if (!timer) {
            timer = setTimeout(() => {
              timer = null;
              setDraft(shown);
            }, 60);
          }
        };
        setDraft(shown);
        const result = await companionReply(
          apiKey,
          history.map((m) => ({ role: m.role, text: m.text, at: m.at })),
          {
            now: new Date(),
            facts: current.facts,
            openItems: current.items
              .filter((i) => !i.done)
              .map((i) => ({ id: i.id, kind: i.kind, title: i.title, due: i.dueDate ? new Date(i.dueDate) : null })),
            olderEntries: current.entries
              .filter((e) => e.createdAt < firstShown)
              .slice(0, 80)
              .map((e) => ({ at: new Date(e.createdAt), text: e.text })),
            justSaved: current.items
              .filter((i) => latestUser && i.entryId === latestUser.entryId)
              .map((i) => ({ kind: i.kind, title: i.title, due: i.dueDate ? new Date(i.dueDate) : null })),
          },
          {
            addItem,
            completeItem(id) {
              const item = dataRef.current.items.find((i) => i.id === id && !i.done);
              if (!item) return false;
              cancelReminder(item.notificationId);
              setData((c) => ({
                ...c,
                items: c.items.map((i) => (i.id === id ? { ...i, done: true, completedAt: new Date().toISOString(), notificationId: null } : i)),
              }));
              return true;
            },
            remember(fact) {
              setData((c) => ({ ...c, facts: addFacts(c.facts, [fact]) }));
            },
          },
          { onText: (text) => show({ text }), onStatus: (status) => show({ status }) },
        );
        if (timer) clearTimeout(timer);
        setDraft(null);
        appendMessage({ role: 'assistant', text: result.text, addedItemIds: result.addedItemIds.length ? result.addedItemIds : undefined });
      } while (replyAgain.current);
    } catch (error) {
      appendMessage({ role: 'assistant', text: claudeErrorMessage(error), error: true });
    } finally {
      replyingRef.current = false;
      setReplying(false);
      setDraft(null);
    }
  }, [keys.anthropic, addItem, appendMessage, setData]);

  const value = useMemo<JournalContextValue>(() => {
    /** Replaces (or removes, when `change` returns null) one item and keeps its reminder in sync. */
    const updateItem = (itemId: string, change: (item: TrackedItem) => TrackedItem | null) => {
      const old = dataRef.current.items.find((i) => i.id === itemId);
      if (!old) return;
      const next = change(old);
      cancelReminder(old.notificationId);
      setData((c) => ({
        ...c,
        items: next
          ? c.items.map((i) => (i.id === itemId ? { ...next, notificationId: null } : i))
          : c.items.filter((i) => i.id !== itemId),
      }));
      if (next) scheduleAll([next]);
    };

    const deleteEntry = (id: string) => {
      dataRef.current.items.filter((i) => i.entryId === id).forEach((i) => cancelReminder(i.notificationId));
      setData((c) => ({
        ...c,
        entries: c.entries.filter((e) => e.id !== id),
        items: c.items.filter((i) => i.entryId !== id),
        thread: c.thread.filter((m) => m.entryId !== id),
      }));
    };

    return {
      ready,
      entries: data.entries,
      items: data.items,
      facts: data.facts,
      thread: data.thread,
      prefs: data.prefs,
      replying,
      draft,
      refining,
      analyzer: analyzerRef.current!,
      modelVersion,

      send(raw, source) {
        const text = raw.trim();
        if (!text) return;
        const at = new Date().toISOString();
        const id = newId();
        const entry: JournalEntry = { id, createdAt: at, text, source };
        const items = localItems(entry);
        setData((c) => ({
          ...c,
          entries: [entry, ...c.entries],
          items: [...c.items, ...items],
          thread: [...c.thread, { id, role: 'user', text, at, entryId: id, source }],
        }));
        scheduleAll(items);
        refineWithClaude(entry);
        reply();
      },

      deleteMessage(id) {
        const message = dataRef.current.thread.find((m) => m.id === id);
        if (!message) return;
        if (message.entryId) deleteEntry(message.entryId);
        else setData((c) => ({ ...c, thread: c.thread.filter((m) => m.id !== id) }));
      },

      retry() {
        setData((c) => {
          const thread = [...c.thread];
          while (thread.length && thread[thread.length - 1].error) thread.pop();
          return { ...c, thread };
        });
        reply();
      },

      deleteEntry,

      reanalyze(entryId) {
        const entry = dataRef.current.entries.find((e) => e.id === entryId);
        if (!entry) return;
        dataRef.current.items.filter((i) => i.entryId === entryId).forEach((i) => cancelReminder(i.notificationId));
        const items = localItems(entry);
        setData((c) => ({ ...c, items: [...c.items.filter((i) => i.entryId !== entryId), ...items] }));
        scheduleAll(items);
        refineWithClaude(entry);
      },

      toggleDone(itemId) {
        updateItem(itemId, (i) => ({ ...i, done: !i.done, completedAt: i.done ? null : new Date().toISOString() }));
      },

      removeItem(itemId) {
        updateItem(itemId, () => null);
      },

      snooze(itemId, minutes = 60) {
        updateItem(itemId, (i) => ({ ...i, dueDate: new Date(Date.now() + minutes * 60_000).toISOString() }));
      },

      recategorize(itemId, kind) {
        const item = dataRef.current.items.find((i) => i.id === itemId);
        if (!item) return;
        analyzerRef.current!.learn(item.sentence, kind);
        saveModel();
        updateItem(itemId, (i) => {
          if (kind === 'none') return null;
          const due = kind === 'task' || kind === 'shopping' ? dueDateIn(i.sentence, new Date(i.createdAt)) : null;
          return { ...i, kind, confirmed: true, dueDate: due ? due.toISOString() : null };
        });
      },

      confirm(itemId) {
        const item = dataRef.current.items.find((i) => i.id === itemId);
        if (!item || item.confirmed) return;
        analyzerRef.current!.learn(item.sentence, item.kind);
        saveModel();
        setData((c) => ({ ...c, items: c.items.map((i) => (i.id === itemId ? { ...i, confirmed: true } : i)) }));
      },

      addItem,

      forgetFact(index) {
        setData((c) => ({ ...c, facts: c.facts.filter((_, i) => i !== index) }));
      },

      setPref(key, value) {
        setData((c) => ({ ...c, prefs: { ...c.prefs, [key]: value } }));
      },

      resetModel() {
        analyzerRef.current = JournalAnalyzer.baseline();
        AsyncStorage.removeItem(MODEL_KEY).catch(() => {});
        setModelVersion((v) => v + 1);
      },
    };
  }, [ready, data, modelVersion, refining, replying, draft, localItems, refineWithClaude, reply, scheduleAll, saveModel, addItem, setData]);

  return <JournalContext.Provider value={value}>{children}</JournalContext.Provider>;
}

export function useJournal(): JournalContextValue {
  const value = useContext(JournalContext);
  if (!value) throw new Error('useJournal must be used inside JournalProvider');
  return value;
}
