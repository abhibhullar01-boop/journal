/**
 * A backup web search the phone runs itself, for accounts where Claude's own web search is off.
 * Reads the plain-HTML result pages of DuckDuckGo (then Bing) and returns titles, links and snippets.
 */
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();

/** DuckDuckGo wraps links as //duckduckgo.com/l/?uddg=<real url>. */
function unwrap(href: string): string {
  const m = /[?&]uddg=([^&]+)/.exec(href);
  const url = m ? decodeURIComponent(m[1]) : href.replace(/&amp;/g, '&');
  return url.startsWith('//') ? `https:${url}` : url;
}

export function parseDuckDuckGo(html: string): SearchResult[] {
  const results: SearchResult[] = [];
  const re = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>([\s\S]*?)(?=<a[^>]+class="[^"]*result__a|$)/g;
  for (let m = re.exec(html); m && results.length < 8; m = re.exec(html)) {
    const url = unwrap(m[1]);
    if (!/^https?:\/\//.test(url) || /duckduckgo\.com\/y\.js|ad_provider/.test(url)) continue;
    const snippet = /class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/.exec(m[3])?.[1] ?? '';
    results.push({ title: decode(m[2]), url, snippet: decode(snippet).slice(0, 220) });
  }
  return results;
}

export function parseBing(html: string): SearchResult[] {
  const results: SearchResult[] = [];
  const re = /<li class="b_algo"[\s\S]*?<h2[^>]*><a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a><\/h2>([\s\S]*?)<\/li>/g;
  for (let m = re.exec(html); m && results.length < 8; m = re.exec(html)) {
    const snippet = /<p[^>]*>([\s\S]*?)<\/p>/.exec(m[3])?.[1] ?? '';
    results.push({ title: decode(m[2]), url: m[1].replace(/&amp;/g, '&'), snippet: decode(snippet).slice(0, 220) });
  }
  return results;
}

const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

async function get(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html', 'Accept-Language': 'en-IN,en;q=0.9' }, signal: controller.signal });
    return response.ok ? await response.text() : '';
  } finally {
    clearTimeout(timer);
  }
}

/** The website searches through its own server (GET <endpoint>?q=...), since a browser can't read the engines' pages. */
let endpoint: string | null = null;
export function setSearchEndpoint(url: string | null): void {
  endpoint = url;
}

/** Searches the web from the phone. Returns an empty list when both engines fail. */
export async function searchWeb(query: string): Promise<SearchResult[]> {
  const q = encodeURIComponent(query);
  if (endpoint) {
    try {
      const response = await globalThis.fetch(`${endpoint}?q=${q}`);
      return response.ok ? ((await response.json()) as SearchResult[]) : [];
    } catch {
      return [];
    }
  }
  try {
    const ddg = parseDuckDuckGo(await get(`https://html.duckduckgo.com/html/?q=${q}&kl=in-en`));
    if (ddg.length) return ddg;
  } catch {
    // try the next engine
  }
  try {
    return parseBing(await get(`https://www.bing.com/search?q=${q}&setlang=en-IN&cc=IN`));
  } catch {
    return [];
  }
}
