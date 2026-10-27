import { parsePreview, siteOf } from '../../src/ai/preview';
import { cachedJson, publicUrl, readPage } from '../lib/guard';

/**
 * GET /api/preview?url=https://...  →  { url, title, image, site, price }
 * (netlify.toml sends /api/preview here.)
 * The website's link cards: a browser can't read other sites' pages itself.
 */
export default async (req: Request): Promise<Response> => {
  const url = publicUrl(new URL(req.url).searchParams.get('url'));
  if (!url) return new Response('Give a public http(s) link as ?url=', { status: 400 });
  const href = url.toString();
  // Shop pages can be megabytes; the picture is usually named in the head.
  const page = await readPage(href, 600_000, 8000, (text) => /<\/head>/i.test(text) && /og:image|twitter:image/i.test(text));
  if (!page) return cachedJson({ url: href, title: null, image: null, site: siteOf(href), price: null }, 3600);
  if (page.type.startsWith('image/')) return cachedJson({ url: href, title: null, image: href, site: siteOf(href), price: null });
  return cachedJson({ ...parsePreview(page.text, page.finalUrl), url: href });
};

