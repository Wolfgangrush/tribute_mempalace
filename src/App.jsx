import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import TerminalDrawer from './TerminalDrawer.jsx';
import { EmailSettings, EmailCompose } from './EmailDialogs.jsx';
import SetupWizard from './SetupWizard.jsx';
import AppSettings from './AppSettings.jsx';

/* ===================== HELPERS ===================== */

function extractContentBlocks(msg) {
  if (!msg) return [];
  const content = msg?.message?.content;
  if (Array.isArray(content)) return content;
  return [];
}

function looksRich(text) {
  if (!text) return false;
  if (text.length > 180) return true;
  if (/^#{1,6}\s/m.test(text)) return true;
  if (/^\|.+\|/m.test(text)) return true;
  if (/^[-*]\s/m.test(text) && text.split('\n').length > 4) return true;
  return false;
}

function extractPanelIdentity(content) {
  const directive = content.match(/<!--\s*(?:canvas|panel):([\w\s-]+)\s*-->/i);
  if (directive) {
    const k = directive[1].trim().toLowerCase();
    return { key: k, title: titleCase(k.replace(/-/g, ' ')) };
  }
  const h1 = content.match(/^#\s+(.+?)\s*$/m);
  if (h1) return { key: normalizeKey(stripEmojis(h1[1])), title: truncate(h1[1], 38) };
  const h2 = content.match(/^##\s+(.+?)\s*$/m);
  if (h2) return { key: normalizeKey(stripEmojis(h2[1])), title: truncate(h2[1], 38) };
  const h3 = content.match(/^###\s+(.+?)\s*$/m);
  if (h3) return { key: normalizeKey(stripEmojis(h3[1])), title: truncate(h3[1], 38) };
  const firstLine = content.split('\n').map((l) => l.trim()).filter(Boolean)[0] || 'Untitled';
  const cleaned = firstLine.replace(/^[#*\->_\s]+/, '');
  return { key: normalizeKey(cleaned), title: truncate(cleaned, 38) };
}

function normalizeKey(str) {
  return stripEmojis(str).toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').slice(0, 60);
}
function stripEmojis(str) {
  return String(str).replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}]/gu, '').trim();
}
function titleCase(str) {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}
function truncate(str, n) {
  return str.length > n ? str.slice(0, n - 1) + '…' : str;
}

function briefSummaryOfInput(tool, input) {
  if (!input || typeof input !== 'object') return '';
  if (input.subagent_type) return `→ ${input.subagent_type}`;
  if (input.file_path) return input.file_path.split('/').slice(-2).join('/');
  if (input.path) return String(input.path).split('/').slice(-2).join('/');
  if (input.pattern) return `pattern: ${input.pattern}`;
  if (input.command) return String(input.command).slice(0, 60);
  if (input.query) {
    const q = String(input.query).slice(0, 50);
    const filters = input.wing || input.room ? ` [${[input.wing, input.room].filter(Boolean).join('/')}]` : '';
    return `${q}${filters}`;
  }
  if (input.entity) return `entity: ${input.entity}`;
  if (input.agent_name) return `agent: ${input.agent_name}`;
  if (input.subject) return String(input.subject).slice(0, 50);
  const keys = Object.keys(input);
  if (keys.length) return `${keys[0]}: ${String(input[keys[0]]).slice(0, 40)}`;
  return '';
}

function firstMeaningfulLine(text) {
  if (!text) return '';
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return '';
  return lines[0].slice(0, 80);
}

function fmtTime(d) {
  if (!d) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function newId() {
  return `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const PANELS_STORAGE_KEY = 'mempalace.panels.v1';
const ACTIVE_PANEL_STORAGE_KEY = 'mempalace.activePanel.v1';

function loadStoredPanels() {
  try {
    const raw = localStorage.getItem(PANELS_STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map((p) => ({
      ...p,
      createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
      updatedAt: p.updatedAt ? new Date(p.updatedAt) : new Date(),
    }));
  } catch {
    return [];
  }
}

function loadStoredActivePanelId() {
  try {
    return localStorage.getItem(ACTIVE_PANEL_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

function savePanelsToStorage(panels) {
  try {
    const serializable = panels.map((p) => ({
      ...p,
      createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
      updatedAt: p.updatedAt instanceof Date ? p.updatedAt.toISOString() : p.updatedAt,
    }));
    localStorage.setItem(PANELS_STORAGE_KEY, JSON.stringify(serializable));
  } catch (err) {
    // localStorage quota exceeded — drop oldest unpinned panel and retry
    if (err.name === 'QuotaExceededError' && panels.length > 1) {
      const trimmed = [...panels].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;  // pinned first
        return new Date(b.updatedAt) - new Date(a.updatedAt);  // most recent first
      }).slice(0, Math.floor(panels.length * 0.7));
      try {
        const serializable = trimmed.map((p) => ({
          ...p,
          createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
          updatedAt: p.updatedAt instanceof Date ? p.updatedAt.toISOString() : p.updatedAt,
        }));
        localStorage.setItem(PANELS_STORAGE_KEY, JSON.stringify(serializable));
        console.warn('[savePanels] quota exceeded, dropped oldest unpinned panels');
      } catch {
        console.error('[savePanels] still over quota after trim');
      }
    } else {
      console.error('[savePanels] storage error:', err);
    }
  }
}

const AGENT_EMOJI = {
  'mp-spar': '🥊',
  'mp-risk': '⚠️',
  'mp-vent': '😤',
  'mp-strategy': '♟️',
  'mp-income': '💰',
  'mp-content': '📰',
  'mp-build': '🛠️',
  'mp-court': '⚖️',
  'mp-sunday': '🧘',
  'mp-research': '🔬',
  'reader': '📖',
  'format': '📐',
  'drafter': '✍️',
  'verifier': '🔍',
  'refiner': '✨',
  'overseer': '👁️',
  'vault-builder': '🏛️',
  'general-purpose': '🤖',
  'Explore': '🔭',
  'Plan': '📋',
};
function agentEmoji(type) { return AGENT_EMOJI[type] || '🤖'; }

/* ===================== APP ===================== */

export default function App() {
  const [items, setItems] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [statusLine, setStatusLine] = useState('idle');
  const [panels, setPanels] = useState(loadStoredPanels);
  const [activePanelId, setActivePanelId] = useState(loadStoredActivePanelId);
  const [subagents, setSubagents] = useState({});  // task_id → { name, description, status, progress }
  const [dragOver, setDragOver] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [emailSettingsOpen, setEmailSettingsOpen] = useState(false);
  const [emailCompose, setEmailCompose] = useState(null);
  const [showWizard, setShowWizard] = useState(false);
  const [appSettingsOpen, setAppSettingsOpen] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);
  const cancelRef = useRef(null);
  const scrollRef = useRef(null);
  const canvasScrollRef = useRef(null);

  const activePanel = useMemo(
    () => panels.find((p) => p.id === activePanelId) || null,
    [panels, activePanelId]
  );

  // First-run wizard check
  useEffect(() => {
    window.mempalace.config.get().then((cfg) => {
      if (!cfg.setupComplete) {
        setShowWizard(true);
      }
      setConfigLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [items, streaming]);

  useEffect(() => {
    if (canvasScrollRef.current) {
      canvasScrollRef.current.scrollTop = 0;
    }
  }, [activePanelId]);

  // Persist panels to localStorage on any change
  useEffect(() => {
    savePanelsToStorage(panels);
  }, [panels]);

  useEffect(() => {
    try {
      if (activePanelId) localStorage.setItem(ACTIVE_PANEL_STORAGE_KEY, activePanelId);
      else localStorage.removeItem(ACTIVE_PANEL_STORAGE_KEY);
    } catch {}
  }, [activePanelId]);

  function createOrUpdatePanel(content) {
    const { key, title } = extractPanelIdentity(content);
    let assignedId = null;
    setPanels((prev) => {
      const existing = prev.find((p) => p.key === key);
      if (existing) {
        assignedId = existing.id;
        return prev.map((p) =>
          p.id === existing.id ? { ...p, content, updatedAt: new Date(), title } : p
        );
      }
      const newPanel = {
        id: newId(),
        key,
        title,
        content,
        createdAt: new Date(),
        updatedAt: new Date(),
        pinned: false,
      };
      assignedId = newPanel.id;
      return [...prev, newPanel];
    });
    setTimeout(() => {
      if (assignedId) setActivePanelId(assignedId);
    }, 0);
    return assignedId;
  }

  function closePanel(id) {
    setPanels((prev) => prev.filter((p) => p.id !== id));
    setActivePanelId((curr) => {
      if (curr !== id) return curr;
      const remaining = panels.filter((p) => p.id !== id);
      return remaining.length ? remaining[remaining.length - 1].id : null;
    });
  }

  function togglePin(id) {
    setPanels((prev) => prev.map((p) => (p.id === id ? { ...p, pinned: !p.pinned } : p)));
  }

  function clearAllUnpinned() {
    setPanels((prev) => prev.filter((p) => p.pinned));
    setActivePanelId(null);
  }

  const handleSdkMessage = useCallback((msg) => {
    const type = msg?.type;

    if (type === 'system') {
      const sub = msg.subtype;
      if (sub === 'init') {
        setStatusLine(`session ${String(msg.session_id || '').slice(0, 8)} • ${msg.model || ''}`.trim());
        return;
      }
      // M3 — Hooks visualization
      if (sub === 'hook_started' || sub === 'hook_response' || sub === 'hook_progress') {
        setItems((prev) => [
          ...prev,
          {
            role: 'hook',
            event: msg.hook_event || sub,
            name: msg.hook_name || '',
            output: msg.output || '',
            phase: sub,  // started | progress | response
          },
        ]);
        return;
      }
      // M3 — Subagent dispatch tracking
      if (sub === 'task_started') {
        const task_id = msg.task_id;
        setSubagents((prev) => ({
          ...prev,
          [task_id]: {
            id: task_id,
            type: msg.task_type || 'agent',
            description: msg.description || '',
            status: 'running',
            progress: '',
          },
        }));
        setItems((prev) => [
          ...prev,
          { role: 'subagent', task_id, phase: 'started', type: msg.task_type, description: msg.description },
        ]);
        return;
      }
      if (sub === 'task_progress') {
        const task_id = msg.task_id;
        setSubagents((prev) => ({
          ...prev,
          [task_id]: { ...(prev[task_id] || {}), id: task_id, progress: msg.description || '' },
        }));
        // also append a progress note in chat
        setItems((prev) => [
          ...prev,
          { role: 'subagent', task_id, phase: 'progress', description: msg.description },
        ]);
        return;
      }
      if (sub === 'task_updated') {
        const task_id = msg.task_id;
        setSubagents((prev) => ({
          ...prev,
          [task_id]: { ...(prev[task_id] || { id: task_id }), ...msg },
        }));
        return;
      }
      return;
    }

    if (type === 'partial_assistant' || type === 'stream_event') {
      setItems((prev) => {
        const last = prev[prev.length - 1];
        const blocks = extractContentBlocks(msg);
        let chunk = '';
        for (const b of blocks) if (b.type === 'text' && typeof b.text === 'string') chunk += b.text;
        if (!chunk) return prev;
        if (last?.role === 'assistant' && last.streaming) {
          return [...prev.slice(0, -1), { ...last, text: (last.text || '') + chunk }];
        }
        return [...prev, { role: 'assistant', text: chunk, streaming: true }];
      });
      return;
    }

    if (type === 'assistant') {
      const blocks = extractContentBlocks(msg);
      const newItems = [];
      let fullText = '';
      for (const b of blocks) {
        if (b.type === 'text') {
          fullText += b.text || '';
          newItems.push({ role: 'assistant', text: b.text || '', promoted: false });
        } else if (b.type === 'tool_use') {
          // Special-case the Task tool — it's a subagent dispatch
          if (b.name === 'Task' && b.input?.subagent_type) {
            newItems.push({
              role: 'task_dispatch',
              tool: 'Task',
              subagent_type: b.input.subagent_type,
              description: b.input.description || b.input.prompt?.slice(0, 120) || '',
              tool_use_id: b.id,
            });
          } else {
            newItems.push({
              role: 'tool_use',
              tool: b.name,
              input: b.input,
              tool_use_id: b.id,
            });
          }
        } else if (b.type === 'thinking') {
          newItems.push({ role: 'thinking', text: b.thinking || '' });
        }
      }

      if (fullText && looksRich(fullText)) {
        const panelId = createOrUpdatePanel(fullText);
        const ident = extractPanelIdentity(fullText);
        for (const it of newItems) {
          if (it.role === 'assistant') {
            it.promoted = true;
            it.panelId = panelId;
            it.panelTitle = ident.title;
          }
        }
      }

      setItems((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && last.streaming) {
          return [...prev.slice(0, -1), ...newItems];
        }
        return [...prev, ...newItems];
      });
      return;
    }

    if (type === 'user') {
      const blocks = extractContentBlocks(msg);
      const newItems = [];
      for (const b of blocks) {
        if (b.type === 'tool_result') {
          let preview = '';
          if (typeof b.content === 'string') preview = b.content;
          else if (Array.isArray(b.content)) {
            preview = b.content.map((c) => (c.type === 'text' ? c.text : '')).join('');
          }
          newItems.push({
            role: 'tool_result',
            tool_use_id: b.tool_use_id,
            preview: preview.slice(0, 4000),
            truncated: preview.length > 4000,
            is_error: !!b.is_error,
          });
        }
      }
      if (newItems.length) setItems((prev) => [...prev, ...newItems]);
      return;
    }

    if (type === 'result') {
      const usage = msg.usage;
      const cost = msg.total_cost_usd;
      let summary = 'done';
      if (usage) summary += ` · ${usage.input_tokens || 0}↓ / ${usage.output_tokens || 0}↑`;
      if (typeof cost === 'number') summary += ` · $${cost.toFixed(4)}`;
      setStatusLine(summary);
      return;
    }
  }, [panels]);

  function sendRaw(text) {
    if (!text.trim() || streaming) return;
    const trimmed = text.trim();
    setItems((prev) => [...prev, { role: 'user', text: trimmed }]);
    setStreaming(true);
    setStatusLine('thinking…');

    const openPanelTitles = panels.map((p) => p.title);

    cancelRef.current = window.mempalace.streamMessage(trimmed, openPanelTitles, {
      onMessage: handleSdkMessage,
      onDone: () => {
        setStreaming(false);
        setItems((prev) => prev.map((it) => ({ ...it, streaming: false })));
      },
      onError: (err) => {
        setItems((prev) => [...prev, { role: 'error', text: err }]);
        setStreaming(false);
        setStatusLine(`error · ${String(err).slice(0, 80)}`);
      },
    });
  }

  function send() {
    if (!input.trim() || streaming) return;
    const text = input.trim();
    setInput('');
    sendRaw(text);
  }

  function refreshPanel(panel) {
    if (!panel || streaming) return;
    // Sanitize panel title for prompt — strip quote chars that would break interpolation
    const safeTitle = String(panel.title || '').replace(/["`\n]/g, ' ').slice(0, 100);
    sendRaw(`Refresh the canvas panel titled: ${safeTitle}\n\nRegenerate it using the EXACT SAME H1 heading as before so it updates in place. Pull the latest data from palace as needed.`);
  }

  function cancel() {
    if (cancelRef.current) cancelRef.current();
    cancelRef.current = null;
    setStreaming(false);
    setStatusLine('cancelled');
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      send();
    }
  }

  /* ===================== M4 — drag-drop & paste-screenshot ===================== */

  function onDragEnter(e) {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    setDragOver(true);
  }
  function onDragOver(e) {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }
  function onDragLeave(e) {
    if (e.currentTarget === e.target) setDragOver(false);
  }
  const MAX_DROP_BYTES = 50 * 1024 * 1024;  // 50 MB cap (matches main.cjs)

  async function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files || []);
    for (const file of files) {
      try {
        if (file.size > MAX_DROP_BYTES) {
          setItems((prev) => [
            ...prev,
            { role: 'error', text: `${file.name} is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max is 50 MB.` },
          ]);
          continue;
        }
        const arrayBuf = await file.arrayBuffer();
        // Use chunked base64 to avoid call-stack overflow on large files
        const u8 = new Uint8Array(arrayBuf);
        let binary = '';
        const CHUNK = 0x8000;
        for (let i = 0; i < u8.length; i += CHUNK) {
          binary += String.fromCharCode.apply(null, u8.subarray(i, i + CHUNK));
        }
        const base64 = btoa(binary);
        const result = await window.mempalace.saveDroppedFile(file.name, base64);
        if (result.ok) {
          setItems((prev) => [
            ...prev,
            { role: 'system_note', text: `📎 Saved to palace: \`${result.filename}\`` },
          ]);
        } else {
          setItems((prev) => [
            ...prev,
            { role: 'error', text: `Failed to save ${file.name}: ${result.error}` },
          ]);
        }
      } catch (err) {
        setItems((prev) => [
          ...prev,
          { role: 'error', text: `Save error: ${String(err.message || err)}` },
        ]);
      }
    }
  }

  // Hotkeys: Cmd+` (terminal) · Cmd+K (focus chat) · Cmd+1-9 (switch panel) · Cmd+E (email compose) · Cmd+, (email settings)
  useEffect(() => {
    function onKeyDown(e) {
      if (!(e.metaKey || e.ctrlKey)) return;

      // Cmd+` — toggle terminal
      if (e.key === '`') {
        e.preventDefault();
        setTerminalOpen((v) => !v);
        return;
      }

      // Cmd+K — focus chat input + select all (quick capture)
      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        const ta = document.querySelector('.composer textarea');
        if (ta) {
          ta.focus();
          ta.select();
        }
        return;
      }

      // Cmd+E — compose email (uses active panel content if any)
      if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        if (activePanel) openEmailForPanel(activePanel);
        else setEmailCompose({ subject: '', body: '' });
        return;
      }

      // Cmd+, — open email settings (mac convention for prefs)
      if (e.key === ',') {
        e.preventDefault();
        setEmailSettingsOpen(true);
        return;
      }

      // Cmd+1..9 — switch to panel N (1-indexed)
      if (/^[1-9]$/.test(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        if (panels[idx]) {
          e.preventDefault();
          setActivePanelId(panels[idx].id);
        }
        return;
      }

      // Cmd+Shift+W — close active panel (avoids conflict with macOS "close window")
      if ((e.key === 'w' || e.key === 'W') && e.shiftKey) {
        if (activePanel && !activePanel.pinned) {
          e.preventDefault();
          closePanel(activePanel.id);
        }
        return;
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [panels, activePanel]);

  function openEmailForPanel(panel) {
    if (!panel) return;
    setEmailCompose({
      subject: `MemPalace · ${panel.title}`,
      body: panel.content,
      panelKey: panel.key,  // for Phase 2 inbound matching
    });
  }

  useEffect(() => {
    async function onPaste(e) {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const it of items) {
        if (it.type && it.type.startsWith('image/')) {
          const blob = it.getAsFile();
          if (!blob) continue;
          const arrayBuf = await blob.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuf)));
          const result = await window.mempalace.saveScreenshot(base64);
          if (result.ok) {
            setItems((prev) => [
              ...prev,
              { role: 'system_note', text: `📷 Screenshot saved: \`${result.filename}\`` },
            ]);
          }
          e.preventDefault();
          break;
        }
      }
    }
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  return (
    <div
      className="app"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {dragOver && (
        <div className="drop-overlay">
          <div className="drop-message">
            <div className="drop-icon">📥</div>
            <div className="drop-title">Drop to save into palace</div>
            <div className="drop-sub">→ wing_user/archives/</div>
          </div>
        </div>
      )}

      <header className="titlebar">
        <h1>📦 MemPalace <span className="version">v0.5 · terminal+email</span></h1>
        <div className="titlebar-actions">
          <button
            className={`titlebar-btn ${terminalOpen ? 'active' : ''}`}
            onClick={() => setTerminalOpen((v) => !v)}
            title="Toggle terminal (Cmd+`)"
          >
            🖥️
          </button>
          <button
            className="titlebar-btn"
            onClick={() => setAppSettingsOpen(true)}
            title="Settings (palace + API keys)"
          >
            ⚙️
          </button>
          <button
            className="titlebar-btn"
            onClick={() => setEmailSettingsOpen(true)}
            title="Email setup"
          >
            📧⚙️
          </button>
          <button
            className="titlebar-btn"
            onClick={() => setEmailCompose({ subject: '', body: '' })}
            title="Compose email"
          >
            📧
          </button>
          <span className="status">🟢 Agent SDK · Pro Max · {statusLine}</span>
        </div>
      </header>

      <div className="layout">
        <main className="canvas-wrap">
          {panels.length > 0 && (
            <div className="canvas-tabs">
              {panels.map((p) => (
                <PanelTab
                  key={p.id}
                  panel={p}
                  active={p.id === activePanelId}
                  onSelect={() => setActivePanelId(p.id)}
                  onTogglePin={() => togglePin(p.id)}
                  onClose={() => closePanel(p.id)}
                />
              ))}
              <button className="tab tab-clear" onClick={clearAllUnpinned} title="Clear all unpinned panels">
                ✕ clear
              </button>
            </div>
          )}

          <div className="canvas" ref={canvasScrollRef}>
            {activePanel ? (
              <div className="canvas-rendered">
                <div className="canvas-toolbar">
                  <span className="canvas-time">
                    🕐 created {fmtTime(activePanel.createdAt)} · updated {fmtTime(activePanel.updatedAt)}
                    {activePanel.pinned && <span className="pin-badge"> · 📌 pinned</span>}
                  </span>
                  <button
                    className="canvas-refresh"
                    onClick={() => refreshPanel(activePanel)}
                    disabled={streaming}
                    title="Ask Claude to regenerate this panel with fresh data"
                  >
                    🔄 refresh
                  </button>
                  <button
                    className="canvas-refresh"
                    onClick={() => openEmailForPanel(activePanel)}
                    title="Send this panel via email"
                  >
                    📧 email
                  </button>
                </div>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{activePanel.content}</ReactMarkdown>
              </div>
            ) : (
              <CanvasEmpty />
            )}
          </div>
        </main>

        <aside className="sidebar">
          <div className="sidebar-header">
            <span>💬 Chat</span>
            <span className="sidebar-sub">{streaming ? '⏳ streaming' : 'idle'}</span>
          </div>

          <div className="messages" ref={scrollRef}>
            {items.length === 0 && <ChatEmpty />}
            {items.map((m, i) => (
              <MessageItem key={i} item={m} subagents={subagents} onJumpToPanel={(id) => setActivePanelId(id)} />
            ))}
            {streaming && items[items.length - 1]?.role !== 'assistant' && (
              <div className="msg msg-assistant">
                <span className="avatar">🤖</span>
                <span className="bubble thinking">working<span className="dots">…</span></span>
              </div>
            )}
          </div>

          <footer className="composer">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Cmd+Enter · drag files in · paste screenshots"
              rows={3}
              autoFocus
              disabled={streaming}
            />
            {streaming ? (
              <button onClick={cancel} className="btn-cancel">⏹</button>
            ) : (
              <button onClick={send} disabled={!input.trim()}>📤</button>
            )}
          </footer>
        </aside>
      </div>

      <TerminalDrawer visible={terminalOpen} />

      {emailSettingsOpen && (
        <EmailSettings onClose={() => setEmailSettingsOpen(false)} />
      )}
      {emailCompose && (
        <EmailCompose
          initialSubject={emailCompose.subject}
          initialBody={emailCompose.body}
          panelKey={emailCompose.panelKey}
          onClose={() => setEmailCompose(null)}
        />
      )}
      {appSettingsOpen && (
        <AppSettings
          onClose={() => setAppSettingsOpen(false)}
          onOpenTerminal={() => setTerminalOpen(true)}
          onSendToTerminal={(text) => {
            // Forward to TerminalDrawer via a window event
            window.dispatchEvent(new CustomEvent('mempalace:terminal:write', { detail: text }));
          }}
        />
      )}
      {showWizard && configLoaded && (
        <SetupWizard onDone={() => setShowWizard(false)} />
      )}
    </div>
  );
}

function PanelTab({ panel, active, onSelect, onTogglePin, onClose }) {
  return (
    <div className={`tab ${active ? 'active' : ''} ${panel.pinned ? 'pinned' : ''}`} onClick={onSelect}>
      <span className="tab-title">{panel.title}</span>
      <span
        className="tab-pin"
        onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
        title={panel.pinned ? 'Unpin' : 'Pin'}
      >
        {panel.pinned ? '📌' : '📍'}
      </span>
      <span
        className="tab-close"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        title="Close panel"
      >
        ✕
      </span>
    </div>
  );
}

function CanvasEmpty() {
  return (
    <div className="canvas-empty">
      <div className="canvas-icon">🧘</div>
      <h2>The Canvas</h2>
      <p className="canvas-tagline">
        Long replies open as panels. Tabs above. Drag files anywhere · paste screenshots — auto-saved to palace.
      </p>
      <div className="canvas-hints">
        <div className="hint-card"><div className="hint-icon">📋</div><div className="hint-title">/mempalace-wake</div><div className="hint-status">opens Task Board panel</div></div>
        <div className="hint-card"><div className="hint-icon">📌</div><div className="hint-title">Pin to keep</div><div className="hint-status">📍 → 📌 — survives clear</div></div>
        <div className="hint-card"><div className="hint-icon">🔄</div><div className="hint-title">Same H1 = refresh</div><div className="hint-status">manual 🔄 button too</div></div>
        <div className="hint-card"><div className="hint-icon">📥</div><div className="hint-title">Drag & drop files</div><div className="hint-status">→ wing_user/archives</div></div>
        <div className="hint-card"><div className="hint-icon">📷</div><div className="hint-title">Paste screenshots</div><div className="hint-status">→ wing_user/archives</div></div>
        <div className="hint-card"><div className="hint-icon">🔔</div><div className="hint-title">Native notifications</div><div className="hint-status">when window unfocused</div></div>
      </div>
      <p className="canvas-foot">💬 Type in the right sidebar to begin.</p>
    </div>
  );
}

function ChatEmpty() {
  return (
    <div className="empty">
      <p className="hello">🧘 Type, drag, or paste.</p>
      <p className="hint">Cmd+Enter to send · ⏹ to cancel</p>
      <p className="hint mini">Long replies → canvas panels →</p>
      <p className="hint mini">Drag files / paste screenshots → palace archives</p>
    </div>
  );
}

function MessageItem({ item, subagents, onJumpToPanel }) {
  if (item.role === 'user') {
    return (
      <div className="msg msg-user">
        <span className="avatar">👤</span>
        <pre className="bubble">{item.text}</pre>
      </div>
    );
  }
  if (item.role === 'assistant') {
    if (item.promoted) {
      return (
        <div className="msg msg-assistant promoted" onClick={() => item.panelId && onJumpToPanel(item.panelId)}>
          <span className="avatar">🤖</span>
          <div className="bubble bubble-promoted">
            <div className="promoted-summary">📋 panel: {item.panelTitle || 'rendered'} →</div>
            <div className="promoted-preview">{firstMeaningfulLine(item.text)}…</div>
          </div>
        </div>
      );
    }
    return (
      <div className="msg msg-assistant">
        <span className="avatar">🤖</span>
        <div className="bubble bubble-md">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.text || ''}</ReactMarkdown>
          {item.streaming && <span className="dots">▍</span>}
        </div>
      </div>
    );
  }
  if (item.role === 'thinking') {
    return (
      <details className="msg msg-thinking">
        <summary><span className="avatar">💭</span> thinking</summary>
        <pre className="thinking-block">{item.text}</pre>
      </details>
    );
  }
  if (item.role === 'task_dispatch') {
    const sa = subagents[item.tool_use_id];
    const status = sa?.status || 'running';
    return (
      <div className="msg msg-subagent">
        <span className="avatar">{agentEmoji(item.subagent_type)}</span>
        <div className="subagent-card">
          <div className="subagent-header">
            <span className="subagent-name">{item.subagent_type}</span>
            <span className={`subagent-status ${status}`}>{status === 'running' ? '⏳ working' : '✓ done'}</span>
          </div>
          {item.description && <div className="subagent-desc">{item.description}</div>}
          {sa?.progress && <div className="subagent-progress">→ {sa.progress}</div>}
        </div>
      </div>
    );
  }
  if (item.role === 'subagent') {
    if (item.phase === 'progress') {
      return (
        <div className="msg msg-subagent-progress">
          <span className="avatar"></span>
          <div className="subagent-progress-pill">↳ {item.description}</div>
        </div>
      );
    }
    return null;  // task_started already rendered via task_dispatch
  }
  if (item.role === 'hook') {
    const ev = item.event || 'hook';
    const phase = item.phase === 'hook_started' ? '▶' : item.phase === 'hook_response' ? '✓' : '·';
    return (
      <div className="msg msg-hook">
        <span className="avatar"></span>
        <div className="hook-pill">
          🪝 <span className="hook-phase">{phase}</span> <span className="hook-event">{ev}</span>
          {item.name && <span className="hook-name"> · {item.name}</span>}
          {item.output && <span className="hook-output"> — {String(item.output).slice(0, 80)}</span>}
        </div>
      </div>
    );
  }
  if (item.role === 'tool_use') {
    const summary = briefSummaryOfInput(item.tool, item.input);
    return (
      <details className="msg msg-tool-use">
        <summary>
          <span className="avatar">🔧</span>
          <span className="tool-name">{item.tool}</span>
          {summary && <span className="tool-brief"> — {summary}</span>}
        </summary>
        <pre className="tool-input-full">{(() => {
          try { return JSON.stringify(item.input, null, 2); } catch { return String(item.input); }
        })()}</pre>
      </details>
    );
  }
  if (item.role === 'tool_result') {
    return (
      <details className={`msg msg-tool-result ${item.is_error ? 'err' : ''}`}>
        <summary>
          <span className="avatar">{item.is_error ? '⚠️' : '✅'}</span>
          <span className="tool-result-brief">
            {item.is_error ? 'error' : 'result'} — {firstMeaningfulLine(item.preview)}
          </span>
        </summary>
        <pre className="tool-result-full">{item.preview}{item.truncated ? '\n…' : ''}</pre>
      </details>
    );
  }
  if (item.role === 'system_note') {
    return (
      <div className="msg msg-system-note">
        <div className="system-note-bubble">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.text}</ReactMarkdown>
        </div>
      </div>
    );
  }
  if (item.role === 'error') {
    return (
      <div className="msg msg-error">
        <span className="avatar">⚠️</span>
        <pre className="bubble">{item.text}</pre>
      </div>
    );
  }
  return null;
}
