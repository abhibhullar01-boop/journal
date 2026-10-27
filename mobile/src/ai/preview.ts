import { cacheStore, httpFetch, readText } from './http';

/** Link previews: the picture, title and site name a page shares about itself. */
export interface LinkPreview {
  url: string;
  title: string | null;
  image: string | null;
  site: string;
  price: string | null;
}

const decode = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();

/** "www.amazon.in" -> "amazon.in" */
export function siteOf(url: string): string {
  const m = /^https?:\/\/([^/?#]+)/i.exec(url);
  return (m?.[1] ?? url).replace(/^www\./i, '').replace(/^m\./i, '');
}

function absolute(src: string, base: string): string {
  if (/^https?:\/\//i.test(src)) return src;
  if (src.startsWith('//')) return `https:${src}`;
  const origin = /^https?:\/\/[^/?#]+/i.exec(base)?.[0] ?? '';
  return src.startsWith('/') ? origin + src : `${origin}/${src}`;
}

/** Value of a <meta> tag by property or name, whichever order the attributes come in. */
function meta(html: string, key: string): string | null {
  const k = key.replace(/[.:]/g, (c) => `\\${c}`);
  const a = new RegExp(`<meta[^>]+(?:property|name|itemprop)\\s*=\\s*["']${k}["'][^>]*?content\\s*=\\s*["']([^"']+)["']`, 'i').exec(html);
  if (a) return decode(a[1]);
  const b = new RegExp(`<meta[^>]+content\\s*=\\s*["']([^"']+)["'][^>]*?(?:property|name|itemprop)\\s*=\\s*["']${k}["']`, 'i').exec(html);
  return b ? decode(b[1]) : null;
}

/** Reads a page's preview from its HTML. Knows a few store layouts that skip the usual tags. */
export function parsePreview(html: string, url: string): LinkPreview {
  const head = html.slice(0, 400_000);
  let image =
    meta(head, 'og:image:secure_url') ??
    meta(head, 'og:image') ??
    meta(head, 'twitter:image') ??
    meta(head, 'twitter:image:src') ??
    meta(head, 'image');
  if (!image) {
    // Amazon puts the main photo in data-old-hires or a "hiRes" field.
    const amazon = /data-old-hires\s*=\s*["'](https:[^"']+)["']/i.exec(head) ?? /"hiRes"\s*:\s*"(https:[^"]+)"/i.exec(head) ?? /"large"\s*:\s*"(https:[^"]+)"/i.exec(head);
    const link = /<link[^>]+rel\s*=\s*["']image_src["'][^>]*href\s*=\s*["']([^"']+)["']/i.exec(head);
    const jsonLd = /"image"\s*:\s*\[?\s*"(https?:[^"]+)"/i.exec(head);
    image = amazon?.[1] ?? link?.[1] ?? jsonLd?.[1] ?? null;
  }
  const rawTitle = meta(head, 'og:title') ?? meta(head, 'twitter:title') ?? /<title[^>]*>([^<]+)<\/title>/i.exec(head)?.[1] ?? null;
  const title = rawTitle ? decode(rawTitle).replace(/\s+/g, ' ').slice(0, 140) : null;
  const amount = meta(head, 'product:price:amount') ?? meta(head, 'og:price:amount') ?? meta(head, 'price');
  const currency = meta(head, 'product:price:currency') ?? meta(head, 'og:price:currency') ?? meta(head, 'priceCurrency');
  const symbol = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : currency ? `${currency} ` : '';
  return {
    url,
    title,
    image: image ? absolute(decode(image), url) : null,
    site: meta(head, 'og:site_name') ?? siteOf(url),
    price: amount ? `${symbol}${amount}` : null,
  };
}

const cache = new Map<string, Promise<LinkPreview>>();

/**
 * A browser may not read other sites' pages (CORS), so the website asks its own server for
 * previews instead: GET <endpoint>?url=... answers with a LinkPreview.
 */
let endpoint: string | null = null;
export function setPreviewEndpoint(url: string | null): void {
  endpoint = url;
}
const BROWSER_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

/** Previews saved on the phone, so pictures show up straight away after a restart. */
const STORE_KEY = 'voice-journal/previews/v1';
const STORE_LIMIT = 300;
let saved: Record<string, LinkPreview & { at: number }> | null = null;
let loadingSaved: Promise<void> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function loadSaved(): Promise<void> {
  if (!loadingSaved) {
    loadingSaved = (async () => {
      try {
        const raw = await cacheStore()?.get(STORE_KEY);
        saved = raw ? JSON.parse(raw) : {};
      } catch {
        saved = {};
      }
    })();
  }
  return loadingSaved;
}

function remember(preview: LinkPreview) {
  if (!saved || !cacheStore()) return;
  saved[preview.url] = { ...preview, at: Date.now() };
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const newest = Object.values(saved!)
      .sort((a, b) => b.at - a.at)
      .slice(0, STORE_LIMIT);
    saved = Object.fromEntries(newest.map((p) => [p.url, p]));
    cacheStore()
      ?.set(STORE_KEY, JSON.stringify(saved))
      .catch(() => {});
  }, 1500);
}

/** Enough of the page has arrived once the head is done and it named a picture. */
const hasHeadAndImage = (text: string) => /<\/head>/i.test(text) && /og:image|twitter:image/i.test(text);

/** Fetches a page's preview once. Never throws: a page that won't load gets a plain card. */
export function fetchPreview(url: string): Promise<LinkPreview> {
  let pending = cache.get(url);
  if (!pending) {
    pending = (async () => {
      await loadSaved();
      const known = saved?.[url];
      if (known && (known.image || Date.now() - known.at < 24 * 3600_000)) return known;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        if (endpoint) {
          const response = await globalThis.fetch(`${endpoint}?url=${encodeURIComponent(url)}`, { signal: controller.signal });
          clearTimeout(timer);
          if (!response.ok) throw new Error(`Preview ${response.status}`);
          const found = (await response.json()) as LinkPreview;
          const preview = { url, title: found.title ?? null, image: found.image ?? null, site: found.site || siteOf(url), price: found.price ?? null };
          remember(preview);
          return preview;
        }
        const response = await httpFetch(url, { headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' }, signal: controller.signal });
        const type = response.headers.get('content-type') ?? '';
        let preview: LinkPreview;
        if (type.startsWith('image/')) {
          preview = { url, title: null, image: url, site: siteOf(url), price: null };
        } else {
          // Shop pages can be megabytes; the picture is near the top.
          const html = await readText(response, 600_000, hasHeadAndImage);
          preview = { ...parsePreview(html, response.url || url), url };
        }
        clearTimeout(timer);
        remember(preview);
        return preview;
      } catch {
        return { url, title: null, image: null, site: siteOf(url), price: null };
      }
    })();
    cache.set(url, pending);
  }
  return pending;
}
