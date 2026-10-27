/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { linksIn, parseMarkdown, parseSpans } from '../markdown';
import { parsePreview, siteOf } from '../preview';

test('markdown: bold, links, bare urls, bullets and pictures', () => {
  assert.deepEqual(parseSpans('Try **this** [Asics Gel](https://asics.com/x) or https://flipkart.com/y.'), [
    { type: 'text', text: 'Try ', bold: undefined },
    { type: 'text', text: 'this', bold: true },
    { type: 'text', text: ' ', bold: undefined },
    { type: 'link', text: 'Asics Gel', url: 'https://asics.com/x', bold: undefined },
    { type: 'text', text: ' or ', bold: undefined },
    { type: 'link', text: 'flipkart.com/y', url: 'https://flipkart.com/y', bold: undefined },
    { type: 'text', text: '.', bold: undefined },
  ]);
  const lines = parseMarkdown('## Options\n- [A](https://a.com) cheap\n\n2. second\n![shoe](https://img.com/s.jpg)');
  assert.deepEqual(lines.map((l) => l.type), ['paragraph', 'bullet', 'bullet', 'image']);
  assert.equal((lines[2] as any).marker, '2.');
  assert.deepEqual(linksIn('- [A](https://a.com) – about ₹4,000, comfy\n- [A again](https://a.com) and https://b.com/p'), [
    { url: 'https://a.com', label: 'A', note: 'about ₹4,000, comfy' },
    { url: 'https://b.com/p', label: 'b.com/p', note: '' },
  ]);
});

test('previews read Open Graph tags in either attribute order', () => {
  const html = `<html><head><title>Fallback</title>
    <meta content="Asics Gel-Contend 9 &amp; more" property="og:title">
    <meta property="og:image" content="/img/shoe.jpg" />
    <meta property="og:site_name" content="ASICS India">
    <meta property="product:price:amount" content="3999"><meta property="product:price:currency" content="INR">
  </head></html>`;
  const p = parsePreview(html, 'https://www.asics.com/in/en-in/gel/p/123');
  assert.equal(p.title, 'Asics Gel-Contend 9 & more');
  assert.equal(p.image, 'https://www.asics.com/img/shoe.jpg');
  assert.equal(p.site, 'ASICS India');
  assert.equal(p.price, '₹3999');
});

test('previews find Amazon pictures and fall back to the page title', () => {
  const html = `<title>Boat Airdopes 141 : Amazon.in: Electronics</title><img id="landingImage" data-old-hires="https://m.media-amazon.com/images/I/61.jpg" >`;
  const p = parsePreview(html, 'https://www.amazon.in/dp/B09');
  assert.equal(p.image, 'https://m.media-amazon.com/images/I/61.jpg');
  assert.equal(p.title, 'Boat Airdopes 141 : Amazon.in: Electronics');
  assert.equal(p.site, 'amazon.in');
  assert.equal(siteOf('https://m.youtube.com/watch?v=1'), 'youtube.com');
});
