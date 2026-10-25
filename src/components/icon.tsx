import type { ReactNode } from "react";

export type IconName = "menu" | "add" | "search" | "more" | "edit" | "pin" | "share" | "archive" | "restore" | "trash" | "settings" | "sun" | "moon" | "image" | "lightbulb" | "book" | "pen" | "paperclip" | "mic" | "micOff" | "send" | "copy" | "volume" | "refresh" | "thumbsUp" | "thumbsDown" | "download" | "sparkle" | "chevronDown" | "arrowRight" | "arrowUpRight" | "close";

const paths: Record<IconName, ReactNode> = {
  menu: <><rect x="3.5" y="4" width="17" height="16" rx="2.5"/><path d="M9 4v16"/></>,
  add: <><path d="M12 5v14M5 12h14"/></>,
  search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></>,
  more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
  edit: <><path d="m15 5 4 4"/><path d="M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z"/></>,
  pin: <><path d="m16 3-8 8"/><path d="m9 7 8 8"/><path d="m5 12 7 7 2-6 5-5-6-2-8 6Z"/><path d="m12 19-1 3"/></>,
  share: <><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.6M8.2 13.2l7.6 4.6"/></>,
  archive: <><path d="M4 7h16v13H4z"/><path d="M3 4h18v3H3zM9 11h6"/></>,
  restore: <><path d="M4 7h16v13H4z"/><path d="M3 4h18v3H3zM9 11h6"/><path d="M8 15h3"/></>,
  trash: <><path d="M4 7h16M10 11v6M14 11v6"/><path d="m6 7 1 13h10l1-13M9 7V4h6v3"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1a1.8 1.8 0 0 1-2.5 2.5l-.1-.1a1.8 1.8 0 0 0-3 .9v.2a1.8 1.8 0 0 1-3.6 0v-.2a1.8 1.8 0 0 0-3-.9l-.1.1a1.8 1.8 0 0 1-2.5-2.5l.1-.1a1.8 1.8 0 0 0-.9-3h-.2a1.8 1.8 0 0 1 0-3.6h.2a1.8 1.8 0 0 0 .9-3l-.1-.1a1.8 1.8 0 0 1 2.5-2.5l.1.1a1.8 1.8 0 0 0 3-.9v-.2a1.8 1.8 0 0 1 3.6 0v.2a1.8 1.8 0 0 0 3 .9l.1-.1a1.8 1.8 0 0 1 2.5 2.5l-.1.1a1.8 1.8 0 0 0 .9 3h.2a1.8 1.8 0 0 1 0 3.6h-.2a1.8 1.8 0 0 0-.9 3Z"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></>,
  moon: <path d="M20.2 15.6A8.5 8.5 0 0 1 8.4 3.8 8.5 8.5 0 1 0 20.2 15.6Z"/>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/></>,
  lightbulb: <><path d="M9 18h6m-5 3h4"/><path d="M8.2 14.5a7 7 0 1 1 7.6 0c-.8.6-1.3 1.4-1.5 2.5h-4.6c-.2-1.1-.7-1.9-1.5-2.5Z"/></>,
  book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5z"/><path d="M4 16a2.5 2.5 0 0 1 2.5-2.5H20M8 7h7"/></>,
  pen: <><path d="m15 5 4 4"/><path d="M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z"/><path d="M13 7l4 4"/></>,
  paperclip: <path d="m8 12.5 6.8-6.8a3.5 3.5 0 0 1 5 5L10 20.5a5 5 0 0 1-7.1-7.1L13 3.3"/>,
  mic: <><rect x="9" y="2.5" width="6" height="12" rx="3"/><path d="M5 11.5a7 7 0 0 0 14 0M12 18.5v3m-4 0h8"/></>,
  micOff: <><path d="m3 3 18 18"/><path d="M9 9v2a3 3 0 0 0 5.1 2.1M15 9V5.5a3 3 0 0 0-5.8-1M5 11a7 7 0 0 0 12 4.9M19 11a7 7 0 0 1-.4 2.3M12 18.5v3m-4 0h8"/></>,
  send: <><path d="m21 3-7.2 18-3.8-7.8L2 9.5 21 3Z"/><path d="M10 13 21 3"/></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></>,
  volume: <><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7m3-10a9 9 0 0 1 0 13"/></>,
  refresh: <><path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M5.5 9a7 7 0 0 1 11.8-2L20 12M4 12l2.7 5a7 7 0 0 0 11.8-2"/></>,
  thumbsUp: <><path d="M7 10v11H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3Zm0 0 5-8c2 0 3 1.5 2.5 3.5L13 10h6a2 2 0 0 1 2 2l-1.5 7a2 2 0 0 1-2 2H7"/></>,
  thumbsDown: <><path d="M7 14V3H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3Zm0 0 5 8c2 0 3-1.5 2.5-3.5L13 14h6a2 2 0 0 0 2-2l-1.5-7a2 2 0 0 0-2-2H7"/></>,
  download: <><path d="M12 3v12m-5-5 5 5 5-5"/><path d="M5 17v4h14v-4"/></>,
  sparkle: <><path d="m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3Z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/></>,
  chevronDown: <path d="m6 9 6 6 6-6"/>,
  arrowRight: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
  arrowUpRight: <><path d="M7 17 17 7"/><path d="M8 7h9v9"/></>,
  close: <><path d="m18 6-12 12M6 6l12 12"/></>,
};

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return <svg className={className || "icon"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
