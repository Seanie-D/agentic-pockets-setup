// A citizen's hello page, drawn in its card on "Who would you like to start with?" (Friday's Mac walk, 2026-10-13:
// the page showed raw, "#" and "**" on screen). Only what hello pages use: headings, paragraphs, list items, bold,
// italics and links (the link's words stay; the address goes). No imports, so the tests run in plain Node.

export interface Span { text: string; bold?: true; italic?: true }
export interface Block { kind: "heading" | "paragraph" | "item"; spans: Span[] }

function spans(line: string): Span[] {
  const out: Span[] = [];
  const text = line.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|(?<!\w)_(.+?)_(?!\w)/g;   // a_b in a word stays as it is
  let at = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > at) out.push({ text: text.slice(at, m.index) });
    out.push(m[1] !== undefined ? { text: m[1], bold: true } : { text: m[2] ?? m[3], italic: true });
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push({ text: text.slice(at) });
  return out;
}

export function helloBlocks(md: string): Block[] {
  const raw: { kind: Block["kind"]; text: string }[] = [];
  let open: { kind: Block["kind"]; text: string } | null = null;
  for (const line of md.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) { open = null; continue; }
    const h = /^#{1,6}\s+(.*)$/.exec(t);
    const li = /^[-*]\s+(.*)$/.exec(t);
    if (h) { raw.push({ kind: "heading", text: h[1] }); open = null; }
    else if (li) { open = { kind: "item", text: li[1] }; raw.push(open); }
    else if (open) open.text += ` ${t}`;   // a wrapped line belongs to the block above it
    else { open = { kind: "paragraph", text: t }; raw.push(open); }
  }
  return raw.map((b) => ({ kind: b.kind, spans: spans(b.text) }));
}
