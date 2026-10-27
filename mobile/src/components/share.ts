import { Platform, Share } from 'react-native';
import { toast } from './dialog';
import { hasFinePointer } from './layout';

/**
 * Shares text. A phone opens its share sheet. A computer saves a file (when there is a file
 * name) or copies to the clipboard; a phone's browser uses its own share sheet.
 */
export async function shareText(text: string, options: { title?: string; filename?: string } = {}): Promise<void> {
  if (Platform.OS !== 'web') {
    await Share.share({ title: options.title, message: text }).catch(() => {});
    return;
  }
  const nav = globalThis.navigator as (Navigator & { share?: (data: { title?: string; text?: string }) => Promise<void> }) | undefined;
  if (nav?.share && !hasFinePointer()) {
    // Cancelling the sheet rejects; that's fine.
    await nav.share({ title: options.title, text }).catch(() => {});
    return;
  }
  if (options.filename) {
    download(options.filename, text);
    toast('Saved to your downloads');
    return;
  }
  await copyText(text);
}

/** Copies text and says so. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await globalThis.navigator.clipboard.writeText(text);
    toast('Copied');
    return true;
  } catch {
    toast("Couldn't copy. Select the text instead.");
    return false;
  }
}

function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
