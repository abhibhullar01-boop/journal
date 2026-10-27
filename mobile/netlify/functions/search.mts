import { parseBing, parseDuckDuckGo } from '../../src/ai/websearch';
import { cachedJson, readPage } from '../lib/guard';

/**
 * GET /api/search?q=running+shoes  →  [{ title, url, snippet }]
 * (netlify.toml sends /api/search here.)
 * The backup search for accounts where Claude's own web search is off.
 */
export default async (req: Request): Promise<Response> => {
  const query = (new URL(req.url).searchParams.get('q') ?? '').trim().slice(0, 200);
  if (!query) return new Response('Give a search as ?q=', { status: 400 });
  const q = encodeURIComponent(query);
  // Search pages put the results after the head, so read further than for a preview.
  const ddg = await readPage(`https://html.duckduckgo.com/html/?q=${q}&kl=in-en`, 400_000, 7000).then((p) => (p ? parseDuckDuckGo(p.text) : []));
  if (ddg.length) return cachedJson(ddg, 3600);
  const bing = await readPage(`https://www.bing.com/search?q=${q}&setlang=en-IN&cc=IN`, 600_000, 7000).then((p) => (p ? parseBing(p.text) : []));
  return cachedJson(bing, bing.length ? 3600 : 60);
};

