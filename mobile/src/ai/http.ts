/**
 * The fetch the app uses for web pages. The app swaps in Expo's fetch, which can stream, so a
 * page can be read only as far as needed; tests use the global one.
 */
type FetchLike = (url: string, init?: any) => Promise<any>;

let impl: FetchLike = (url, init) => globalThis.fetch(url, init);

export function setHttpFetch(f: FetchLike): void {
  impl = f;
}

export function httpFetch(url: string, init?: any): Promise<Response> {
  return impl(url, init);
}

/**
 * Reads a page's text, stopping at `limit` characters, or earlier once `enough` says the
 * useful part has arrived. Saves time and data on big shop pages.
 */
export async function readText(response: Response, limit: number, enough?: (text: string) => boolean): Promise<string> {
  const reader = (response.body as any)?.getReader?.();
  if (!reader) return (await response.text()).slice(0, limit);
  const decoder = new TextDecoder();
  let text = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      if (text.length >= limit || enough?.(text)) {
        reader.cancel?.().catch?.(() => {});
        break;
      }
    }
  } catch {
    // Keep what arrived.
  }
  return text.slice(0, limit);
}

/** Small key-value storage for caches, so they survive restarts. The app plugs in AsyncStorage. */
export interface CacheStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

let store: CacheStore | null = null;

export function setCacheStore(s: CacheStore): void {
  store = s;
}

export function cacheStore(): CacheStore | null {
  return store;
}
