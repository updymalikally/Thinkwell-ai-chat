"use client";

import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import { memo } from "react";

const plugins = { code, math, mermaid };

export const MarkdownMessage = memo(function MarkdownMessage({ content, isStreaming = false }: { content: string; isStreaming?: boolean }) {
  return (
    <Streamdown
      className="markdown-content"
      mode="streaming"
      plugins={plugins}
      isAnimating={isStreaming}
      animated={isStreaming ? { animation: "fadeIn", duration: 120 } : false}
      controls={{ code: { copy: true }, mermaid: { copy: true, download: true, fullscreen: true } }}
      shikiTheme={["github-light", "github-dark"]}
      codeBlockMaxHeight="min(60vh, 520px)"
      tableMaxHeight="min(50vh, 420px)"
      linkSafety={{ enabled: true }}
    >
      {content}
    </Streamdown>
  );
});
