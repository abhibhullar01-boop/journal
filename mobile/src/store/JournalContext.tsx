import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AnalyzerState, dueDateIn, InsightKind, JournalAnalyzer } from '../brain';
import { cancelReminder, refreshDigests, scheduleReminder } from './reminders';
import type { CaptureMode, JournalEntry, TrackedItem } from './types';

const DATA_KEY = 'voice-journal/data/v1';
const MODEL_KEY = 'voice-journal/model/v2';

interface Stored {
  entries: JournalEntry[];
  items: TrackedItem[];
}

interface JournalContextValue {
  ready: boolean;
  entries: JournalEntry[];
  items: TrackedItem[];
  analyzer: JournalAnalyzer;
  /** Changes whenever the model learns, so screens can re-evaluate. */
  modelVersion: number;
  addEntry(text: string, source: CaptureMode): TrackedItem[];
  deleteEntry(id: string): void;
  reanalyze(entryId: string): void;
  toggleDone(itemId: string): void;
  snooze(itemId: string, minutes?: number): void;
  recategorize(itemId: string, kind: InsightKind): void;
  confirm(itemId: string): void;
  resetModel(): void;
}

const JournalContext = createContext<JournalContextValue | null>(null);

let counter = 0;
const newId = () => `${Date.now().toString(36)}-${(counter++).toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export function JournalProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<Stored>({ entries: [], items: [] });
  const [modelVersion, setModelVersion] = useState(0);
  const analyzerRef = useRef<JournalAnalyzer | null>(null);
  if (!analyzerRef.current) analyzerRef.current = JournalAnalyzer.baseline();

  // Load saved journal and personalised model.
  useEffect(() => {
    (async () => {
      try {
        const [rawData, rawModel] = await Promise.all([AsyncStorage.getItem(DATA_KEY), AsyncStorage.getItem(MODEL_KEY)]);
        if (rawData) setData(JSON.parse(rawData) as Stored);
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

  const itemsFor = useCallback((entry: JournalEntry): TrackedItem[] => {
    const analyzer = analyzerRef.current!;
    return analyzer.analyze(entry.text, new Date(entry.createdAt)).map((insight) => ({
      id: newId(),
      entryId: entry.id,
      kind: insight.kind,
      title: insight.title,
      sentence: insight.sentence,
      confidence: insight.confidence,
      dueDate: insight.dueDate ? insight.dueDate.toISOString() : null,
      done: false,
      completedAt: null,
      createdAt: entry.createdAt,
      confirmed: false,
      notificationId: null,
    }));
  }, []);

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

    return {
      ready,
      entries: data.entries,
      items: data.items,
      analyzer: analyzerRef.current!,
      modelVersion,

      addEntry(text, source) {
        const entry: JournalEntry = { id: newId(), createdAt: new Date().toISOString(), text: text.trim(), source };
        const items = itemsFor(entry);
        setData((c) => ({ entries: [entry, ...c.entries], items: [...c.items, ...items] }));
        scheduleAll(items);
        return items;
      },

      deleteEntry(id) {
        data.items.filter((i) => i.entryId === id).forEach((i) => cancelReminder(i.notificationId));
        setData((c) => ({ entries: c.entries.filter((e) => e.id !== id), items: c.items.filter((i) => i.entryId !== id) }));
      },

      reanalyze(entryId) {
        const entry = data.entries.find((e) => e.id === entryId);
        if (!entry) return;
        data.items.filter((i) => i.entryId === entryId).forEach((i) => cancelReminder(i.notificationId));
        const items = itemsFor(entry);
        setData((c) => ({ ...c, items: [...c.items.filter((i) => i.entryId !== entryId), ...items] }));
        scheduleAll(items);
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

      resetModel() {
        analyzerRef.current = JournalAnalyzer.baseline();
        AsyncStorage.removeItem(MODEL_KEY).catch(() => {});
        setModelVersion((v) => v + 1);
      },
    };
  }, [ready, data, modelVersion, itemsFor, scheduleAll, saveModel]);

  return <JournalContext.Provider value={value}>{children}</JournalContext.Provider>;
}

export function useJournal(): JournalContextValue {
  const value = useContext(JournalContext);
  if (!value) throw new Error('useJournal must be used inside JournalProvider');
  return value;
}
