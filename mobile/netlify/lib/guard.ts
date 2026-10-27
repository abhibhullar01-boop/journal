/**
 * Shared checks for the website's two helper functions: only public web pages, read with a
 * time limit and a size limit.
 */
const PRIVATE_HOST =
  /^(localhost|.*\.local|.*\.internal|0\.0\.0\.0|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|169\.254\.\d+\.\d+|\[?::1\]?|\[?f[cd][0-9a-f]{2}:.*)$/i;

/** A public http(s) address, or null. */
export function publicUrl(raw: string | null): URL | null {
  if (!raw || raw.length > 2048) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (url.username || url.password || PRIVATE_HOST.test(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

export const BROWSER_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

/**
 * Fetches a page and reads at most `limit` characters, giving up after `ms`, or sooner once
 * `enough` says the useful part has arrived.
 */
export async function readPage(
  url: string,
  limit: number,
  ms = 8000,
  enough?: (text: string) => boolean,
): Promise<{ text: string; type: string; finalUrl: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'en-IN,en;q=0.9' },
      redirect: 'follow',
      signal: controller.signal,
    });
    const type = response.headers.get('content-type') ?? '';
    if (!response.ok) return null;
    if (type.startsWith('image/')) return { text: '', type, finalUrl: response.url || url };
    const reader = response.body?.getReader();
    if (!reader) return { text: (await response.text()).slice(0, limit), type, finalUrl: response.url || url };
    const decoder = new TextDecoder();
    let text = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      if (text.length >= limit || enough?.(text)) {
        reader.cancel().catch(() => {});
        break;
      }
    }
    return { text: text.slice(0, limit), type, finalUrl: response.url || url };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** JSON that Netlify's CDN may keep for a day, so the same link isn't fetched twice. */
export function cachedJson(body: unknown, seconds = 86400): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=3600',
      'netlify-cdn-cache-control': `public, s-maxage=${seconds}, stale-while-revalidate=604800`,
    },
  });
}
