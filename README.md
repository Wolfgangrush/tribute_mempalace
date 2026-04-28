# 📦 Tribute MemPalace — a desktop app for [MemPalace](https://www.mempalace.net)

> Native macOS desktop tribute to **[MemPalace](https://www.mempalace.net)** — a multi-panel canvas, streaming Claude chat, built-in terminal, and bidirectional email channel, all wired to your local memory store.

<div align="center">

**This is a TRIBUTE app. The work being honored is [MemPalace](https://www.mempalace.net) by [Milla Jovovich & Ben Sigman](https://www.mempalace.net).**
*MemPalace is the highest-scoring free AI memory system. This app simply gives it a desktop face.*

---

[**Download**](#download) · [**Quick start**](#quick-start) · [**Features**](#features) · [**Architecture**](#architecture) · [**Configuration**](#configuration) · [**Troubleshooting**](#troubleshooting) · [**Roadmap**](#roadmap) · [**Credits**](#credits)

</div>

---

## 🙏 First, the credit that matters

This app would **not exist** without [**MemPalace**](https://www.mempalace.net) — the open-source AI memory system created by **[Milla Jovovich](https://www.mempalace.net) and [Ben Sigman](https://www.mempalace.net)**.

> *"The Highest-Scoring Free AI Memory System. Free. Local. Forever."*
> — [mempalace.net](https://www.mempalace.net)

MemPalace is what makes the app's memory layer possible:

- 🧠 **96.6% on LongMemEval** with zero API calls
- 📚 **Stores conversations verbatim** — no AI deciding what's "worth remembering"
- 🏛️ **Wings · Rooms · Halls** hierarchy inspired by the ancient memory palace technique
- 💾 **100% local** — ChromaDB + SQLite, your data stays on your machine
- 🐍 **Pure Python** — `pip install mempalace` and you're done
- ⭐ **26,900+ GitHub stars** — community-validated
- 📜 **MIT licensed** — free forever

**This Electron app is a UI layer.** The Python MemPalace package does the actual memory work. Every feature here that touches memory — diary writes, knowledge graph, drawer storage, semantic search, agent dispatch — is MemPalace, not us.

🌐 **Visit [mempalace.net](https://www.mempalace.net) · [Install MemPalace](https://github.com/MemPalace/mempalace) · [Read the docs](https://www.mempalace.net)**

---

## ✨ What this app adds

The MemPalace Python package gives you a powerful CLI memory system. **MemPalace.app gives that system a desktop face**, plus the Claude agent loop wired in:

| Feature | What it does |
|---|---|
| 💬 **Streaming Claude chat** | Cmd+Enter to send. Full tool use, MCP server access, skills/agents auto-loaded from your MemPalace's `.claude/`. Subagent dispatch shown as cards (mp-spar, mp-risk, etc — emoji-tagged). Hook events shown as inline pills. |
| 📋 **Multi-panel canvas** | Long replies auto-promoted to persistent panels with tabs. Pin (📌), close (✕), or click 🔄 to refresh. Same H1 heading → updates existing panel (no token waste). Panels survive Cmd+Q. |
| 🖥️ **Built-in terminal** | Toggle with **Cmd+\`**. Real `zsh -il` shell with full PATH. Run `claude login`, `gemini auth`, `git`, `gh`, `ollama serve`, anything. Saved API keys auto-injected as env vars. |
| 📧 **Email channel — Phase 1** | Send any panel via Gmail (creds encrypted via macOS Keychain). |
| 📨 **Email channel — Phase 2** | Reply to a panel email with `done` / `refresh` / `snooze 2d` / `delete confirm` on the first line. Inbound poller (every 5 min) parses the directive, mutates the palace via signed Claude CLI, sends a confirmation. |
| 📥 **Drag-drop & paste** | Drag any file into the window → saved to `<palace>/wing_user/archives/<timestamp>-<filename>`. Cmd+V a screenshot → saved as PNG. 50 MB cap to prevent OOM. |
| 🔔 **Native notifications** | macOS banner when Claude finishes a long-running turn while the window is unfocused. |
| ⌨️ **Hotkeys** | Cmd+Enter (send) · Cmd+\` (terminal) · Cmd+K (focus chat) · Cmd+E (compose email for active panel) · Cmd+1..9 (switch panels) · Cmd+Shift+W (close panel) · Cmd+, (email settings) |
| 🧙 **First-run wizard** | Three paths: connect existing MemPalace · auto-install fresh one (pipx → pip3 fallbacks) · skip and use chat-only |
| 🔐 **Dual auth** | Use Pro/Max OAuth via the signed CLI **OR** paste an Anthropic API key. Per-provider keys (OpenAI, Google, Gemini, OpenRouter, Ollama) all encrypted via Keychain, auto-injected to terminal. |
| 🗑 **Reset button** | Settings → Danger zone → wipes all app state, reloads, wizard appears. Palace data never touched. |

---

## 📥 Download

### Option A — Pre-built `.app` (recommended for end users)

📥 **[Download the latest release →](https://github.com/Wolfgangrush/tribute_mempalace/releases/latest)**

Latest: [`MemPalace-v0.7-arm64.zip`](https://github.com/Wolfgangrush/tribute_mempalace/releases/download/v0.7/MemPalace-v0.7-arm64.zip) · 164 MB · Apple Silicon (M1/M2/M3/M4)

**Install in 30 seconds:**

```bash
# 1. Unzip + drag to /Applications

# 2. Clear macOS quarantine (required for unsigned apps):
xattr -dr com.apple.quarantine /Applications/MemPalace.app

# 3. Launch
open /Applications/MemPalace.app
# OR Spotlight (Cmd+Space → "MemPalace")
```

> ⚠️ **The release is unsigned** — we don't have an Apple Developer account ($99/year). The quarantine command is a one-time bypass; macOS Gatekeeper will warn once and then trust the app permanently.
>
> **Apple Silicon only** for now. No Intel/Linux/Windows builds yet.

First launch shows the **welcome wizard** — see [Quick start](#-quick-start-5-minutes).

### Option B — Build from source (recommended for developers)

```bash
# 1. Clone the repo
git clone https://github.com/Wolfgangrush/tribute_mempalace.git
cd mempalace-app

# 2. Install dependencies (Node 18+ required)
npm install

# 3. Run in dev mode (Vite + Electron with hot reload)
npm run dev

# OR build a production .app
npm run dist:mac           # outputs dist-builder/mac-arm64/MemPalace.app
npm run install:app        # copies built .app to /Applications
```

---

## 🧙 Quick start (5 minutes)

### Step 1 — Install Claude CLI (required)

This app uses the signed `claude` CLI as its chat backend (more on this in [Architecture](#architecture)). Install one of:

```bash
# macOS — Homebrew (recommended)
brew install claude

# OR — npm
npm install -g @anthropic-ai/claude-code

# OR — direct download
# https://claude.com/download
```

Then log in:

```bash
claude login
# Opens browser for OAuth (Pro / Max subscription)
```

### Step 2 — Launch MemPalace.app

Open from Spotlight (`Cmd+Space` → "MemPalace"). The welcome wizard appears.

### Step 3 — Pick a setup path

**🅰️ I already have a MemPalace**

If you've used MemPalace before (`pip install mempalace && mempalace init <somewhere>`), pick **"I have an existing MemPalace"** → choose the folder.

**🅱️ I'm new — create a fresh MemPalace**

Pick **"Create new MemPalace"** → choose where to put it (default: `~/Documents/MemPalace`). The wizard tries (in order):

1. `pipx install mempalace` — cleanest, isolates in venv
2. `pip3 install --user --break-system-packages mempalace` — for PEP-668 systems (modern Homebrew Python)
3. `pip3 install --user mempalace` — legacy fallback

Then runs `mempalace init <chosen-path> --yes` to create the structure.

If pipx isn't installed and PEP-668 blocks pip:

```bash
brew install pipx
pipx install mempalace
```

Then come back to the wizard — pick "I have an existing MemPalace" and point at the folder pipx created.

**🅾️ Skip — chat only**

Pick **"Skip — chat-only mode"** if you just want Claude chat without any MemPalace integration. You can configure a palace later via Settings (⚙️).

### Step 4 — Verify auth

Settings (⚙️) → 🔐 **Claude Authentication** section. The status badge should show **✅ logged in** (since you ran `claude login` earlier).

### Step 5 — Try it

In the chat sidebar (right), type:

```
say hi
```

Press **Cmd+Enter**. You should see a streaming reply in 2-3 seconds.

Then try something more interesting:

```
list the files in my MemPalace and tell me what kind of structure it has
```

Watch the tool use cards stream in (🔧 Glob → ✅ result → 🤖 explanation). Long replies auto-promote to a canvas panel on the left.

---

## 🏛️ Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  📦 MemPalace.app  (Electron + Vite + React)                     │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Title bar  · Settings (⚙️) · Email (📧) · Terminal (🖥️)   │  │
│  ├────────────────────────────────────────┬───────────────────┤  │
│  │ 📋 CANVAS                              │ 💬 CHAT           │  │
│  │ Multi-panel workspace                  │ Right sidebar     │  │
│  │ Tabs · Pin/close/refresh               │ Streaming         │  │
│  │ Markdown rendering                     │ Tool cards        │  │
│  ├────────────────────────────────────────┴───────────────────┤  │
│  │ 🖥️ TERMINAL DRAWER (Cmd+`)                                  │  │
│  │ Real zsh -il shell with enriched PATH                      │  │
│  └────────────────────────────────────────────────────────────┘  │
│              │                                  │                 │
│              ▼                                  ▼                 │
│  ┌─────────────────────────┐     ┌──────────────────────────┐   │
│  │ Signed `claude` CLI     │     │ node-pty                 │   │
│  │ (subprocess)            │     │ (real PTY)               │   │
│  │   --print               │     │                          │   │
│  │   --output-format       │     │                          │   │
│  │     stream-json         │     │                          │   │
│  └────────┬────────────────┘     └──────────────────────────┘   │
└───────────┼─────────────────────────────────────────────────────┘
            │
            ▼
   ┌──────────────────┐         ┌────────────────────────────────┐
   │ Anthropic API    │         │ Your MemPalace folder          │
   │ (OAuth/API key)  │         │ (cwd-pointed)                  │
   │                  │         │  • .claude/skills/             │
   └──────────────────┘         │  • .claude/agents/             │
                                │  • .claude/settings.json (MCP) │
                                │  • wing_user/diary             │
                                │  • drawers, KG, archives       │
                                └────────────────────────────────┘
```

### Why a CLI subprocess instead of the Agent SDK?

The Claude Agent SDK runs inside our **unsigned Electron app**. Modern macOS Keychain protects entries by code-signing identity — and Pro/Max OAuth credentials are written under Anthropic's identity. Our unsigned app can't read them. The **signed `claude` CLI binary CAN** — so we shell out to it.

The CLI's `--output-format stream-json` produces output that's **byte-for-byte identical** to what the Agent SDK emits internally (system/init, assistant turns, stream_event chunks, result, hook events, task progress). Our renderer parses these and treats them the same.

This means:
- ✅ Pro/Max OAuth auth works (CLI reads its own Keychain entry)
- ✅ API key auth works (CLI reads `ANTHROPIC_API_KEY` from env, which we inject from saved settings)
- ✅ MCP servers, skills, agents, hooks all auto-load (because we're using the same CLI Claude Code uses)
- ✅ Same streaming UX as the SDK
- ❌ Slight overhead per turn (one process spawn) — negligible in practice

The Agent SDK is still bundled (`@anthropic-ai/claude-agent-sdk` in `package.json`) for any future direct-API path or signed-app distribution.

### File layout

```
mempalace-app/
├── electron/                      Main process (Node.js)
│   ├── main.cjs                   IPC handlers, CLI subprocess, email, notifications
│   ├── preload.cjs                Context bridge — typed API exposed to renderer
│   └── config.cjs                 Encrypted config + API keys via Electron safeStorage
│
├── src/                           Renderer process (React)
│   ├── main.jsx                   React entry
│   ├── App.jsx                    Main component — canvas + sidebar layout
│   ├── App.css                    Dark theme, animations
│   ├── TerminalDrawer.jsx         xterm.js wrapper with PTY IPC
│   ├── SetupWizard.jsx            First-run flow — connect / create / skip
│   ├── EmailDialogs.jsx           Compose modal + settings (Phase 1 + Phase 2)
│   └── AppSettings.jsx            Palace path · Auth · Per-provider keys · Reset
│
├── build/
│   ├── icon.svg                   Source SVG (palace floor plan)
│   └── icon.icns                  macOS app icon (generated via iconutil)
│
├── index.html                     Vite entry (CSP headers)
├── vite.config.js                 React plugin, port 5173
├── package.json                   Deps + electron-builder config
├── README.md                      You are here
├── CONFIG.md                      Configuration reference
└── LICENSE                        MIT
```

### Tech stack

| Layer | Tech | Why |
|---|---|---|
| Desktop wrapper | [**Electron 33**](https://electronjs.org/) | Mature, cross-platform, integrates with system Keychain via `safeStorage` |
| Build / dev server | [**Vite 6**](https://vitejs.dev/) | Fast HMR, minimal config, ESM-native |
| UI framework | [**React 18**](https://react.dev/) | Multi-panel canvas + chat sidebar in standard JSX |
| Terminal | [**xterm.js 5**](https://xtermjs.org/) + [**@homebridge/node-pty-prebuilt-multiarch**](https://www.npmjs.com/package/@homebridge/node-pty-prebuilt-multiarch) | Industry-standard web terminal + native PTY without compile pain |
| Email — outbound | [**nodemailer**](https://nodemailer.com/) | Standard Gmail SMTP |
| Email — inbound | [**imapflow**](https://imapflow.com/) + [**mailparser**](https://nodemailer.com/extras/mailparser/) | Async/await IMAP client + MIME parsing |
| Markdown rendering | [**react-markdown**](https://github.com/remarkjs/react-markdown) + [**remark-gfm**](https://github.com/remarkjs/remark-gfm) | Tables, code, GFM extensions |
| Chat backend | **`@anthropic-ai/claude-code`** (the signed CLI) | OAuth + API key dual auth, full Claude Code feature parity |
| Memory system | **[MemPalace](https://www.mempalace.net) (Python)** | Verbatim storage, semantic search, KG, agent diaries — the backbone |

---

## ⚙️ Configuration

### File locations

```
~/Library/Application Support/MemPalace/
├── config.json                 Palace path, claude bin path, setupComplete flag
├── api-keys.bin                Per-provider keys, encrypted via macOS Keychain (safeStorage)
├── email-creds.bin             Gmail user + App Password, encrypted
├── email-phase2-enabled.flag   Inbound poller toggle
└── phase2-audit.log            Tamper-evident timeline of inbound email mutations
```

All `.bin` files use Electron's `safeStorage` which encrypts via macOS Keychain. If Keychain is unavailable (rare), the app **refuses to save** rather than fall back to plaintext.

### Per-provider API keys (Settings → 🔑 All API Keys)

Six providers stored encrypted, auto-injected as env vars in every new terminal session:

| Provider | Env var | Get one at |
|---|---|---|
| Anthropic | `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |
| OpenAI | `OPENAI_API_KEY` | [platform.openai.com](https://platform.openai.com) |
| Google | `GOOGLE_API_KEY` | [console.cloud.google.com](https://console.cloud.google.com) |
| Gemini | `GEMINI_API_KEY` | [aistudio.google.com](https://aistudio.google.com) |
| OpenRouter | `OPENROUTER_API_KEY` | [openrouter.ai](https://openrouter.ai) |
| Ollama (local) | `OLLAMA_HOST` | `http://localhost:11434` |

Why? The chat sidebar uses Claude — but the **terminal can use anything**. Want to compare an OpenAI response with Claude's? Open terminal, type `gemini`, you're set. Want to run a local Llama via Ollama? `ollama serve` in terminal, all keys already loaded.

### Email Phase 2 — directives

Reply to any panel email with one of these on the **first line, no quotes**:

| Directive | Action |
|---|---|
| `done` / `complete` / `finish` | Move drawer pending → completed, add `COMPLETED` date stamp. **NEVER deletes — preserves history.** |
| `refresh` / `update` / `regenerate` / `sync` | Re-pull current state from palace, write a brief diary summary |
| `snooze 2d` (or `1w`, `3h`, etc) | Add `SNOOZED.UNTIL` stamp to drawer |
| `delete confirm` OR `yes delete` | Actually delete (only used for true duplicates/ghosts) |
| `delete` (without confirmation) | Triggers a clarification email — no mutation happens |

All directives are **logged to `phase2-audit.log`** with timestamp, source email, target panel, success/failure. The poller validates word boundaries — `donezo`, `completedness`, `deletedyesterday` won't false-positive.

The poller runs every 5 minutes **while the app is open**. It does NOT run as a background daemon (yet). For background polling, see [Roadmap](#roadmap).

### Hotkeys

| Key | Action |
|---|---|
| Cmd+Enter | Send chat message |
| Cmd+\` | Toggle terminal drawer |
| Cmd+K | Focus chat input + select all (quick capture) |
| Cmd+E | Compose email (uses active panel content) |
| Cmd+, | Open email settings |
| Cmd+1..9 | Switch to panel N (1-indexed) |
| Cmd+Shift+W | Close active panel (skips pinned) |
| ⏹ button | Cancel mid-stream |
| Cmd+W | macOS default — close window (NOT panel) |

---

## 🛡️ Security & privacy

| Concern | Mitigation |
|---|---|
| **Credentials in plaintext** | Every credential stored via `safeStorage` (macOS Keychain). App refuses to save if Keychain unavailable. |
| **Inbound email injection** | All inbound email body content wrapped in `<<<USER_REPLY>>>...<<<END_USER_REPLY>>>` markers. System prompt explicitly tells Claude to treat content inside as untrusted input. Word-boundary regex prevents accidental directive matches. |
| **Email-driven deletion** | Plain `delete` triggers a clarification email (no mutation). Actual deletion requires `delete confirm` or `yes delete`. Even confirmed deletes go through Claude's judgment with palace-data-discipline rules baked into the system prompt. |
| **All Phase 2 mutations logged** | `phase2-audit.log` is tamper-evident — every directive, target, source email, success/failure with ISO timestamps. |
| **File size DoS** | Drag-drop + paste capped at 50 MB. Terminal `pty.write` capped at 1 MB per call. |
| **Concurrent chat env race** | Async lock serializes process.env mutations across concurrent claude:stream calls. |
| **Pip install hangs** | 5 min timeout with SIGTERM → SIGKILL grace. Wizard shows ⏹ Cancel button. |
| **Custom shell wrappers** | When detecting binaries, we read shebangs + scan first 4KB for known wrapper markers (`MEMPALACE_HOME`, `single-command launcher`) and skip them — they break arg parsing. |
| **Bypass-permissions mode** | Yes, the chat runs Claude with `bypassPermissions` — single-user, on-own-machine, talking-to-own-data design. If this isn't right for your threat model, don't use this app. |
| **Quarantine on first run** | Unsigned `.app` requires `xattr -dr com.apple.quarantine` once. Documented in install steps. We do not currently code-sign or notarize. |

### What this app does NOT do

- 🚫 No telemetry, analytics, crash reporting, or any network calls beyond Anthropic API + your Gmail (when you opt into email)
- 🚫 No ads, tracking, or third-party scripts
- 🚫 No data leaves your machine except the chat prompts you explicitly send to Anthropic and the emails you explicitly send via your Gmail
- 🚫 No remote update checks — you decide when to pull a new version

---

## 🐛 Troubleshooting

### Chat says "spawn ENOTDIR"

The palace path you set in Settings doesn't exist or isn't a directory. Open Settings (⚙️) → Change → pick a real folder.

### Chat says "Authentication failed"

Either:
1. Run `claude login` in the terminal drawer (Cmd+\`) once — Pro/Max OAuth via browser
2. OR Settings (⚙️) → 🔑 All API Keys → paste `ANTHROPIC_API_KEY` → Save

### "Claude CLI not installed" badge in Settings

The app couldn't find `claude` in any of: `/opt/homebrew/bin`, `/usr/local/bin`, `~/.local/bin`, or your Python user-base. Install via `brew install claude` or `npm install -g @anthropic-ai/claude-code`, then click 🔄 Recheck.

### Terminal can't find `brew`, `npm`, etc

Quit and relaunch the app. The terminal drawer pre-seeds `/opt/homebrew/bin`, `/usr/local/bin`, `~/.local/bin`, and several Python user-base paths into PATH. If your binary lives somewhere else, add that directory to your `~/.zprofile`:

```bash
echo 'export PATH="/path/to/your/bin:$PATH"' >> ~/.zprofile
```

### Wizard says "pip install exited 1 — externally-managed-environment"

This is **PEP 668** (modern Homebrew Python refusing pip --user). The wizard now retries with `--break-system-packages` automatically. If it still fails:

```bash
brew install pipx
pipx install mempalace
```

Then point the wizard at the folder pipx created.

### "mempalace init failed: spawn mempalace ENOENT" or "exit 1"

Your `mempalace` CLI is one of:
1. Not on PATH — add `~/Library/Python/3.<your-version>/bin` to PATH
2. A custom user wrapper that intercepts arguments — the wizard now detects and skips these (looks for `MEMPALACE_HOME` / `single-command launcher` in the script)

You can always init manually:

```bash
mempalace init /path/to/your/palace --yes
```

Then point the wizard at it via "I have an existing MemPalace".

### Chat works but shows no canvas panels

Replies under 180 characters with no markdown structure stay in the chat sidebar (correct behavior — short answers don't deserve a panel). Try asking for something structured: "list the files in my palace as a table".

### Reset everything

Settings (⚙️) → ⚠️ Danger zone → 🗑 Reset MemPalace.app to defaults. Wipes config, credentials, panels, audit log. Reloads window. **Does NOT touch your palace folder data.**

Or from Terminal:

```bash
pkill -f "MemPalace.app"
rm -rf ~/Library/Application\ Support/MemPalace/
open /Applications/MemPalace.app
```

---

## 🚧 Roadmap

| Item | Status |
|---|---|
| ❄️ Conversation history persistence across sessions | Not started |
| ❄️ Multi-LLM chat provider switching (currently Claude-only) | Not started — see [Why Claude-only?](#why-is-the-chat-claude-only) below |
| ❄️ launchd-based email polling (currently runs only while app is open) | Not started |
| ❄️ Code-signing + notarization for distribution | Not started — needs Apple Developer Program |
| ❄️ Custom agent inline editing | Not started |
| ❄️ Light mode | Not started |
| ❄️ Windows + Linux ports | Not started — node-pty + safeStorage need cross-platform attention |
| ❄️ Voice input via Whisper | Not started |
| ❄️ Multi-window / multi-session | Not started |

PRs welcome on any of these. See [Contributing](#contributing).

### Why is the chat Claude-only?

The chat sidebar uses `@anthropic-ai/claude-code` (signed CLI) which is Claude-specific. The **terminal drawer** is provider-agnostic — saved API keys for OpenAI, Google, Gemini, OpenRouter, and Ollama are auto-injected as env vars into every new terminal session, so you can run `gemini`, `codex`, `ollama`, anything.

For multi-provider chat in the sidebar, we'd need to:
1. Replace the Claude CLI subprocess with a unified abstraction (Vercel AI SDK or LiteLLM)
2. Re-implement subagent dispatch, MCP loading, hooks, skills per-provider — those are Claude-Code-ecosystem features, not portable
3. Accept that non-Claude providers get a "lite" chat (basic text + tool use) without the rich palace integration

Realistic effort: 2-4 days. On the roadmap.

---

## 🤝 Contributing

PRs welcome. The code is intentionally small (~1500 LOC) and unopinionated — built for forking.

```bash
git clone https://github.com/Wolfgangrush/tribute_mempalace.git
cd tribute_mempalace
npm install
npm run dev
```

Edit any file in `src/` (renderer) or `electron/` (main process). Vite hot-reloads renderer changes instantly; main process changes need a restart.

To build a `.app`:
```bash
npm run dist:mac
```

Output lands in `dist-builder/mac-arm64/MemPalace.app`.

### Development conventions

- **Plain JavaScript**, not TypeScript — the codebase is small enough that types add more friction than value
- **Functional React components**, no class components, no Redux, no state library — `useState` + `useEffect` are enough
- **IPC handlers in main.cjs** are flat and procedural — no clever abstractions
- **CSS in `App.css`** — no Tailwind, no styled-components, no CSS modules. Just classes.
- **Errors propagate as `{ ok: false, error: "..." }`** from IPC handlers — never throw across the IPC boundary

### What to NOT do

- ❌ Don't add telemetry or analytics
- ❌ Don't add a built-in update checker
- ❌ Don't bundle MemPalace itself — users install it via pip/pipx (it's separate, intentionally)
- ❌ Don't ship features that require a backend (we're local-first by design)

---

## 📜 License

MIT — see [LICENSE](LICENSE).

---

## 🙏 Credits

### The memory layer that makes this possible

**[MemPalace](https://www.mempalace.net)** by **[Milla Jovovich](https://www.mempalace.net) & [Ben Sigman](https://www.mempalace.net)** — without them, this app would be an empty shell.

> *"The Highest-Scoring Free AI Memory System. Free. Local. Forever."*

- 🌐 Website: **[www.mempalace.net](https://www.mempalace.net)**
- 📦 GitHub: [github.com/MemPalace/mempalace](https://github.com/MemPalace/mempalace)
- 📜 MIT licensed · 🐍 Python · ⭐ 26,900+ stars

If you find this app useful, please **support MemPalace upstream**: star the repo, contribute to the Python package, share the work. The desktop face is the easy part — they did the hard work of building a benchmark-leading memory system that runs free and local on your machine.

### The agent loop

**[Anthropic](https://anthropic.com)** for [Claude](https://claude.ai), the [Claude Code CLI](https://www.npmjs.com/package/@anthropic-ai/claude-code), and the [Claude Agent SDK](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk).

### The OSS the app stands on

In rough order of "this would have been ten times harder without you":

- [Electron](https://electronjs.org/) — desktop wrapper
- [Vite](https://vitejs.dev/) + [@vitejs/plugin-react](https://www.npmjs.com/package/@vitejs/plugin-react) — build pipeline
- [React](https://react.dev/) — UI
- [xterm.js](https://xtermjs.org/) — terminal emulator
- [@homebridge/node-pty-prebuilt-multiarch](https://www.npmjs.com/package/@homebridge/node-pty-prebuilt-multiarch) — PTY without native compile pain
- [imapflow](https://imapflow.com/) — IMAP client
- [mailparser](https://nodemailer.com/extras/mailparser/) — MIME parsing
- [nodemailer](https://nodemailer.com/) — SMTP
- [react-markdown](https://github.com/remarkjs/react-markdown) + [remark-gfm](https://github.com/remarkjs/remark-gfm) — markdown rendering

---

<div align="center">

**[⬆ back to top](#-mempalaceapp)**

*A desktop face on the work that [Milla Jovovich & Ben Sigman](https://www.mempalace.net) already did.*
*If MemPalace is the brain, this is just the eyes and hands.*

🌐 **[mempalace.net](https://www.mempalace.net)**

</div>
