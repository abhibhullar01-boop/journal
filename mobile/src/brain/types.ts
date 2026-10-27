/** The categories a journal sentence can fall into. */
export type InsightKind = 'task' | 'shopping' | 'skill' | 'goal' | 'none';

export const ALL_KINDS: InsightKind[] = ['task', 'shopping', 'skill', 'goal', 'none'];
/** The kinds that become tracked items in the app. */
export const TRACKABLE_KINDS: InsightKind[] = ['task', 'shopping', 'skill', 'goal'];

export const KIND_LABEL: Record<InsightKind, string> = {
  task: 'Task',
  shopping: 'To buy',
  skill: 'Skill',
  goal: 'Goal',
  none: 'Reflection',
};

export const KIND_PLURAL: Record<InsightKind, string> = {
  task: 'Tasks',
  shopping: 'Shopping',
  skill: 'Skills',
  goal: 'Goals',
  none: 'Reflections',
};

export type Scores = Record<InsightKind, number>;

export interface LabeledSentence {
  text: string;
  label: InsightKind;
  /** How much this example counts when learned on the phone (corrections count more). */
  weight?: number;
}

export interface Classification {
  kind: InsightKind;
  /** Combined score of the winning kind, 0 to 1. */
  confidence: number;
  scores: Scores;
}

/** A trackable item pulled out of a journal entry. */
export interface ExtractedInsight {
  kind: InsightKind;
  /** Short, cleaned-up title, e.g. "Call mom tomorrow". */
  title: string;
  /** The sentence it came from. */
  sentence: string;
  confidence: number;
  /** When a reminder makes sense (tasks with a time cue only). */
  dueDate: Date | null;
}

export function emptyScores(): Scores {
  return { task: 0, shopping: 0, skill: 0, goal: 0, none: 0 };
}
