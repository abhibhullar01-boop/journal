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

/** One message in the single, ongoing conversation. */
export interface ThreadMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  at: string; // ISO
  /** User messages are journal entries too: the entry id (same as the message id). */
  entryId?: string;
  source?: CaptureMode;
  /** Items the companion added from this reply. */
  addedItemIds?: string[];
  /** True when the reply is an error notice (not sent back to Claude as history). */
  error?: boolean;
  /** You changed the words after sending. */
  edited?: boolean;
}

export interface Preferences {
  /** Show a notification each time something is saved to your lists. */
  savedNotifications: boolean;
  /** The 8:30 morning plan, the 8:30 pm check and the Sunday check-in. */
  dailyDigests: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = { savedNotifications: true, dailyDigests: true };
