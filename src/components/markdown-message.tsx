"use client";

import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import { memo } from "react";
import monokai from "@shikijs/themes/monokai";

const plugins = { code, math, mermaid };
const monokaiLightColors: Record<string, string> = {
  "#272822": "#faf8f0",
  "#f8f8f2": "#272822",
  "#F8F8F2": "#272822",
  "#F92672": "#c2185b",
  "#A6E22E": "#557d00",
  "#E6DB74": "#8a6700",
  "#FD971F": "#b45309",
  "#AE81FF": "#7047a3",
  "#66D9EF": "#007c91",
  "#88846f": "#77715e",
};
const monokaiLight = {
  ...monokai,
  name: "monokai-light",
  type: "light" as const,
  colors: {
    ...monokai.colors,
    "editor.background": "#faf8f0",
    "editor.foreground": "#272822",
  },
  tokenColors: monokai.tokenColors?.map((token) => ({
    ...token,
    settings: {
      ...token.settings,
      ...(token.settings.foreground && {
        foreground: monokaiLightColors[token.settings.foreground] ?? token.settings.foreground,
      }),
    },
  })) ?? [],
};

export const MarkdownMessage = memo(function MarkdownMessage({ content, isStreaming = false }: { content: string; isStreaming?: boolean }) {
  return (
    <Streamdown
      className="markdown-content"
      mode="streaming"
      plugins={plugins}
      isAnimating={isStreaming}
      animated={isStreaming ? { animation: "fadeIn", duration: 120 } : false}
      controls={{ code: { copy: true }, mermaid: { copy: true, download: true, fullscreen: true } }}
      shikiTheme={[monokaiLight, "monokai"]}
      codeBlockMaxHeight="min(60vh, 520px)"
      tableMaxHeight="min(50vh, 420px)"
      linkSafety={{ enabled: true }}
    >
      {content}
    </Streamdown>
  );
});
