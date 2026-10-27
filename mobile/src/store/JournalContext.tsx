import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { ChatTurn, claudeErrorMessage, CompanionContext, companionReply, extractWithClaude, warmCompanion } from '../ai/claude';
import { useKeys } from '../ai/keys';
import { AnalyzerState, dueDateIn, ExtractedInsight, InsightKind, JournalAnalyzer, shoppingItems, taskTitle } from '../brain';
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

/** Items added by the companion or typed straight into a list belong to this pseudo entry. */
export const CHAT_ENTRY_ID = 'chat';

/**
 * How much of the chat goes to Claude: at least 40 messages, growing to 59 before the window
 * moves on by 20. Moving in steps keeps the start of the conversation the same for many messages
 * in a row, so Claude can reuse its cache of it.
 */
const HISTORY_MIN = 40;
const HISTORY_STEP = 20;

/** If the last call to Claude was this recent, its cache is still warm. */
const CACHE_WARM_MS = 4 * 60_000;

const NO_KEY_NOTICE =
  Platform.OS === 'web'
    ? 'I saved that, and sorted it here in your browser. To chat back and double-check how things are sorted, add your Claude key in Settings.'
    : "I saved that, and sorted it on your phone. To chat back and double-check how things are sorted, add your Claude key in Settings (the gear at the top).";

export interface JournalData {
  ready: boolean;
  entries: JournalEntry[];
  items: TrackedItem[];
  facts: string[];
  thread: ThreadMessage[];
  prefs: Preferences;
  analyzer: JournalAnalyzer;
  /** Changes whenever the model learns, so screens can re-evaluate. */
  modelVersion: number;
}

export interface JournalActions {
  /** Sends a message: it is saved as a journal entry, sorted into your lists, and the companion replies. */
  send(text: string, source: CaptureMode): void;
  /** Changes the words of one of your messages and sorts it again. */
  editMessage(id: string, text: string): void;
  /** Deletes one of your messages and everything found in it. */
  deleteMessage(id: string): void;
  /** Asks the companion to try again after an error. */
  retry(): void;
  deleteEntry(id: string): void;
  reanalyze(entryId: string): void;
  toggleDone(itemId: string): void;
  removeItem(itemId: string): void;
  renameItem(itemId: string, title: string): void;
  /** Sets or clears the reminder time of a task or shopping item. */
  setDue(itemId: string, due: Date | null): void;
  snooze(itemId: string, minutes?: number): void;
  recategorize(itemId: string, kind: InsightKind): void;
  confirm(itemId: string): void;
  addItem(kind: InsightKind, title: string, due: Date | null): string | null;
  /** Adds what was typed into a list ("call mom tomorrow 6pm", "milk, eggs and bread"). Returns how many were added. */
  quickAdd(kind: InsightKind, text: string): number;
  /** Removes the ticked-off items of a list. */
  clearDone(kind: InsightKind): void;
  forgetFact(index: number): void;
  setPref<K extends keyof Preferences>(key: K, value: Preferences[K]): void;
  resetModel(): void;
  /** Gets Claude ready while you type or talk, so its reply starts sooner. */
  warmUp(): void;
}

export interface JournalStatus {
  /** The companion is writing a reply. */
  replying: boolean;
  /** Entries Claude is still sorting. */
  refining: string[];
}

/** The reply as it's being written, and what the companion is doing ("Searching the web…"). */
export interface Draft {
  text: string;
  status: string | null;
}

const DataContext = createContext<JournalData | null>(null);
const ActionsContext = createContext<JournalActions | null>(null);
const StatusContext = createContext<JournalStatus>({ replying: false, refining: [] });
const DraftContext = createContext<Draft | null>(null);

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

/** The part of the conversation sent to Claude. */
export function historyWindow<T>(conversation: T[]): T[] {
  if (conversation.length <= HISTORY_MIN + HISTORY_STEP) return conversation;
  const start = Math.floor((conversation.length - HISTORY_MIN) / HISTORY_STEP) * HISTORY_STEP;
  return conversation.slice(start);
}

function companionContext(current: Stored, history: ThreadMessage[]): CompanionContext {
  const firstShown = history[0]?.at ?? new Date().toISOString();
  const latestUser = [...history].reverse().find((m) => m.role === 'user');
  return {
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
  };
}

const turns = (messages: ThreadMessage[]) => messages.map((m) => ({ role: m.role, text: m.text, at: m.at }));

export function JournalProvider({ children }: { children: ReactNode }) {
  const keys = useKeys();
  const keysRef = useRef(keys);
  keysRef.current = keys;
  const [ready, setReady] = useState(false);
  const [data, setDataState] = useState<Stored>({ entries: [], items: [], facts: [], thread: [], prefs: DEFAULT_PREFERENCES });
  const [modelVersion, setModelVersion] = useState(0);
  const [status, setStatus] = useState<JournalStatus>({ replying: false, refining: [] });
  const [draft, setDraft] = useState<Draft | null>(null);
  const analyzerRef = useRef<JournalAnalyzer | null>(null);
  if (!analyzerRef.current) analyzerRef.current = JournalAnalyzer.baseline();
  // Latest data for async work that finishes after a render. Kept in step with every update.
  const dataRef = useRef(data);
  const readyRef = useRef(false);

  /** Writes the journal to the phone. Called shortly after changes, and when the app goes to the background. */
  const persist = useRef(() => {
    if (!readyRef.current) return;
    AsyncStorage.setItem(DATA_KEY, JSON.stringify(dataRef.current)).catch((e) => console.warn('Could not save', e));
  }).current;

  // Load saved journal and personalised model.
  useEffect(() => {
    (async () => {
      try {
        const [rawData, rawModel] = await Promise.all([AsyncStorage.getItem(DATA_KEY), AsyncStorage.getItem(MODEL_KEY)]);
        if (rawData) {
          dataRef.current = migrate(JSON.parse(rawData));
          setDataState(dataRef.current);
        }
        if (rawModel) {
          analyzerRef.current = JournalAnalyzer.fromJSON(JSON.parse(rawModel) as AnalyzerState);
          setModelVersion((v) => v + 1);
        }
      } catch (error) {
        console.warn('Could not load the journal', error);
      } finally {
        readyRef.current = true;
        setReady(true);
      }
    })();
  }, []);

  // Save a moment after changes settle, rather than on every keystroke of a streaming reply.
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(persist, 400);
    return () => clearTimeout(timer);
  }, [data, ready, persist]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') persist();
    });
    return () => subscription.remove();
  }, [persist]);

  // Keep the morning plan and evening check in step with the lists.
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => refreshDigests(dataRef.current.items, dataRef.current.prefs.dailyDigests).catch(() => {}), 2000);
    return () => clearTimeout(timer);
  }, [data.items, data.prefs.dailyDigests, ready]);

  const actions = useMemo<JournalActions>(() => {
    const setData = (change: (current: Stored) => Stored) => {
      dataRef.current = change(dataRef.current);
      setDataState(dataRef.current);
    };
    const analyzer = () => analyzerRef.current!;
    let replying = false;
    let replyAgain = false;
    /** When Claude last saw the conversation (a reply or a warm-up). */
    let lastCall = 0;

    const saveModel = () => {
      AsyncStorage.setItem(MODEL_KEY, JSON.stringify(analyzerRef.current)).catch(() => {});
      setModelVersion((v) => v + 1);
    };

    const scheduleAll = (items: TrackedItem[]) => {
      for (const item of items) {
        scheduleReminder(item).then((notificationId) => {
          if (notificationId) {
            setData((c) => ({ ...c, items: c.items.map((i) => (i.id === item.id ? { ...i, notificationId } : i)) }));
          }
        });
      }
    };

    const localItems = (entry: JournalEntry): TrackedItem[] =>
      analyzer()
        .analyze(entry.text, new Date(entry.createdAt))
        .map((i) => toItem(entry.id, entry.createdAt, i));

    /** Tells the phone what was saved from an entry, if the user wants that. */
    const announce = (entryId: string) => {
      if (!dataRef.current.prefs.savedNotifications) return;
      const saved = dataRef.current.items.filter((i) => i.entryId === entryId);
      if (saved.length) notifySaved(saved).catch(() => {});
    };

    const setRefining = (entryId: string, on: boolean) =>
      setStatus((s) => ({ ...s, refining: on ? [...s.refining, entryId] : s.refining.filter((id) => id !== entryId) }));

    /** Swaps an entry's untouched items for new ones. Items you ticked or confirmed stay. */
    const replaceItems = (entryId: string, incoming: TrackedItem[]): TrackedItem[] => {
      const current = dataRef.current.items.filter((i) => i.entryId === entryId);
      const touched = current.filter((i) => i.done || i.confirmed);
      const replaced = current.filter((i) => !i.done && !i.confirmed);
      const touchedTitles = new Set(touched.map((i) => i.title.toLowerCase()));
      const fresh = incoming.filter((i) => !touchedTitles.has(i.title.toLowerCase()));
      replaced.forEach((i) => cancelReminder(i.notificationId));
      const replacedIds = new Set(replaced.map((i) => i.id));
      setData((c) => ({ ...c, items: [...c.items.filter((i) => !replacedIds.has(i.id)), ...fresh] }));
      scheduleAll(fresh);
      return fresh;
    };

    /**
     * Lets Claude re-sort an entry. Replaces the quick on-phone result for items the user hasn't
     * touched yet, and teaches the on-phone model from Claude's answer.
     */
    const refineWithClaude = async (entry: JournalEntry, tell = true) => {
      const apiKey = keysRef.current.anthropic;
      if (!apiKey) {
        if (tell) announce(entry.id);
        return;
      }
      setRefining(entry.id, true);
      try {
        const result = await extractWithClaude(apiKey, entry.text, new Date(entry.createdAt), dataRef.current.facts);
        // The message may have been deleted or changed while Claude was working.
        const now = dataRef.current.entries.find((e) => e.id === entry.id);
        if (!now || now.text !== entry.text) return;
        replaceItems(entry.id, result.items.map((i) => toItem(entry.id, entry.createdAt, i)));
        if (result.facts.length) setData((c) => ({ ...c, facts: addFacts(c.facts, result.facts) }));
        for (const i of result.items) analyzer().learn(i.sentence, i.kind, 1);
        saveModel();
      } catch (error) {
        console.warn('Claude could not sort the entry; keeping the on-phone result.', error);
      } finally {
        setRefining(entry.id, false);
        if (tell) announce(entry.id);
      }
    };

    const addItem = (kind: InsightKind, title: string, due: Date | null): string | null => {
      if (kind === 'none' || !title.trim()) return null;
      const now = new Date().toISOString();
      const item = toItem(CHAT_ENTRY_ID, now, { kind, title: title.trim(), sentence: title.trim(), confidence: 1, dueDate: due });
      item.confirmed = true;
      setData((c) => ({ ...c, items: [...c.items, item] }));
      scheduleAll([item]);
      return item.id;
    };

    const appendMessage = (message: Omit<ThreadMessage, 'id' | 'at'>) => {
      setData((c) => ({ ...c, thread: [...c.thread, { id: newId(), at: new Date().toISOString(), ...message }] }));
    };

    /** The conversation as Claude sees it. */
    const conversation = () => historyWindow(dataRef.current.thread.filter((m) => !m.error));

    /** The companion answers everything since its last reply. Runs again if more arrives meanwhile. */
    const reply = async () => {
      const apiKey = keysRef.current.anthropic;
      if (replying) {
        replyAgain = true;
        return;
      }
      if (!apiKey) {
        const last = [...dataRef.current.thread].reverse().find((m) => m.role === 'assistant');
        if (last?.text !== NO_KEY_NOTICE) appendMessage({ role: 'assistant', text: NO_KEY_NOTICE, error: true });
        return;
      }
      replying = true;
      setStatus((s) => ({ ...s, replying: true }));
      // Shows the words as they arrive, about 20 times a second at most.
      let timer: ReturnType<typeof setTimeout> | null = null;
      const stopShowing = () => {
        if (timer) clearTimeout(timer);
        timer = null;
      };
      try {
        do {
          replyAgain = false;
          lastCall = Date.now();
          const history = conversation();
          let shown: Draft = { text: '', status: null };
          const show = (change: Partial<Draft>) => {
            shown = { ...shown, ...change };
            if (!timer) {
              timer = setTimeout(() => {
                timer = null;
                setDraft(shown);
              }, 50);
            }
          };
          setDraft(shown);
          const result = await companionReply(
            apiKey,
            turns(history),
            companionContext(dataRef.current, history),
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
            { onText: (text) => show({ text }), onStatus: (s) => show({ status: s }) },
          );
          stopShowing();
          lastCall = Date.now();
          setDraft(null);
          appendMessage({ role: 'assistant', text: result.text, addedItemIds: result.addedItemIds.length ? result.addedItemIds : undefined });
        } while (replyAgain);
      } catch (error) {
        appendMessage({ role: 'assistant', text: claudeErrorMessage(error), error: true });
      } finally {
        stopShowing();
        replying = false;
        setStatus((s) => ({ ...s, replying: false }));
        setDraft(null);
      }
    };

    /** Replaces (or removes, when `change` returns null) one item and keeps its reminder in sync. */
    const updateItem = (itemId: string, change: (item: TrackedItem) => TrackedItem | null) => {
      const old = dataRef.current.items.find((i) => i.id === itemId);
      if (!old) return;
      const next = change(old);
      cancelReminder(old.notificationId);
      setData((c) => ({
        ...c,
        items: next ? c.items.map((i) => (i.id === itemId ? { ...next, notificationId: null } : i)) : c.items.filter((i) => i.id !== itemId),
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

    const reanalyze = (entryId: string) => {
      const entry = dataRef.current.entries.find((e) => e.id === entryId);
      if (!entry) return;
      replaceItems(entryId, localItems(entry));
      refineWithClaude(entry, false);
    };

    return {
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

      editMessage(id, raw) {
        const text = raw.trim();
        const message = dataRef.current.thread.find((m) => m.id === id);
        if (!text || !message || message.role !== 'user' || message.text === text) return;
        setData((c) => ({
          ...c,
          thread: c.thread.map((m) => (m.id === id ? { ...m, text, edited: true } : m)),
          entries: c.entries.map((e) => (e.id === message.entryId ? { ...e, text } : e)),
        }));
        if (message.entryId) reanalyze(message.entryId);
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
      reanalyze,

      toggleDone(itemId) {
        updateItem(itemId, (i) => ({ ...i, done: !i.done, completedAt: i.done ? null : new Date().toISOString() }));
      },

      removeItem(itemId) {
        updateItem(itemId, () => null);
      },

      renameItem(itemId, raw) {
        const title = raw.trim();
        if (!title) return;
        setData((c) => ({ ...c, items: c.items.map((i) => (i.id === itemId ? { ...i, title, confirmed: true } : i)) }));
      },

      setDue(itemId, due) {
        updateItem(itemId, (i) => ({ ...i, dueDate: due ? due.toISOString() : null, confirmed: true }));
      },

      snooze(itemId, minutes = 60) {
        updateItem(itemId, (i) => ({ ...i, dueDate: new Date(Date.now() + minutes * 60_000).toISOString() }));
      },

      recategorize(itemId, kind) {
        const item = dataRef.current.items.find((i) => i.id === itemId);
        if (!item) return;
        analyzer().learn(item.sentence, kind);
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
        analyzer().learn(item.sentence, item.kind);
        saveModel();
        setData((c) => ({ ...c, items: c.items.map((i) => (i.id === itemId ? { ...i, confirmed: true } : i)) }));
      },

      addItem,

      quickAdd(kind, raw) {
        const text = raw.trim();
        if (!text || kind === 'none') return 0;
        if (kind === 'shopping') {
          const things = shoppingItems(text);
          const titles = things.length ? things : [text[0].toUpperCase() + text.slice(1)];
          const due = titles.length === 1 ? dueDateIn(text) : null;
          titles.forEach((t) => addItem('shopping', t, due));
          return titles.length;
        }
        const due = kind === 'task' ? dueDateIn(text) : null;
        return addItem(kind, kind === 'task' ? taskTitle(text) : text[0].toUpperCase() + text.slice(1), due) ? 1 : 0;
      },

      clearDone(kind) {
        setData((c) => ({ ...c, items: c.items.filter((i) => !(i.kind === kind && i.done)) }));
      },

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

      warmUp() {
        const apiKey = keysRef.current.anthropic;
        if (!apiKey || replying || Date.now() - lastCall < CACHE_WARM_MS) return;
        lastCall = Date.now();
        const history = conversation();
        if (!history.length) return;
        warmCompanion(apiKey, turns(history), companionContext(dataRef.current, history)).catch(() => {});
      },
    };
  }, []);

  const dataValue = useMemo<JournalData>(
    () => ({
      ready,
      entries: data.entries,
      items: data.items,
      facts: data.facts,
      thread: data.thread,
      prefs: data.prefs,
      analyzer: analyzerRef.current!,
      modelVersion,
    }),
    [ready, data, modelVersion],
  );

  return (
    <ActionsContext.Provider value={actions}>
      <DataContext.Provider value={dataValue}>
        <StatusContext.Provider value={status}>
          <DraftContext.Provider value={draft}>{children}</DraftContext.Provider>
        </StatusContext.Provider>
      </DataContext.Provider>
    </ActionsContext.Provider>
  );
}

/** The journal and everything you can do with it. Re-renders when the journal changes. */
export function useJournal(): JournalData & JournalActions {
  const data = useContext(DataContext);
  const actions = useContext(ActionsContext);
  if (!data || !actions) throw new Error('useJournal must be used inside JournalProvider');
  return useMemo(() => ({ ...data, ...actions }), [data, actions]);
}

/** Just the actions. They never change, so components that only act don't re-render. */
export function useJournalActions(): JournalActions {
  const actions = useContext(ActionsContext);
  if (!actions) throw new Error('useJournalActions must be used inside JournalProvider');
  return actions;
}

export function useJournalStatus(): JournalStatus {
  return useContext(StatusContext);
}

/** The reply being written right now. Changes many times a second while it streams. */
export function useDraft(): Draft | null {
  return useContext(DraftContext);
}
