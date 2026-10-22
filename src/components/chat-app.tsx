"use client";

import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";

type Message = { id?: string; role: "user" | "assistant"; content: string; imageUrl?: string; feedback?: "up" | "down" | null };
type ConversationSummary = { id: string; title: string; updatedAt: string };
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};

const suggestions = [
  { icon: "✳", tone: "lilac", title: "Think it through", detail: "Work through a big decision", prompt: "Help me think through a big decision", image: false },
  { icon: "⌁", tone: "peach", title: "Make it make sense", detail: "Explain something simply", prompt: "Explain a complex idea in a simple way", image: false },
  { icon: "✎", tone: "mint", title: "Find the right words", detail: "Write something thoughtful", prompt: "Help me write something clear and thoughtful", image: false },
  { icon: "◈", tone: "lilac", title: "Create an image", detail: "Make a man wearing a suit", prompt: "A polished portrait of a man wearing a navy suit, white shirt, and tie, in a softly lit modern office", image: true },
];

export default function ChatApp({ userName }: { userName: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [imageMode, setImageMode] = useState(false);
  const [filter, setFilter] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [listening, setListening] = useState(false);
  const [toast, setToast] = useState("");
  const [apiReady, setApiReady] = useState<boolean | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [recentsOpen, setRecentsOpen] = useState(true);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [archivedIds, setArchivedIds] = useState<string[]>([]);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const conversation = useRef<HTMLDivElement>(null);
  const speechRecognition = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem("thinkwell-theme");
    if (savedTheme === "dark" || savedTheme === "light") setTheme(savedTheme);
    setPinnedIds(JSON.parse(localStorage.getItem("thinkwell-pinned") || "[]"));
    setArchivedIds(JSON.parse(localStorage.getItem("thinkwell-archived") || "[]"));
    void fetch("/api/config").then(response => response.json()).then(config => {
      setApiReady(config.ready);
      if (!config.ready) setSettingsOpen(true);
    }).catch(() => setApiReady(false));
    void fetch("/api/chat/history").then(response => response.ok ? response.json() : null).then(data => {
      if (data?.conversations) setConversations(data.conversations);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("thinkwell-theme", theme);
  }, [theme]);
  useEffect(() => { if (conversation.current) conversation.current.scrollTop = conversation.current.scrollHeight; }, [messages, busy]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); reset(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function notify(text: string) {
    setToast(text);
    window.setTimeout(() => setToast(""), 2800);
  }

  function reset() {
    if (busy) return;
    setMessages([]);
    setConversationId(null);
    setDraft("");
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
    const content = raw.trim();
    if (!content || busy) return;
    const baseMessages = options.baseMessages ?? messages;
    const next = [...baseMessages, { role: "user" as const, content }];
    const activeConversationId = conversationId || crypto.randomUUID();
    const useImage = options.forceImage ?? imageMode;
    setConversationId(activeConversationId);
    setMessages([...next, { role: "assistant", content: "" }]);
    setDraft("");
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
        body: JSON.stringify({ messages: next, conversationId: activeConversationId }),
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
    if (!window.confirm(`Delete “${item.title}”? This cannot be undone.`)) return;
    const response = await fetch(`/api/chat/history/${encodeURIComponent(item.id)}`, { method: "DELETE" });
    if (!response.ok) { notify("Could not delete that conversation."); return; }
    setConversations(current => current.filter(entry => entry.id !== item.id));
    setOpenActionId(null);
    if (conversationId === item.id) { setMessages([]); setConversationId(null); }
    notify("Conversation deleted.");
  }

  async function renameConversation(item: ConversationSummary) {
    const title = window.prompt("Rename conversation", item.title)?.trim();
    if (!title || title === item.title) return;
    const response = await fetch(`/api/chat/history/${encodeURIComponent(item.id)}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) { notify(data?.error || "Could not rename that conversation."); return; }
    setConversations(current => current.map(entry => entry.id === item.id ? { ...entry, title: data.conversation.title } : entry));
    setOpenActionId(null);
  }

  function togglePin(item: ConversationSummary) {
    const next = pinnedIds.includes(item.id) ? pinnedIds.filter(id => id !== item.id) : [item.id, ...pinnedIds];
    setPinnedIds(next);
    localStorage.setItem("thinkwell-pinned", JSON.stringify(next));
    setOpenActionId(null);
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
  const archivedConversations = conversations.filter(item => archivedIds.includes(item.id) && item.title.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="brand"><span className="brand-mark"><i/><i/><i/></span><span>Thinkwell<span className="brand-dot">.</span></span><button className="sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">×</button></div>
        <button className="new-chat" onClick={reset}><span className="plus">＋</span> New chat <kbd>⌘ K</kbd></button>
        <label className="conversation-search"><span>⌕</span><input value={filter} onChange={event => setFilter(event.target.value)} placeholder="Search chats" aria-label="Search conversations"/></label>
        <button className="history-heading" onClick={() => setRecentsOpen(value => !value)} aria-expanded={recentsOpen}><span><span className="nav-label">RECENTS</span><span className="side-count">{filteredConversations.length}</span></span><span className={`section-chevron ${recentsOpen ? "expanded" : ""}`}>⌄</span></button>
        {recentsOpen && <div className="history-list">{filteredConversations.map(item => (
          <div className={`history-row ${item.id === conversationId ? "selected" : ""}`} key={item.id}>
            <button className="history-item" onClick={() => void openConversation(item)} title={item.title}><span className="history-dot"/>{pinnedIds.includes(item.id) && <span className="pinned-mark" title="Pinned">◆</span>}<span className="history-title">{item.title}</span></button>
            <button className="history-action" aria-label={`Actions for ${item.title}`} title="Conversation actions" onClick={() => setOpenActionId(current => current === item.id ? null : item.id)}>•••</button>
            {openActionId === item.id && <><button className="menu-dismiss" aria-label="Close conversation menu" onClick={() => setOpenActionId(null)}/><div className="history-menu">
              <button onClick={() => void renameConversation(item)}><span>✎</span> Rename</button>
              <button onClick={() => togglePin(item)}><span>⌖</span> {pinnedIds.includes(item.id) ? "Unpin" : "Pin"}</button>
              <button onClick={() => void shareConversation(item)}><span>↗</span> Share</button>
              <button onClick={() => toggleArchive(item)}><span>▣</span> Archive</button>
              <button className="danger" onClick={() => void deleteConversation(item)}><span>♧</span> Delete</button>
            </div></>}
          </div>
        ))}</div>}
        {archivedConversations.length > 0 && <><button className="history-heading archived-heading" onClick={() => setArchivedOpen(value => !value)} aria-expanded={archivedOpen}><span><span className="nav-label">ARCHIVED</span><span className="side-count">{archivedConversations.length}</span></span><span className={`section-chevron ${archivedOpen ? "expanded" : ""}`}>⌄</span></button>{archivedOpen && <div className="history-list archived-list">{archivedConversations.map(item => <div className="history-row" key={item.id}><button className="history-item" onClick={() => void openConversation(item)} title={item.title}><span className="history-dot"/><span className="history-title">{item.title}</span></button><button className="history-action" aria-label={`Actions for ${item.title}`} title="Conversation actions" onClick={() => setOpenActionId(current => current === item.id ? null : item.id)}>•••</button>{openActionId === item.id && <div className="history-menu archived-menu"><button onClick={() => toggleArchive(item)}><span>▣</span> Restore to recents</button><button className="danger" onClick={() => void deleteConversation(item)}><span>♧</span> Delete</button></div>}</div>)}</div>}</>}
        <div className="sidebar-bottom">
          <div className="connection-card"><span className={`connection-indicator ${apiReady ? "online" : apiReady === false ? "offline" : ""}`}/><span><strong>{apiReady ? "Connected" : apiReady === false ? "API key needed" : "Checking setup…"}</strong><small>{apiReady ? "AI is ready" : "Set up your API key"}</small></span><button onClick={() => setSettingsOpen(true)} className="settings-button" aria-label="Connection settings">⚙</button></div>
          <div className="profile"><div className="avatar">{userName.slice(0, 1).toUpperCase()}</div><div className="profile-copy"><strong>{userName}</strong><small>Private account</small></div><button className="tiny-action" aria-label="Sign out" onClick={() => void authClient.signOut({ fetchOptions: { onSuccess: () => window.location.reload() } })}>↗</button></div>
        </div>
      </aside>
      {sidebarOpen && <button className="sidebar-scrim" aria-label="Close sidebar" onClick={() => setSidebarOpen(false)}/>}

      <main className="main-area">
        <header className="topbar">
          <button className="sidebar-toggle" onClick={() => { if (window.matchMedia("(max-width: 760px)").matches) setSidebarOpen(value => !value); else setSidebarCollapsed(value => !value); }} aria-label={sidebarCollapsed ? "Open sidebar" : "Close sidebar"} title={sidebarCollapsed ? "Open sidebar" : "Close sidebar"}>☰</button>
          <span className="topbar-title">Thinkwell</span>
          <div className="topbar-right"><span className="stream-label"><span/> {imageMode ? "IMAGE MODE" : "READY TO CHAT"}</span><button className="top-icon" onClick={() => setTheme(current => current === "light" ? "dark" : "light")} aria-label="Toggle dark mode" title="Toggle dark mode">{theme === "light" ? "☾" : "☀"}</button></div>
        </header>

        <section className="conversation" ref={conversation}>
          <div className="welcome" hidden={messages.length > 0}>
            <div className="welcome-eyebrow"><span className="eyebrow-line"/> A LITTLE SPACE TO THINK <span className="eyebrow-line"/></div>
            <div className="welcome-mark"><span className="mark-glow"/><i/><i/><i/></div>
            <h1>Good things start<br/>with <em>a question.</em></h1>
            <p>A thoughtful space for ideas, answers, and everything in between.</p>
            <div className="suggestions">{suggestions.map(s => <button className="suggestion" key={s.title} onClick={() => { if (s.image) { setImageMode(true); void send(s.prompt, { forceImage: true }); } else void send(s.prompt); }}><span className={`suggestion-icon ${s.tone}`}>{s.icon}</span><span><b>{s.title}</b><small>{s.detail}</small></span><span className="suggestion-arrow">↗</span></button>)}</div>
          </div>
          <div className="messages" aria-live="polite">{messages.map((message, index) => <article className={`message ${message.role}`} key={message.id || `${index}-${message.role}`}>
            {message.role === "assistant" && <div className="message-avatar">✳</div>}
            <div className="message-body">{message.content || (busy && index === messages.length - 1 ? <span className="typing-cursor"/> : "")}
              {message.imageUrl && <><img className="generated-image" src={message.imageUrl} alt="Image created from your description"/><button className="message-tool" onClick={() => downloadImage(message.imageUrl!, index)}>↓ Save image</button></>}
              {message.role === "assistant" && message.content && !message.imageUrl && <div className="message-tools">
                <button className="message-tool" onClick={() => void copyText(message.content)} title="Copy response">Copy</button>
                <button className="message-tool" onClick={() => speak(message.content)} title="Read response aloud">Listen</button>
                <button className="message-tool" onClick={() => void regenerate(index)} title="Try again">Regenerate</button>
                <button className={`message-tool ${message.feedback === "up" ? "chosen" : ""}`} onClick={() => void rateMessage(message.id, "up")} title="Helpful">👍</button>
                <button className={`message-tool ${message.feedback === "down" ? "chosen" : ""}`} onClick={() => void rateMessage(message.id, "down")} title="Not helpful">👎</button>
              </div>}
            </div>
          </article>)}</div>
        </section>

        <div className="composer-wrap">
          <div className="chat-controls">
            <button className={`mode-button ${imageMode ? "active" : ""}`} onClick={() => setImageMode(value => !value)} aria-pressed={imageMode}>◈ {imageMode ? "Create image" : "Image"}</button>
          </div>
          <form className="composer" onSubmit={event => { event.preventDefault(); void send(); }}>
            <textarea ref={textarea} rows={1} placeholder={imageMode ? "Describe the image you want…" : "Ask anything…"} aria-label={imageMode ? "Describe an image" : "Your message"} value={draft} onChange={event => { setDraft(event.target.value); event.target.style.height = "auto"; event.target.style.height = `${Math.min(event.target.scrollHeight, 160)}px`; }} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }}/>
            <div className="composer-bottom"><div className="composer-hint"><span className="hint-sparkle">✳</span>{imageMode ? "Describe it, then send to create" : "Thoughtful answers, one question at a time"}</div><div className="composer-actions">
              <button className={`voice-button ${listening ? "active" : ""}`} type="button" onClick={toggleListening} aria-label={listening ? "Stop voice typing" : "Speak your message"} title={listening ? "Stop listening" : "Speak your message"}>{listening ? "■" : "🎙"}</button>
              <button className="send-button" disabled={busy || !draft.trim()} type="submit" aria-label="Send message">{busy ? <span className="typing-cursor"/> : <span>↑</span>}</button>
            </div></div>
          </form>
          <div className="composer-footnote">AI can make mistakes. Take a moment to review important details.</div>
        </div>
        <footer className="page-footer"><span>MADE FOR THE WAY YOU THINK</span><span>✳&nbsp; TAKE YOUR TIME</span></footer>
      </main>

      {settingsOpen && <div className="modal-backdrop open" onClick={() => setSettingsOpen(false)}><section className="settings-modal" onClick={event => event.stopPropagation()}>
        <button onClick={() => setSettingsOpen(false)} className="modal-close" aria-label="Close">×</button><div className="settings-icon">✳</div><h2>Connect your AI</h2>
        <p className="modal-copy">Your OpenRouter key stays on this server. Keep it in <code>.env.local</code>, never in chat or browser code.</p>
        <div className="setup-code"><span>OPENAI_API_KEY=</span>your_key_here</div>
        <div className="modal-divider"/>
        <button className="modal-done" onClick={() => setSettingsOpen(false)}>Got it</button>
      </section></div>}
      {toast && <div className="toast show" role="status">{toast}</div>}
    </div>
  );
}
