# 📦 MemPalace

> Native macOS desktop wrapper for the Claude agent loop.
> Built on top of [MemPalace](https://github.com/MemPalace/mempalace) (the AI memory store) and Anthropic's [Claude Agent SDK](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk).

A standalone `.app` that gives you Claude Code's full power — skills, agents, hooks, MCP servers, tool use — in a native window with a multi-panel canvas, a built-in terminal for any AI CLI, and an email channel for tasks-on-the-go.

---

## ✨ Features

### Chat sidebar (right)
- **Streaming Claude responses** with full tool use (Read, Write, Edit, Grep, Bash, Glob — everything Claude Code has)
- **MCP servers auto-loaded** from your palace's `.claude/settings.json`
- **Skills + agents** auto-loaded from `.claude/skills/` and `.claude/agents/`
- **Subagent dispatch** rendered as cards (mp-spar, mp-risk, etc — emoji-tagged)
- **Hook visualization** — see hooks fire in real time
- **Cmd+K** to focus the input · **Cmd+W** to close panel · **⏹** to cancel mid-stream

### Multi-panel canvas (left)
- Long replies auto-promoted to **persistent panels**
- Same H1 heading → **refreshes the existing panel** (no token waste)
- 📌 **Pin** to keep · ✕ **close** to remove · **🔄 refresh** to regenerate
- **Cmd+1..9** to switch panels · panels persist across app restart

### Terminal (bottom drawer)
- **Cmd+\`** to toggle
- Real `zsh` shell — `claude login`, `gemini auth`, `codex login`, `ollama serve`, `git`, `gh`, anything
- API keys from Settings auto-injected as env vars (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `OLLAMA_HOST`)

### Email channel (Phase 1 + Phase 2)
- 📧 **Send** any panel via Gmail (creds encrypted via macOS Keychain)
- 📨 **Inbound poller** (Phase 2): reply to a panel email with `done` / `refresh` / `snooze 2d` / `delete` on the first line — palace gets mutated automatically, confirmation arrives back

### Drag-drop & paste
- Drag any file → saved to `<palace>/wing_user/archives/<timestamp>-<filename>`
- Paste a screenshot → saved as `screenshot-<timestamp>.png`

### Native macOS
- Custom palace-floor-plan icon (dark navy, glowing wing)
- Native notifications when Claude finishes a long turn while window is unfocused
- Hidden-inset titlebar with macOS traffic lights

---

## 📥 Install

### Option A — Pre-built .app (recommended)

Download the latest `.app` from [Releases](../../releases), drag to `/Applications/`. Then:

```bash
xattr -dr com.apple.quarantine /Applications/MemPalace.app
```

(Required because the app is unsigned — you're trusting it.)

Open from Spotlight (Cmd+Space → "MemPalace"). First launch shows the **setup wizard**.

### Option B — Build from source

```bash
git clone https://github.com/<your-username>/mempalace-app.git
cd mempalace-app
npm install
npm run dev          # dev mode (Vite + Electron with hot reload)
# OR
npm run dist:mac     # build .app to dist-builder/mac-arm64/MemPalace.app
npm run install:app  # copy built .app to /Applications
```

---

## 🧙 First-run setup

On first launch, the wizard offers three paths:

1. **📂 Connect to existing MemPalace** — point at a folder you already have
2. **✨ Create new MemPalace** — runs `pip3 install --user mempalace && mempalace init <chosen-path>`
3. **⏭️ Skip — chat-only mode** — Claude chat works without a palace; configure later in Settings

For option 2, you need Python 3 + `pip3` in your PATH.

---

## 🔑 API keys (Settings → ⚙️)

The app's chat uses Claude (via Pro Max OAuth or `ANTHROPIC_API_KEY`). The terminal can use anything — paste keys for any provider in Settings:

| Provider | Env var |
|---|---|
| Anthropic | `ANTHROPIC_API_KEY` |
| OpenAI | `OPENAI_API_KEY` |
| Google (Vertex / AI Studio) | `GOOGLE_API_KEY` |
| Gemini | `GEMINI_API_KEY` |
| OpenRouter | `OPENROUTER_API_KEY` |
| Ollama (local) | `OLLAMA_HOST` |

Keys are encrypted via macOS `safeStorage` (Keychain), auto-injected as env vars to every new terminal session.

---

## 🏛️ Architecture

```
┌────────────────────────────────────────────┐
│  📦 MemPalace.app  (Electron + React)      │
│  ┌──────────────────────────────────────┐  │
│  │ 💬 Chat   📋 Canvas   🖥️ Terminal    │  │
│  └──────────────────────────────────────┘  │
│              │            │                │
│              ▼            ▼                │
│  ┌────────────────┐  ┌─────────────────┐  │
│  │ Claude Agent   │  │ node-pty        │  │
│  │ SDK            │  │ (real shell)    │  │
│  └────────────────┘  └─────────────────┘  │
│              │            │                │
└──────────────┼────────────┼────────────────┘
               │            │
               ▼            ▼
       Anthropic API     User's MemPalace
                         (cwd-pointed,
                          .claude/* loaded)
```

- **Main process** (Electron): IPC handlers for chat streaming, terminal PTY, email SMTP/IMAP, file operations, config
- **Renderer**: React app with multi-panel canvas, chat sidebar, terminal drawer, modals
- **Preload**: contextBridge with typed APIs (`window.mempalace.config`, `.email`, `.terminal`, `.apiKeys`, `.streamMessage`, etc)
- **Palace** (separate folder): your data, skills, agents, hooks, MCP servers — read-only relationship from the app's side; the app `cwd`s into it for SDK queries

---

## 🛠️ Tech stack

- [Electron 33](https://electronjs.org/)
- [Vite 6](https://vitejs.dev/) + [React 18](https://react.dev/)
- [Claude Agent SDK](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk) — full Claude Code feature parity
- [xterm.js](https://xtermjs.org/) + [@homebridge/node-pty-prebuilt-multiarch](https://www.npmjs.com/package/@homebridge/node-pty-prebuilt-multiarch) — terminal
- [imapflow](https://imapflow.com/) + [mailparser](https://nodemailer.com/extras/mailparser/) + [nodemailer](https://nodemailer.com/) — email
- [react-markdown](https://github.com/remarkjs/react-markdown) + [remark-gfm](https://github.com/remarkjs/remark-gfm) — canvas rendering

---

## 🎨 Icon

The app icon is a stylized **memory palace floor plan** — a 2×2 grid of "rooms" inside a dark navy frame, with the bottom-right room glowing bright blue containing a white "memory orb." Doorway connectors hint at traversal between rooms. Source SVG in [`build/icon-src/icon.svg`](build/icon-src/icon.svg).

---

## 📝 License

MIT — see [LICENSE](LICENSE).

---

## 🙏 Credits

- [Anthropic](https://anthropic.com) for Claude + the Agent SDK
- [MemPalace](https://github.com/MemPalace/mempalace) for the underlying memory store
- xterm.js, imapflow, nodemailer, react-markdown maintainers — all the wonderful OSS that this stands on

---

## 🚧 Roadmap

- [ ] Conversation history persistence across sessions
- [ ] Multi-LLM chat provider switching (currently Claude-only via SDK)
- [ ] launchd-based email polling (currently only polls while app is running)
- [ ] Code-signing + notarization for distribution
- [ ] Custom agent inline editing
- [ ] Light mode

PRs welcome.
