import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ChatTurn, claudeErrorMessage, companionReply, extractWithClaude } from '../ai/claude';
import { useKeys } from '../ai/keys';
import { AnalyzerState, dueDateIn, ExtractedInsight, InsightKind, JournalAnalyzer } from '../brain';
import { cancelReminder, refreshDigests, scheduleReminder } from './reminders';
import type { CaptureMode, JournalEntry, TrackedItem } from './types';

const DATA_KEY = 'voice-journal/data/v1';
const MODEL_KEY = 'voice-journal/model/v2';

interface Stored {
  entries: JournalEntry[];
  items: TrackedItem[];
  /** Things the companion knows about the user ("Anaya is their daughter."). */
  facts: string[];
  chat: ChatTurn[];
}

/** Items added from the chat belong to this pseudo entry. */
export const CHAT_ENTRY_ID = 'chat';

interface JournalContextValue {
  ready: boolean;
  entries: JournalEntry[];
  items: TrackedItem[];
  facts: string[];
  chat: ChatTurn[];
  chatBusy: boolean;
  /** Entries Claude is still sorting. */
  refining: string[];
  analyzer: JournalAnalyzer;
  /** Changes whenever the model learns, so screens can re-evaluate. */
  modelVersion: number;
  /** Saves an entry and returns its id. Items appear right away and get refined by Claude when a key is set. */
  addEntry(text: string, source: CaptureMode): string;
  deleteEntry(id: string): void;
  reanalyze(entryId: string): void;
  toggleDone(itemId: string): void;
  snooze(itemId: string, minutes?: number): void;
  recategorize(itemId: string, kind: InsightKind): void;
  confirm(itemId: string): void;
  addItem(kind: InsightKind, title: string, due: Date | null): void;
  sendChat(text: string): Promise<void>;
  clearChat(): void;
  forgetFact(index: number): void;
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

export function JournalProvider({ children }: { children: ReactNode }) {
  const keys = useKeys();
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<Stored>({ entries: [], items: [], facts: [], chat: [] });
  const [modelVersion, setModelVersion] = useState(0);
  const [refining, setRefining] = useState<string[]>([]);
  const [chatBusy, setChatBusy] = useState(false);
  const analyzerRef = useRef<JournalAnalyzer | null>(null);
  if (!analyzerRef.current) analyzerRef.current = JournalAnalyzer.baseline();
  // Latest data for async work that finishes after a render.
  const dataRef = useRef(data);
  dataRef.current = data;

  // Load saved journal and personalised model.
  useEffect(() => {
    (async () => {
      try {
        const [rawData, rawModel] = await Promise.all([AsyncStorage.getItem(DATA_KEY), AsyncStorage.getItem(MODEL_KEY)]);
        if (rawData) {
          const saved = JSON.parse(rawData) as Partial<Stored>;
          setData({ entries: saved.entries ?? [], items: saved.items ?? [], facts: saved.facts ?? [], chat: saved.chat ?? [] });
        }
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
  }, []);

  // Save after every change, and keep the digest notifications current.
  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(DATA_KEY, JSON.stringify(data)).catch((e) => console.warn('Could not save', e));
    refreshDigests(data.items).catch(() => {});
  }, [data, ready]);

  const saveModel = useCallback(() => {
    AsyncStorage.setItem(MODEL_KEY, JSON.stringify(analyzerRef.current)).catch(() => {});
    setModelVersion((v) => v + 1);
  }, []);

  const scheduleAll = useCallback((items: TrackedItem[]) => {
    for (const item of items) {
      scheduleReminder(item).then((notificationId) => {
        if (notificationId) {
          setData((c) => ({ ...c, items: c.items.map((i) => (i.id === item.id ? { ...i, notificationId } : i)) }));
        }
      });
    }
  }, []);

  const localItems = useCallback((entry: JournalEntry): TrackedItem[] => {
    return analyzerRef.current!.analyze(entry.text, new Date(entry.createdAt)).map((i) => toItem(entry.id, entry.createdAt, i));
  }, []);

  /**
   * Lets Claude re-sort an entry. Replaces the quick on-phone result for items the user hasn't
   * touched yet, and teaches the on-phone model from Claude's answer.
   */
  const refineWithClaude = useCallback(
    async (entry: JournalEntry) => {
      const apiKey = keys.anthropic;
      if (!apiKey) return;
      setRefining((r) => [...r, entry.id]);
      try {
        const result = await extractWithClaude(apiKey, entry.text, new Date(entry.createdAt), dataRef.current.facts);
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
      }
    },
    [keys.anthropic, scheduleAll, saveModel],
  );

  const value = useMemo<JournalContextValue>(() => {
    /** Replaces (or removes, when `change` returns null) one item and keeps its reminder in sync. */
    const updateItem = (itemId: string, change: (item: TrackedItem) => TrackedItem | null) => {
      const old = data.items.find((i) => i.id === itemId);
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

    const addItem = (kind: InsightKind, title: string, due: Date | null) => {
      if (kind === 'none') return;
      const now = new Date().toISOString();
      const item = toItem(CHAT_ENTRY_ID, now, { kind, title, sentence: title, confidence: 1, dueDate: due });
      item.confirmed = true;
      setData((c) => ({ ...c, items: [...c.items, item] }));
      scheduleAll([item]);
    };

    return {
      ready,
      entries: data.entries,
      items: data.items,
      facts: data.facts,
      chat: data.chat,
      chatBusy,
      refining,
      analyzer: analyzerRef.current!,
      modelVersion,

      addEntry(text, source) {
        const entry: JournalEntry = { id: newId(), createdAt: new Date().toISOString(), text: text.trim(), source };
        const items = localItems(entry);
        setData((c) => ({ ...c, entries: [entry, ...c.entries], items: [...c.items, ...items] }));
        dataRef.current = { ...dataRef.current, entries: [entry, ...dataRef.current.entries], items: [...dataRef.current.items, ...items] };
        scheduleAll(items);
        refineWithClaude(entry);
        return entry.id;
      },

      deleteEntry(id) {
        data.items.filter((i) => i.entryId === id).forEach((i) => cancelReminder(i.notificationId));
        setData((c) => ({ ...c, entries: c.entries.filter((e) => e.id !== id), items: c.items.filter((i) => i.entryId !== id) }));
      },

      reanalyze(entryId) {
        const entry = data.entries.find((e) => e.id === entryId);
        if (!entry) return;
        data.items.filter((i) => i.entryId === entryId).forEach((i) => cancelReminder(i.notificationId));
        const items = localItems(entry);
        setData((c) => ({ ...c, items: [...c.items.filter((i) => i.entryId !== entryId), ...items] }));
        dataRef.current = { ...dataRef.current, items: [...dataRef.current.items.filter((i) => i.entryId !== entryId), ...items] };
        scheduleAll(items);
        refineWithClaude(entry);
      },

      toggleDone(itemId) {
        updateItem(itemId, (i) => ({ ...i, done: !i.done, completedAt: i.done ? null : new Date().toISOString() }));
      },

      snooze(itemId, minutes = 60) {
        updateItem(itemId, (i) => ({ ...i, dueDate: new Date(Date.now() + minutes * 60_000).toISOString() }));
      },

      recategorize(itemId, kind) {
        const item = data.items.find((i) => i.id === itemId);
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
        const item = data.items.find((i) => i.id === itemId);
        if (!item || item.confirmed) return;
        analyzerRef.current!.learn(item.sentence, item.kind);
        saveModel();
        setData((c) => ({ ...c, items: c.items.map((i) => (i.id === itemId ? { ...i, confirmed: true } : i)) }));
      },

      addItem,

      async sendChat(text) {
        const apiKey = keys.anthropic;
        const userTurn: ChatTurn = { role: 'user', text: text.trim(), at: new Date().toISOString() };
        const history = [...dataRef.current.chat, userTurn];
        setData((c) => ({ ...c, chat: [...c.chat, userTurn] }));
        if (!apiKey) {
          const reply: ChatTurn = {
            role: 'assistant',
            text: 'To chat with me, add your Claude key in Settings (the gear on the Today tab). It takes a minute.',
            at: new Date().toISOString(),
          };
          setData((c) => ({ ...c, chat: [...c.chat, reply] }));
          return;
        }
        setChatBusy(true);
        try {
          const current = dataRef.current;
          const answer = await companionReply(
            apiKey,
            history,
            {
              now: new Date(),
              facts: current.facts,
              openItems: current.items
                .filter((i) => !i.done)
                .map((i) => ({ id: i.id, kind: i.kind, title: i.title, due: i.dueDate ? new Date(i.dueDate) : null })),
              recentEntries: current.entries.slice(0, 60).map((e) => ({ at: new Date(e.createdAt), text: e.text })),
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
          );
          setData((c) => ({ ...c, chat: [...c.chat, { role: 'assistant', text: answer, at: new Date().toISOString() }] }));
        } catch (error) {
          setData((c) => ({ ...c, chat: [...c.chat, { role: 'assistant', text: claudeErrorMessage(error), at: new Date().toISOString() }] }));
        } finally {
          setChatBusy(false);
        }
      },

      clearChat() {
        setData((c) => ({ ...c, chat: [] }));
      },

      forgetFact(index) {
        setData((c) => ({ ...c, facts: c.facts.filter((_, i) => i !== index) }));
      },

      resetModel() {
        analyzerRef.current = JournalAnalyzer.baseline();
        AsyncStorage.removeItem(MODEL_KEY).catch(() => {});
        setModelVersion((v) => v + 1);
      },
    };
  }, [ready, data, modelVersion, refining, chatBusy, keys.anthropic, localItems, refineWithClaude, scheduleAll, saveModel]);

  return <JournalContext.Provider value={value}>{children}</JournalContext.Provider>;
}

export function useJournal(): JournalContextValue {
  const value = useContext(JournalContext);
  if (!value) throw new Error('useJournal must be used inside JournalProvider');
  return value;
}
