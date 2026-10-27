/// <reference types="node" />
// The website's helpers: its two server functions, and recordings made in a browser.
import assert from 'node:assert/strict';
import { test } from 'node:test';

const withFetch = async (fake: (url: string, init?: any) => Response | Promise<Response>, run: () => Promise<void>) => {
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: any, init?: any) => fake(String(url), init)) as typeof fetch;
  try {
    await run();
  } finally {
    globalThis.fetch = original;
  }
};

test('website: /api/preview reads a shop page and refuses private addresses', async () => {
  const { default: preview } = await import('../../../netlify/functions/preview.mjs');
  const asked: string[] = [];
  await withFetch(
    (url) => {
      asked.push(url);
      return new Response(
        '<html><head><meta property="og:title" content="ASICS Gel-Contend 9"><meta content="https://img.example/shoe.jpg" property="og:image"><meta property="product:price:amount" content="3999"><meta property="product:price:currency" content="INR"></head><body>…</body></html>',
        { headers: { 'content-type': 'text/html' } },
      );
    },
    async () => {
      const ok = await preview(new Request('https://journal.example/api/preview?url=https%3A%2F%2Fwww.asics.com%2Fin%2Fshoe'));
      assert.equal(ok.status, 200);
      assert.match(ok.headers.get('netlify-cdn-cache-control') ?? '', /s-maxage/);
      const body = await ok.json();
      assert.equal(body.title, 'ASICS Gel-Contend 9');
      assert.equal(body.image, 'https://img.example/shoe.jpg');
      assert.equal(body.price, '₹3999');
      assert.equal(body.site, 'asics.com');
      for (const bad of ['http://localhost:8080/x', 'http://192.168.1.10/', 'file:///etc/passwd', 'javascript:alert(1)', 'http://user:pw@example.com/']) {
        const refused = await preview(new Request(`https://journal.example/api/preview?url=${encodeURIComponent(bad)}`));
        assert.equal(refused.status, 400, bad);
      }
      assert.equal(asked.length, 1, 'private addresses are never fetched');
    },
  );
});

test('website: /api/preview gives a plain card when the page fails', async () => {
  const { default: preview } = await import('../../../netlify/functions/preview.mjs');
  await withFetch(
    () => new Response('nope', { status: 503 }),
    async () => {
      const body = await (await preview(new Request('https://journal.example/api/preview?url=https%3A%2F%2Fexample.com%2Fa'))).json();
      assert.deepEqual(body, { url: 'https://example.com/a', title: null, image: null, site: 'example.com', price: null });
    },
  );
});

test('website: /api/search returns DuckDuckGo results, then tries Bing', async () => {
  const { default: search } = await import('../../../netlify/functions/search.mjs');
  const ddg =
    '<html><head></head><body><a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.nike.com%2Fin%2Fshoe&amp;rut=x">Nike Revolution 7</a><a class="result__snippet" href="#">Light road running shoe</a></body></html>';
  await withFetch(
    (url) => new Response(url.includes('duckduckgo') ? ddg : '', { headers: { 'content-type': 'text/html' } }),
    async () => {
      const results = await (await search(new Request('https://journal.example/api/search?q=running+shoes'))).json();
      assert.deepEqual(results, [{ title: 'Nike Revolution 7', url: 'https://www.nike.com/in/shoe', snippet: 'Light road running shoe' }]);
    },
  );
  const bing =
    '<ol><li class="b_algo"><h2><a href="https://www.asics.com/in/shoe">ASICS Gel</a></h2><p>Cushioned trainer</p></li></ol>';
  await withFetch(
    (url) => new Response(url.includes('bing') ? bing : '<html></html>', { headers: { 'content-type': 'text/html' } }),
    async () => {
      const results = await (await search(new Request('https://journal.example/api/search?q=shoes'))).json();
      assert.equal(results[0].url, 'https://www.asics.com/in/shoe');
    },
  );
  assert.equal((await search(new Request('https://journal.example/api/search?q='))).status, 400);
});

test('website: a browser recording uploads as a named file', async () => {
  const { transcribe, audioFileName } = await import('../transcribe');
  assert.equal(audioFileName('audio/webm;codecs=opus'), 'entry.webm');
  assert.equal(audioFileName('audio/mp4'), 'entry.mp4');
  assert.equal(audioFileName('audio/ogg; codecs=opus'), 'entry.ogg');
  let file: File | null = null;
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: any, init?: any) => {
    if (String(url).startsWith('data:')) return original(url);
    file = (init.body as FormData).get('file') as File;
    return new Response(JSON.stringify({ text: 'Buy milk' }), { status: 200 });
  }) as typeof fetch;
  try {
    const heard = await transcribe('data:audio/webm;codecs=opus;base64,GkXfo0AgQoaBAUL3gQFC8oEEQvOBCEKCQAR3ZWJtQoeBAkKFgQIYU4BnQI0VSalmQCgq17FAAw9CQE2AQAZ3aGFtbXlXQUAGd2hhbW15RIlACECPQAAAAAAAFlSua0AxrkAu14EBY8WBAZyBACK1nEADdW5khkAFVl9WUDglhohAA1ZQOIOBAeBABrCBCLqBCB9DtnVAIueBAKNAHIEAAIAwAQCdASoIAAgAAUAmJaQAA3AA/vz0AAA=', 'sk-test');
    assert.equal(heard, 'Buy milk');
    assert.ok(file, 'a file was attached');
    assert.equal((file as unknown as File).name, 'entry.webm');
  } finally {
    globalThis.fetch = original;
  }
});
