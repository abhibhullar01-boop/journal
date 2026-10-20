import type { InsightKind } from '../brain';

export type CaptureMode = 'voice' | 'text';

export interface JournalEntry {
  id: string;
  createdAt: string; // ISO date
  text: string;
  source: CaptureMode;
}

/** A task, skill or goal found in an entry. */
export interface TrackedItem {
  id: string;
  entryId: string;
  kind: InsightKind;
  title: string;
  sentence: string;
  confidence: number;
  dueDate: string | null; // ISO date
  done: boolean;
  completedAt: string | null;
  createdAt: string;
  /** True once the user confirmed or corrected the category. */
  confirmed: boolean;
  /** Scheduled reminder, if any. */
  notificationId: string | null;
}
