"use client";

import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Icon, type IconName } from "@/components/icon";
import { MarkdownMessage } from "@/components/markdown-message";

type Message = { id?: string; role: "user" | "assistant"; content: string; imageUrl?: string; feedback?: "up" | "down" | null };
type ConversationSummary = { id: string; title: string; updatedAt: string };
type TextAttachment = { id: string; name: string; text: string };
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};

const suggestions: { icon: IconName; tone: string; title: string; detail: string; prompt: string; image: boolean }[] = [
  { icon: "lightbulb", tone: "lilac", title: "Think it through", detail: "Work through a big decision", prompt: "Help me think through a big decision", image: false },
  { icon: "book", tone: "peach", title: "Make it make sense", detail: "Explain something simply", prompt: "Explain a complex idea in a simple way", image: false },
  { icon: "pen", tone: "mint", title: "Find the right words", detail: "Write something thoughtful", prompt: "Help me write something clear and thoughtful", image: false },
  { icon: "image", tone: "lilac", title: "Create an image", detail: "Make a man wearing a suit", prompt: "A polished portrait of a man wearing a navy suit, white shirt, and tie, in a softly lit modern office", image: true },
];

type ActionIconName = "more" | "edit" | "pin" | "share" | "archive" | "restore" | "trash";

function ActionIcon({ name }: { name: ActionIconName }) {
  return <Icon name={name} className="action-icon"/>;
}

type UtilityIconName = "settings" | "sun" | "moon" | "menu";

function UtilityIcon({ name }: { name: UtilityIconName }) {
  return <Icon name={name} className="utility-icon"/>;
}

function groupByDate(items: ConversationSummary[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const groups: { title: string; items: ConversationSummary[] }[] = [];
  for (const item of items) {
    const date = new Date(item.updatedAt);
    date.setHours(0, 0, 0, 0);
    const daysAgo = Math.floor((today.getTime() - date.getTime()) / 86_400_000);
    const title = daysAgo <= 0 ? "Today" : daysAgo === 1 ? "Yesterday" : daysAgo < 7 ? "Previous 7 days" : "Older";
    const group = groups.find(entry => entry.title === title);
    if (group) group.items.push(item);
    else groups.push({ title, items: [item] });
  }
  const order: Record<string, number> = { Today: 0, Yesterday: 1, "Previous 7 days": 2, Older: 3 };
  return groups.sort((a, b) => order[a.title] - order[b.title]);
}

export default function ChatApp({ userName, userEmail }: { userName: string; userEmail: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [imageMode, setImageMode] = useState(false);
  const [chatModel, setChatModel] = useState("");
  const [chatModels, setChatModels] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<TextAttachment[]>([]);
  const [filter, setFilter] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [listening, setListening] = useState(false);
  const [toast, setToast] = useState("");
  const [apiReady, setApiReady] = useState<boolean | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [displayName, setDisplayName] = useState(userName);
  const [nameDraft, setNameDraft] = useState(userName);
  const [nameBusy, setNameBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [accountNotice, setAccountNotice] = useState("");
  const [accountError, setAccountError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [recentsOpen, setRecentsOpen] = useState(true);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ConversationSummary | null>(null);
  const [renameTarget, setRenameTarget] = useState<ConversationSummary | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [archivedIds, setArchivedIds] = useState<string[]>([]);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const conversation = useRef<HTMLDivElement>(null);
  const [followingLatest, setFollowingLatest] = useState(true);
  const [hasNewContent, setHasNewContent] = useState(false);
  const followingLatestRef = useRef(true);
  const speechRecognition = useRef<SpeechRecognitionLike | null>(null);
  const toastTimer = useRef<number | null>(null);

  async function saveName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = nameDraft.trim();
    if (!name || name === displayName) return;
    setNameBusy(true); setAccountError(""); setAccountNotice("");
    try {
      const result = await authClient.updateUser({ name });
      if (result.error) throw new Error(result.error.message || "Could not update your name.");
      setDisplayName(name);
      setAccountNotice("Your name has been updated.");
    } catch (error) { setAccountError(error instanceof Error ? error.message : "Could not update your name."); }
    finally { setNameBusy(false); }
  }

  async function savePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const currentPassword = String(data.get("currentPassword") || "");
    const newPassword = String(data.get("newPassword") || "");
    const confirmPassword = String(data.get("confirmPassword") || "");
    setAccountError(""); setAccountNotice("");
    if (newPassword.length < 8) { setAccountError("Your new password must be at least 8 characters."); return; }
    if (newPassword !== confirmPassword) { setAccountError("The new passwords do not match."); return; }
    setPasswordBusy(true);
    try {
      const result = await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true });
      if (result.error) throw new Error(result.error.message || "Could not update your password.");
      form.reset();
      setAccountNotice("Your password has been updated. Other sessions were signed out.");
    } catch (error) { setAccountError(error instanceof Error ? error.message : "Could not update your password."); }
    finally { setPasswordBusy(false); }
  }

  useEffect(() => {
    const savedTheme = localStorage.getItem("thinkwell-theme");
    const initialTheme = savedTheme === "dark" ? "dark" : "light";
    setTheme(initialTheme);
    document.documentElement.dataset.theme = initialTheme;
    setPinnedIds(JSON.parse(localStorage.getItem("thinkwell-pinned") || "[]"));
    setArchivedIds(JSON.parse(localStorage.getItem("thinkwell-archived") || "[]"));
    void fetch("/api/config").then(response => response.json()).then(config => {
      setApiReady(config.ready);
      if (Array.isArray(config.models)) {
        const models = config.models.filter((model: unknown): model is string => typeof model === "string");
        setChatModels(models);
        const savedModel = localStorage.getItem("thinkwell-model");
        setChatModel(savedModel && models.includes(savedModel) ? savedModel : typeof config.model === "string" ? config.model : models[0] || "");
      }
      if (!config.ready) setSettingsOpen(true);
    }).catch(() => setApiReady(false));
    void fetch("/api/chat/history").then(response => response.ok ? response.json() : null).then(data => {
      if (data?.conversations) setConversations(data.conversations);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const viewport = conversation.current;
    if (!viewport) return;
    if (!followingLatestRef.current) {
      if (busy) setHasNewContent(true);
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      viewport.scrollTop = viewport.scrollHeight;
      setHasNewContent(false);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages, busy]);

  function updateScrollFollowing() {
    const viewport = conversation.current;
    if (!viewport) return;
    const atBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 80;
    followingLatestRef.current = atBottom;
    setFollowingLatest(atBottom);
    if (atBottom) setHasNewContent(false);
  }

  function scrollToLatest(smooth = true) {
    const viewport = conversation.current;
    if (!viewport) return;
    followingLatestRef.current = true;
    setFollowingLatest(true);
    setHasNewContent(false);
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); reset(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function notify(text: string) {
    setToast(text);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => { setToast(""); toastTimer.current = null; }, 3000);
  }

  async function addTextFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    const allowed = /\.(txt|md|csv|tsv|json|log|yaml|yml|xml)$/i;
    const currentSize = attachments.reduce((total, file) => total + file.text.length, 0);
    let remaining = 14_000 - currentSize;
    const added: TextAttachment[] = [];
    for (const file of files.slice(0, Math.max(0, 5 - attachments.length))) {
      if (!allowed.test(file.name) || file.size > 32_000) { notify(`${file.name} isn't supported. Attach a text, Markdown, CSV, JSON, or log file under 32 KB.`); continue; }
      if (remaining <= 0) { notify("The attachment limit is 14,000 characters per message."); break; }
      try {
        const text = await file.text();
        if (text.length > remaining) { notify(`${file.name} is too large for the remaining message limit.`); continue; }
        added.push({ id: crypto.randomUUID(), name: file.name, text });
        remaining -= text.length;
      } catch { notify(`Could not read ${file.name}.`); }
    }
    if (added.length) {
      setAttachments(current => [...current, ...added]);
      notify(`${added.length} text file${added.length === 1 ? "" : "s"} attached.`);
    }
  }

  function changeTheme(nextTheme: "light" | "dark") {
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem("thinkwell-theme", nextTheme);
    setTheme(nextTheme);
  }

  function changeModel(model: string) {
    setChatModel(model);
    localStorage.setItem("thinkwell-model", model);
    notify(`Model set to ${model}.`);
  }

  function reset() {
    if (busy) return;
    followingLatestRef.current = true;
    setFollowingLatest(true);
    setHasNewContent(false);
    setMessages([]);
    setConversationId(null);
    setDraft("");
    setAttachments([]);
    setImageMode(false);
    setSidebarOpen(false);
    textarea.current?.focus();
  }

  async function openConversation(item: ConversationSummary) {
    if (busy) return;
    try {
      const response = await fetch(`/api/chat/history?id=${encodeURIComponent(item.id)}`);
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || `Could not open that conversation (${response.status}).`);
      followingLatestRef.current = true;
      setFollowingLatest(true);
      setHasNewContent(false);
      setMessages(data.messages.map((message: Message) => ({ role: message.role, content: message.content, id: message.id, feedback: message.feedback })));
      setConversationId(item.id);
      setSidebarOpen(false);
    } catch (error) { notify(error instanceof Error ? error.message : "Could not open that conversation."); }
  }

  useEffect(() => {
    const sharedId = new URLSearchParams(window.location.search).get("conversation");
    if (!sharedId) return;
    void fetch(`/api/chat/history?id=${encodeURIComponent(sharedId)}`)
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (!data?.messages) return;
        setMessages(data.messages.map((message: Message) => ({ role: message.role, content: message.content, id: message.id, feedback: message.feedback })));
        setConversationId(sharedId);
      }).catch(() => {});
  }, []);

  async function send(raw = draft, options: { forceImage?: boolean; baseMessages?: Message[] } = {}) {
    const fileContext = attachments.map(file => `Attached file: ${file.name}\n\n${file.text}`).join("\n\n");
    const content = [raw.trim(), fileContext].filter(Boolean).join("\n\n");
    if (!content || busy) return;
    if (content.length > 20_000) { notify("That message and its attachments are too long. Remove a file or shorten the message."); return; }
    const baseMessages = options.baseMessages ?? messages;
    const next = [...baseMessages, { role: "user" as const, content }];
    const activeConversationId = conversationId || crypto.randomUUID();
    const useImage = options.forceImage ?? imageMode;
    if (useImage && attachments.length) { notify("Remove text attachments before creating an image."); return; }
    setConversationId(activeConversationId);
    followingLatestRef.current = true;
    setFollowingLatest(true);
    setHasNewContent(false);
    setMessages([...next, { role: "assistant", content: "" }]);
    setDraft("");
    setAttachments([]);
    setBusy(true);
    try {
      if (useImage) {
        const response = await fetch("/api/image", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: content, conversationId: activeConversationId }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          setMessages([...next, { role: "assistant", content: data.error || `Image creation failed (${response.status}).` }]);
          return;
        }
        setMessages([...next, { role: "assistant", content: "Here is your image.", imageUrl: data.image }]);
        setImageMode(false);
        await refreshConversations(activeConversationId, content);
        return;
      }

      const response = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, conversationId: activeConversationId, model: chatModel }),
      });
      if (!response.ok) {
        let error = `The AI service returned an error (${response.status}).`;
        try { error = (await response.json()).error || error; } catch {}
        setMessages([...next, { role: "assistant", content: error }]);
        return;
      }
      if (!response.body) throw new Error("This browser could not open the response.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pending = "";
      let answer = "";
      let done = false;
      const messageId = response.headers.get("X-Message-Id") || undefined;
      while (!done) {
        const { value, done: ended } = await reader.read();
        done = ended;
        pending += decoder.decode(value || new Uint8Array(), { stream: !done });
        const lines = pending.split(/\r?\n/);
        pending = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (data === "[DONE]") { done = true; break; }
          try {
            const delta = JSON.parse(data).choices?.[0]?.delta?.content;
            if (typeof delta === "string") {
              answer += delta;
              setMessages([...next, { role: "assistant", content: answer, id: messageId }]);
            }
          } catch {}
        }
      }
      if (!answer) setMessages([...next, { role: "assistant", content: "No response came back. Please try again." }]);
      else {
        setMessages([...next, { role: "assistant", content: answer, id: messageId }]);
        await refreshConversations(activeConversationId, content);
      }
    } catch (error) {
      setMessages([...next, { role: "assistant", content: error instanceof Error ? error.message : "I could not reach the AI service. Try again." }]);
    } finally {
      setBusy(false);
      textarea.current?.focus();
    }
  }

  async function refreshConversations(id: string, text: string) {
    const existing = conversations.find(item => item.id === id);
    const title = existing?.title || text.slice(0, 100);
    setConversations(current => [{ id, title, updatedAt: new Date().toISOString() }, ...current.filter(item => item.id !== id)].slice(0, 100));
  }

  async function deleteConversation(item: ConversationSummary) {
    const response = await fetch(`/api/chat/history/${encodeURIComponent(item.id)}`, { method: "DELETE" });
    if (!response.ok) { notify("Could not delete that conversation."); return; }
    setConversations(current => current.filter(entry => entry.id !== item.id));
    setOpenActionId(null);
    setDeleteTarget(null);
    if (conversationId === item.id) { followingLatestRef.current = true; setFollowingLatest(true); setHasNewContent(false); setMessages([]); setConversationId(null); }
    notify("Conversation deleted.");
  }

  async function renameConversation(item: ConversationSummary) {
    const title = renameDraft.trim();
    if (!title || title === item.title) return;
    const response = await fetch(`/api/chat/history/${encodeURIComponent(item.id)}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) { notify(data?.error || "Could not rename that conversation."); return; }
    setConversations(current => current.map(entry => entry.id === item.id ? { ...entry, title: data.conversation.title } : entry));
    setOpenActionId(null);
    setRenameTarget(null);
    notify("Conversation renamed.");
    notify("Conversation renamed.");
  }

  function togglePin(item: ConversationSummary) {
    const next = pinnedIds.includes(item.id) ? pinnedIds.filter(id => id !== item.id) : [item.id, ...pinnedIds];
    setPinnedIds(next);
    localStorage.setItem("thinkwell-pinned", JSON.stringify(next));
    setOpenActionId(null);
    notify(pinnedIds.includes(item.id) ? "Conversation unpinned." : "Conversation pinned.");
  }

  function toggleArchive(item: ConversationSummary) {
    const next = archivedIds.includes(item.id) ? archivedIds.filter(id => id !== item.id) : [...archivedIds, item.id];
    setArchivedIds(next);
    localStorage.setItem("thinkwell-archived", JSON.stringify(next));
    setOpenActionId(null);
    notify(archivedIds.includes(item.id) ? "Conversation restored." : "Conversation archived.");
  }

  async function shareConversation(item: ConversationSummary) {
    const url = `${window.location.origin}/?conversation=${encodeURIComponent(item.id)}`;
    try {
      await navigator.clipboard.writeText(url);
      notify("Private conversation link copied.");
    } catch { notify("Could not copy the conversation link."); }
    setOpenActionId(null);
  }

  async function rateMessage(messageId: string | undefined, rating: "up" | "down") {
    if (!messageId) { notify("Wait for the reply to finish, then rate it."); return; }
    const current = messages.find(message => message.id === messageId)?.feedback;
    const nextRating = current === rating ? null : rating;
    const response = await fetch("/api/chat/feedback", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId, rating: nextRating }),
    });
    if (!response.ok) { notify("Could not save feedback."); return; }
    setMessages(currentMessages => currentMessages.map(message => message.id === messageId ? { ...message, feedback: nextRating } : message));
    notify(nextRating ? "Feedback saved." : "Feedback removed.");
  }

  async function regenerate(index: number) {
    const userIndex = [...messages.slice(0, index)].map(message => message.role).lastIndexOf("user");
    if (userIndex < 0) return;
    const previousUser = messages[userIndex];
    const baseMessages = messages.slice(0, userIndex);
    await send(previousUser.content, { baseMessages });
  }

  async function copyText(text: string) {
    try { await navigator.clipboard.writeText(text); notify("Copied."); }
    catch { notify("Could not copy to clipboard."); }
  }

  function downloadImage(imageUrl: string, index: number) {
    const link = document.createElement("a");
    link.href = imageUrl;
    const extension = imageUrl.match(/^data:image\/(jpeg|png|webp)/)?.[1]?.replace("jpeg", "jpg") || "png";
    link.download = `thinkwell-image-${index + 1}.${extension}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    notify("Image downloaded.");
  }

  function toggleListening() {
    if (listening) { speechRecognition.current?.stop(); setListening(false); return; }
    const speechWindow = window as Window & {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) { notify("Voice typing is not supported in this browser."); return; }
    const recognition = new Recognition();
    recognition.lang = navigator.language || "en-US";
    recognition.interimResults = false;
    recognition.onresult = event => setDraft(current => `${current}${current ? " " : ""}${event.results[0]?.[0]?.transcript || ""}`);
    recognition.onerror = () => { setListening(false); notify("Could not hear that. Try again."); };
    recognition.onend = () => setListening(false);
    speechRecognition.current = recognition;
    setListening(true);
    recognition.start();
  }

  function speak(text: string) {
    if (!("speechSynthesis" in window)) { notify("Read aloud is not supported in this browser."); return; }
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }

  const filteredConversations = conversations
    .filter(item => !archivedIds.includes(item.id) && item.title.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => Number(pinnedIds.includes(b.id)) - Number(pinnedIds.includes(a.id)) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const archivedConversations = conversations.filter(item => archivedIds.includes(item.id) && item.title.toLowerCase().includes(filter.toLowerCase())).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const recentGroups = groupByDate(filteredConversations);
  const archivedGroups = groupByDate(archivedConversations);

  return (
    <div className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="brand"><span className="brand-mark"><i/><i/><i/></span><span>Thinkwell<span className="brand-dot">.</span></span><button className="sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar" data-tooltip="Close sidebar"><Icon name="close"/></button></div>
        <button className="new-chat" onClick={reset}><Icon name="add" className="inline-icon plus"/> New chat <kbd>⌘ K</kbd></button>
        <label className="conversation-search"><Icon name="search"/><input value={filter} onChange={event => setFilter(event.target.value)} placeholder="Search chats" aria-label="Search conversations"/></label>
        <button className="history-heading" onClick={() => setRecentsOpen(value => !value)} aria-expanded={recentsOpen}><span><span className="nav-label">RECENTS</span><span className="side-count">{filteredConversations.length}</span></span><Icon name="chevronDown" className={`section-chevron ${recentsOpen ? "expanded" : ""}`}/></button>
        {recentsOpen && <div className="history-list">{recentGroups.map(group => <section className="history-group" key={group.title}><div className="history-group-label">{group.title}</div>{group.items.map(item => (
          <div className={`history-row ${item.id === conversationId ? "selected" : ""}`} key={item.id}>
            <button className="history-item" onClick={() => void openConversation(item)} title={`${item.title} · ${new Date(item.updatedAt).toLocaleString()}`} aria-current={item.id === conversationId ? "page" : undefined}><span className="history-dot"/>{pinnedIds.includes(item.id) && <Icon name="pin" className="pinned-mark"/>}<span className="history-title">{item.title}</span></button>
            <button className="history-action" aria-label={`Actions for ${item.title}`} title="Conversation actions" data-tooltip="Conversation actions" onClick={() => setOpenActionId(current => current === item.id ? null : item.id)}><ActionIcon name="more"/></button>
            {openActionId === item.id && <><button className="menu-dismiss" aria-label="Close conversation menu" onClick={() => setOpenActionId(null)}/><div className="history-menu">
              <button onClick={() => { setRenameDraft(item.title); setRenameTarget(item); setOpenActionId(null); }}><ActionIcon name="edit"/> Rename</button>
              <button onClick={() => togglePin(item)}><ActionIcon name="pin"/> {pinnedIds.includes(item.id) ? "Unpin" : "Pin"}</button>
              <button onClick={() => void shareConversation(item)}><ActionIcon name="share"/> Share</button>
              <button onClick={() => toggleArchive(item)}><ActionIcon name="archive"/> Archive</button>
              <button className="danger" onClick={() => { setDeleteTarget(item); setOpenActionId(null); }}><ActionIcon name="trash"/> Delete</button>
            </div></>}
          </div>
        ))}</section>)}</div>}
        {archivedConversations.length > 0 && <><button className="history-heading archived-heading" onClick={() => setArchivedOpen(value => !value)} aria-expanded={archivedOpen}><span><span className="nav-label">ARCHIVED</span><span className="side-count">{archivedConversations.length}</span></span><Icon name="chevronDown" className={`section-chevron ${archivedOpen ? "expanded" : ""}`}/></button>{archivedOpen && <div className="history-list archived-list">{archivedGroups.map(group => <section className="history-group" key={group.title}><div className="history-group-label">{group.title}</div>{group.items.map(item => <div className="history-row" key={item.id}><button className="history-item" onClick={() => void openConversation(item)} title={`${item.title} · ${new Date(item.updatedAt).toLocaleString()}`}><span className="history-dot"/><span className="history-title">{item.title}</span></button><button className="history-action" aria-label={`Actions for ${item.title}`} title="Conversation actions" onClick={() => setOpenActionId(current => current === item.id ? null : item.id)}><ActionIcon name="more"/></button>{openActionId === item.id && <div className="history-menu archived-menu"><button onClick={() => toggleArchive(item)}><ActionIcon name="restore"/> Restore to recents</button><button className="danger" onClick={() => { setDeleteTarget(item); setOpenActionId(null); }}><ActionIcon name="trash"/> Delete</button></div>}</div>)}</section>)}</div>}</>}
        <div className="sidebar-bottom">
          <div className="connection-card"><span className={`connection-indicator ${apiReady ? "online" : apiReady === false ? "offline" : ""}`}/><span><strong>{apiReady ? "Connected" : apiReady === false ? "API key needed" : "Checking setup…"}</strong><small>{apiReady ? "AI is ready" : "Set up your API key"}</small></span><button onClick={() => setSettingsOpen(true)} className="settings-button" aria-label="Connection settings" title="Connection settings" data-tooltip="Connection settings"><UtilityIcon name="settings"/></button></div>
          <button className="profile profile-open" onClick={() => { setNameDraft(displayName); setAccountError(""); setAccountNotice(""); setProfileOpen(true); }} aria-label="Open profile and settings"><div className="avatar">{displayName.slice(0, 1).toUpperCase()}</div><span className="profile-copy"><strong>{displayName}</strong><small>Profile & settings</small></span><span className="profile-arrow"><Icon name="arrowUpRight"/></span></button>
        </div>
      </aside>
      {sidebarOpen && <button className="sidebar-scrim" aria-label="Close sidebar" onClick={() => setSidebarOpen(false)}/>}

      <main className="main-area">
        <header className="topbar">
          <button className="sidebar-toggle" onClick={() => { if (window.matchMedia("(max-width: 760px)").matches) setSidebarOpen(value => !value); else setSidebarCollapsed(value => !value); }} aria-label={sidebarCollapsed ? "Open sidebar" : "Close sidebar"} title={sidebarCollapsed ? "Open sidebar" : "Close sidebar"} data-tooltip={sidebarCollapsed ? "Open sidebar" : "Close sidebar"}><UtilityIcon name="menu"/></button>
          <span className="topbar-title">Thinkwell</span>
          <div className="topbar-right"><span className="stream-label"><span/> {imageMode ? "IMAGE MODE" : "READY TO CHAT"}</span><button className="top-icon" onClick={() => changeTheme(theme === "light" ? "dark" : "light")} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`} title={`Switch to ${theme === "light" ? "dark" : "light"} mode`} data-tooltip={`Switch to ${theme === "light" ? "dark" : "light"} mode`} aria-pressed={theme === "dark"}><UtilityIcon name={theme === "light" ? "moon" : "sun"}/></button></div>
        </header>

        <section className="conversation" ref={conversation} onScroll={updateScrollFollowing}>
          <div className="welcome" hidden={messages.length > 0}>
            <div className="welcome-eyebrow"><span className="eyebrow-line"/> A LITTLE SPACE TO THINK <span className="eyebrow-line"/></div>
            <div className="welcome-mark"><span className="mark-glow"/><i/><i/><i/></div>
            <h1>Good things start<br/>with <em>a question.</em></h1>
            <p>A thoughtful space for ideas, answers, and everything in between.</p>
            <div className="suggestions">{suggestions.map(s => <button className="suggestion" key={s.title} onClick={() => { if (s.image) { setImageMode(true); void send(s.prompt, { forceImage: true }); } else void send(s.prompt); }}><span className={`suggestion-icon ${s.tone}`}><Icon name={s.icon}/></span><span><b>{s.title}</b><small>{s.detail}</small></span><Icon name="arrowRight" className="suggestion-arrow"/></button>)}</div>
          </div>
          <div className="messages" aria-live="polite">{messages.map((message, index) => <article className={`message ${message.role}`} key={message.id || `${index}-${message.role}`}>
            {message.role === "assistant" && <div className="message-avatar"><Icon name="sparkle"/></div>}
            <div className="message-body">{message.content ? message.role === "assistant" ? <MarkdownMessage content={message.content} onCopy={copyText}/> : message.content : busy && index === messages.length - 1 ? <span className="typing-cursor"/> : ""}
              {message.imageUrl && <><img className="generated-image" src={message.imageUrl} alt="Image created from your description"/><button className="message-tool" onClick={() => downloadImage(message.imageUrl!, index)}><Icon name="download"/> Save image</button></>}
              {message.role === "assistant" && message.content && !message.imageUrl && <div className="message-tools">
                <button className="message-tool" onClick={() => void copyText(message.content)} title="Copy response" aria-label="Copy response" data-tooltip="Copy response"><Icon name="copy"/></button>
                <button className="message-tool" onClick={() => speak(message.content)} title="Read response aloud" aria-label="Read response aloud" data-tooltip="Read response aloud"><Icon name="volume"/></button>
                <button className="message-tool" onClick={() => void regenerate(index)} title="Try again" aria-label="Regenerate response" data-tooltip="Regenerate response"><Icon name="refresh"/></button>
                <button className={`message-tool ${message.feedback === "up" ? "chosen" : ""}`} onClick={() => void rateMessage(message.id, "up")} title="Helpful" aria-label="Helpful" data-tooltip="Helpful"><Icon name="thumbsUp"/></button>
                <button className={`message-tool ${message.feedback === "down" ? "chosen" : ""}`} onClick={() => void rateMessage(message.id, "down")} title="Not helpful" aria-label="Not helpful" data-tooltip="Not helpful"><Icon name="thumbsDown"/></button>
              </div>}
            </div>
          </article>)}</div>
          {hasNewContent && !followingLatest && <button className="scroll-to-bottom" type="button" onClick={() => scrollToLatest()}><Icon name="chevronDown"/> Scroll to bottom</button>}
        </section>

        <div className="composer-wrap">
          <div className="chat-controls">
            <label className="model-selector"><span>Model</span><select value={chatModel} onChange={event => changeModel(event.target.value)} disabled={chatModels.length < 2} aria-label="Choose AI model" title={chatModels.length < 2 ? "Add model IDs to OPENAI_MODELS to offer more choices" : "Choose an AI model"}>{chatModels.length ? chatModels.map(model => <option value={model} key={model}>{model}</option>) : <option value="">Loading models…</option>}</select><Icon name="chevronDown"/></label>
            <button className={`mode-button ${imageMode ? "active" : ""}`} onClick={() => { if (!imageMode && attachments.length) { notify("Remove text attachments before creating an image."); return; } setImageMode(value => !value); }} aria-pressed={imageMode}><Icon name="image"/>{imageMode ? "Create image" : "Image"}</button>
          </div>
          <form className="composer" onSubmit={event => { event.preventDefault(); void send(); }}>
            <input ref={fileInput} className="file-input" type="file" accept=".txt,.md,.csv,.tsv,.json,.log,.yaml,.yml,.xml,text/plain,text/markdown,text/csv,application/json" multiple onChange={event => void addTextFiles(event)} aria-label="Attach text files"/>
            <textarea ref={textarea} rows={1} placeholder={imageMode ? "Describe the image you want…" : "Ask anything…"} aria-label={imageMode ? "Describe an image" : "Your message"} value={draft} onChange={event => { setDraft(event.target.value); event.target.style.height = "auto"; event.target.style.height = `${Math.min(event.target.scrollHeight, 160)}px`; }} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }}/>
            {attachments.length > 0 && <div className="attachment-list" aria-label="Attached files">{attachments.map(file => <span className="attachment-chip" key={file.id}><Icon name="paperclip"/><span title={file.name}>{file.name}</span><button type="button" onClick={() => setAttachments(current => current.filter(item => item.id !== file.id))} aria-label={`Remove ${file.name}`} data-tooltip="Remove attachment"><Icon name="close"/></button></span>)}</div>}
            <div className="composer-bottom"><div className="composer-hint"><Icon name="lightbulb"/>{imageMode ? "Describe it, then send to create" : "Thoughtful answers, one question at a time"}</div><div className="composer-actions">
              <button className="attach-button" type="button" onClick={() => fileInput.current?.click()} disabled={busy || imageMode || attachments.length >= 5} aria-label="Attach a text file" title={imageMode ? "Attachments are unavailable in image mode" : "Attach a text, Markdown, CSV, or JSON file"} data-tooltip="Attach text file"><Icon name="paperclip"/></button>
              <button className={`voice-button ${listening ? "active" : ""}`} type="button" onClick={toggleListening} aria-label={listening ? "Stop voice typing" : "Speak your message"} title={listening ? "Stop listening" : "Speak your message"} data-tooltip={listening ? "Stop voice typing" : "Voice input"}><Icon name={listening ? "micOff" : "mic"}/></button>
              <button className={`send-button ${busy ? "loading" : ""}`} disabled={busy || (!draft.trim() && attachments.length === 0)} type="submit" aria-label={busy ? "Sending message" : "Send message"} title={busy ? "Sending…" : "Send message"} data-tooltip={busy ? "Sending…" : "Send message"}>{busy ? <span className="send-spinner"/> : <Icon name="send"/>}</button>
            </div></div>
          </form>
          <div className="composer-footnote">AI can make mistakes. Take a moment to review important details.</div>
        </div>
        <footer className="page-footer"><span>MADE FOR THE WAY YOU THINK</span><span>TAKE YOUR TIME</span></footer>
      </main>

      {profileOpen && <div className="modal-backdrop open" onClick={() => setProfileOpen(false)}><section className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-title" onClick={event => event.stopPropagation()}>
        <button onClick={() => setProfileOpen(false)} className="modal-close" aria-label="Close profile settings"><Icon name="close"/></button>
        <div className="profile-modal-heading"><div className="settings-icon"><UtilityIcon name="settings"/></div><span className="settings-eyebrow">ACCOUNT</span><h2 id="profile-title">Profile & settings</h2><p>Manage your account and appearance.</p></div>
        <div className="profile-summary"><div className="avatar avatar-large">{displayName.slice(0, 1).toUpperCase()}</div><div><strong>{displayName}</strong><span>{userEmail}</span></div><span className="account-badge">Private</span></div>
        <form className="account-form" onSubmit={saveName}>
          <label htmlFor="profile-name">Display name</label>
          <div className="account-input-row"><input id="profile-name" value={nameDraft} onChange={event => setNameDraft(event.target.value)} maxLength={80} required/><button type="submit" disabled={nameBusy || !nameDraft.trim() || nameDraft.trim() === displayName}>{nameBusy ? "Saving…" : "Save name"}</button></div>
        </form>
        <form className="account-form password-form" onSubmit={savePassword}>
          <div><h3>Update password</h3><p>Choose a new password for your account.</p></div>
          <label htmlFor="current-password">Current password</label><input id="current-password" name="currentPassword" type="password" autoComplete="current-password" minLength={8} required/>
          <label htmlFor="new-password">New password</label><input id="new-password" name="newPassword" type="password" autoComplete="new-password" minLength={8} required/>
          <label htmlFor="confirm-password">Confirm new password</label><input id="confirm-password" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required/>
          <button className="account-submit" type="submit" disabled={passwordBusy}>{passwordBusy ? "Updating…" : "Update password"}</button>
        </form>
        {(accountError || accountNotice) && <p className={`account-feedback ${accountError ? "error" : "success"}`} role="status">{accountError || accountNotice}</p>}
        <section className="appearance-section"><div><h3>Appearance</h3><p>Choose how Thinkwell looks on this device.</p></div><div className="theme-options" role="group" aria-label="Choose theme">{(["light", "dark"] as const).map(option => <button key={option} className={`theme-choice ${theme === option ? "selected" : ""}`} aria-pressed={theme === option} onClick={() => changeTheme(option)}><span className={`theme-preview ${option}`} aria-hidden="true"><span className="theme-preview-sidebar"><i/><i/><i/></span><span className="theme-preview-main"><i className="preview-topbar"/><i className="preview-user"/><i className="preview-assistant"/><i className="preview-composer"/></span></span><span className="theme-choice-label"><Icon name={option === "light" ? "sun" : "moon"}/>{option === "light" ? "Light" : "Dark"}</span></button>)}</div></section>
        <div className="profile-modal-footer"><span>Signed in with a private account</span><button className="signout-button" onClick={() => void authClient.signOut({ fetchOptions: { onSuccess: () => window.location.reload() } })}>Sign out <Icon name="arrowRight"/></button></div>
      </section></div>}
      {settingsOpen && <div className="modal-backdrop open" onClick={() => setSettingsOpen(false)}><section className="settings-modal" onClick={event => event.stopPropagation()}>
        <button onClick={() => setSettingsOpen(false)} className="modal-close" aria-label="Close"><Icon name="close"/></button><div className="settings-icon"><UtilityIcon name="settings"/></div><h2>Connect your AI</h2>
        <p className="modal-copy">Your OpenRouter key stays on this server. Keep it in <code>.env.local</code>, never in chat or browser code.</p>
        <div className="setup-code"><span>OPENAI_API_KEY=</span>your_key_here</div>
        <div className="modal-divider"/>
        <button className="modal-done" onClick={() => setSettingsOpen(false)}>Got it</button>
      </section></div>}
      {renameTarget && <div className="modal-backdrop open" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setRenameTarget(null); }} onKeyDown={event => { if (event.key === "Escape") setRenameTarget(null); }}><section className="action-dialog" role="dialog" aria-modal="true" aria-labelledby="rename-dialog-title"><button type="button" className="modal-close" onClick={() => setRenameTarget(null)} aria-label="Close rename dialog"><Icon name="close"/></button><span className="settings-eyebrow">CONVERSATION</span><h2 id="rename-dialog-title">Rename chat</h2><p className="modal-copy">Give this conversation a name that’s easy to find.</p><form onSubmit={event => { event.preventDefault(); void renameConversation(renameTarget); }}><input autoFocus maxLength={100} value={renameDraft} onChange={event => setRenameDraft(event.target.value)} aria-label="Conversation name"/><div className="action-dialog-buttons"><button type="button" className="dialog-cancel" onClick={() => setRenameTarget(null)}>Cancel</button><button type="submit" className="dialog-confirm" disabled={!renameDraft.trim()}>Save name</button></div></form></section></div>}
      {deleteTarget && <div className="modal-backdrop open" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setDeleteTarget(null); }} onKeyDown={event => { if (event.key === "Escape") setDeleteTarget(null); }}><section className="action-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-dialog-title"><button type="button" className="modal-close" onClick={() => setDeleteTarget(null)} aria-label="Close delete dialog"><Icon name="close"/></button><span className="settings-eyebrow">DELETE CONVERSATION</span><h2 id="delete-dialog-title">Delete this chat?</h2><p className="modal-copy">“{deleteTarget.title}” will be permanently deleted. This action can’t be undone.</p><div className="action-dialog-buttons"><button className="dialog-cancel" onClick={() => setDeleteTarget(null)}>Keep chat</button><button className="dialog-delete" onClick={() => void deleteConversation(deleteTarget)}><Icon name="trash"/> Delete</button></div></section></div>}
      {toast && <div className="toast show" role="status">{toast}</div>}
    </div>
  );
}
