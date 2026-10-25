import type { ReactNode } from "react";
import { Icon } from "@/components/icon";

function inline(text: string): ReactNode[] {
  const pattern = /(`[^`]+`|\[[^\]]+\]\([^\s)]+\)|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\*[^*]+\*|_[^_]+_)/g;
  return text.split(pattern).filter(Boolean).map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) return <code className="inline-code" key={index}>{part.slice(1, -1)}</code>;
    if (part.startsWith("**") || part.startsWith("__")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("~~")) return <del key={index}>{part.slice(2, -2)}</del>;
    if ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_"))) return <em key={index}>{part.slice(1, -1)}</em>;
    const link = part.match(/^\[([^\]]+)\]\(([^\s)]+)\)$/);
    if (link) {
      let safeHref = "";
      try {
        const parsed = new URL(link[2], "https://thinkwell.invalid");
        if (["https:", "http:", "mailto:"].includes(parsed.protocol) && !link[2].startsWith("//")) safeHref = link[2];
      } catch {}
      return safeHref ? <a key={index} href={safeHref} target={safeHref.startsWith("mailto:") || safeHref.startsWith("/") ? undefined : "_blank"} rel="noreferrer">{link[1]}</a> : <span key={index}>{link[1]}</span>;
    }
    return <span key={index}>{part}</span>;
  });
}

function isListItem(line: string) { return /^\s*(?:[-+*]\s+|\d+[.)]\s+)/.test(line); }

export function MarkdownMessage({ content, onCopy }: { content: string; onCopy: (text: string) => void }) {
  const lines = content.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index++; continue; }
    const fence = line.match(/^\s*```\s*([\w.+-]*)\s*$/);
    if (fence) {
      const language = fence[1];
      index++;
      const code: string[] = [];
      while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) code.push(lines[index++]);
      if (index < lines.length) index++;
      const value = code.join("\n");
      blocks.push(<div className="markdown-code" key={`code-${index}`}><div className="markdown-code-head"><span>{language || "Code"}</span><button type="button" onClick={() => onCopy(value)}><Icon name="copy"/> Copy</button></div><pre><code>{value}</code></pre></div>);
      continue;
    }
    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const level = heading[1].length;
      const children = inline(heading[2]);
      const key = `heading-${index++}`;
      blocks.push(level === 1 ? <h2 key={key}>{children}</h2> : level === 2 ? <h3 key={key}>{children}</h3> : <h4 key={key}>{children}</h4>);
      continue;
    }
    if (/^\s*(?:---+|\*\*\*+|___+)\s*$/.test(line)) { blocks.push(<hr key={`rule-${index++}`}/>); continue; }
    if (/^\s*>/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^\s*>/.test(lines[index])) quote.push(lines[index++].replace(/^\s*>\s?/, ""));
      blocks.push(<blockquote key={`quote-${index}`}>{quote.map((text, row) => <p key={row}>{inline(text)}</p>)}</blockquote>);
      continue;
    }
    if (isListItem(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const items: string[] = [];
      while (index < lines.length && isListItem(lines[index]) && /^\s*\d+[.)]\s+/.test(lines[index]) === ordered) {
        items.push(lines[index++].replace(/^\s*(?:[-+*]\s+|\d+[.)]\s+)/, ""));
      }
      const List = ordered ? "ol" : "ul";
      blocks.push(<List key={`list-${index}`}>{items.map((item, itemIndex) => <li key={itemIndex}>{inline(item)}</li>)}</List>);
      continue;
    }
    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() && !/^\s*```/.test(lines[index]) && !/^\s{0,3}#{1,6}\s+/.test(lines[index]) && !/^\s*>/.test(lines[index]) && !isListItem(lines[index]) && !/^\s*(?:---+|\*\*\*+|___+)\s*$/.test(lines[index])) paragraph.push(lines[index++].trim());
    blocks.push(<p key={`paragraph-${index}`}>{inline(paragraph.join(" "))}</p>);
  }
  return <div className="markdown-content">{blocks}</div>;
}
