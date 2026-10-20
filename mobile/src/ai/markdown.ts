/** A tiny reader for the markdown the companion writes: bold, links, bullets and pictures. */
export type Span =
  | { type: 'text'; text: string; bold?: boolean }
  | { type: 'link'; text: string; url: string; bold?: boolean };

export type Line =
  | { type: 'paragraph'; spans: Span[] }
  | { type: 'bullet'; spans: Span[]; marker: string }
  | { type: 'image'; url: string; alt: string };

const URL_CHARS = /https?:\/\/[^\s<>()\]]+[^\s<>()\].,;:!?'"]/;

/** Splits plain text into text and bare-URL spans. */
function withBareLinks(text: string, bold: boolean | undefined, out: Span[]) {
  let rest = text;
  for (let m = URL_CHARS.exec(rest); m; m = URL_CHARS.exec(rest)) {
    if (m.index) out.push({ type: 'text', text: rest.slice(0, m.index), bold });
    out.push({ type: 'link', text: m[0].replace(/^https?:\/\/(www\.)?/, '').slice(0, 40), url: m[0], bold });
    rest = rest.slice(m.index + m[0].length);
  }
  if (rest) out.push({ type: 'text', text: rest, bold });
}

export function parseSpans(text: string): Span[] {
  const spans: Span[] = [];
  // **bold** sections, then [label](url) links inside each.
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  for (const part of parts) {
    if (!part) continue;
    const bold = part.startsWith('**') && part.endsWith('**') && part.length > 4;
    const body = bold ? part.slice(2, -2) : part;
    const link = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
    let last = 0;
    for (let m = link.exec(body); m; m = link.exec(body)) {
      if (m.index > last) withBareLinks(body.slice(last, m.index), bold || undefined, spans);
      spans.push({ type: 'link', text: m[1].replace(/\*\*/g, ''), url: m[2], bold: bold || undefined });
      last = m.index + m[0].length;
    }
    if (last < body.length) withBareLinks(body.slice(last), bold || undefined, spans);
  }
  return spans;
}

export function parseMarkdown(text: string): Line[] {
  const lines: Line[] = [];
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    const image = /^\s*!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)\s*$/.exec(line);
    if (image) {
      lines.push({ type: 'image', alt: image[1], url: image[2] });
      continue;
    }
    const heading = /^\s*#{1,6}\s+(.*)$/.exec(line);
    if (heading) {
      lines.push({ type: 'paragraph', spans: parseSpans(`**${heading[1].replace(/\*\*/g, '')}**`) });
      continue;
    }
    const bullet = /^\s*([-*•]|\d+[.)])\s+(.*)$/.exec(line);
    if (bullet) {
      lines.push({ type: 'bullet', marker: /\d/.test(bullet[1]) ? bullet[1] : '•', spans: parseSpans(bullet[2]) });
      continue;
    }
    lines.push({ type: 'paragraph', spans: parseSpans(line.trim()) });
  }
  return lines;
}

/** Every distinct link in a reply, in order, for the picture cards. */
export function linksIn(text: string): { url: string; label: string; note: string }[] {
  const seen = new Set<string>();
  const out: { url: string; label: string; note: string }[] = [];
  for (const line of parseMarkdown(text)) {
    if (line.type === 'image') continue;
    const links = line.spans.filter((s) => s.type === 'link');
    line.spans.forEach((span, i) => {
      if (span.type !== 'link' || seen.has(span.url)) return;
      seen.add(span.url);
      // With one link on a line, the words after it describe it: "about ₹4,000, cushioned".
      const note =
        links.length === 1
          ? line.spans
              .slice(i + 1)
              .map((s) => s.text)
              .join('')
              .replace(/^[\s:,–—-]+/, '')
              .trim()
          : '';
      out.push({ url: span.url, label: span.text, note: note.slice(0, 90) });
    });
  }
  return out;
}
