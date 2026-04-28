# MemPalace.app — Configuration Reference

## File locations

| File | Purpose |
|---|---|
| `~/Library/Application Support/MemPalace/config.json` | App config: palace path, claude binary path, etc |
| `~/Library/Application Support/MemPalace/api-keys.bin` | Encrypted API keys (per provider) |
| `~/Library/Application Support/MemPalace/email-creds.bin` | Encrypted Gmail credentials |
| `~/Library/Application Support/MemPalace/email-phase2-enabled.flag` | Phase 2 inbound poller toggle |

All `.bin` files are encrypted via Electron's `safeStorage` (uses macOS Keychain).

## Config fields

```json
{
  "palacePath": "/path/to/your/MemPalace",
  "archivesSubdir": "wing_user/archives",
  "claudeBinPath": "/opt/homebrew/bin/claude",
  "chatProvider": "claude",
  "setupComplete": true
}
```

- `palacePath` — `null` triggers first-run wizard. Otherwise app `cwd`s here for Claude Agent SDK queries.
- `archivesSubdir` — relative path inside palace where drag-dropped files + screenshots land
- `claudeBinPath` — auto-detected from `/opt/homebrew/bin/claude`, `/usr/local/bin/claude`, or `~/.local/bin/claude`
- `chatProvider` — currently only `claude`. Future: `openai`, `google`, `ollama`, etc.

## API keys

Six providers supported, all stored encrypted. Auto-injected as env vars in every new terminal session:

| Provider | Env var | Get one at |
|---|---|---|
| Anthropic | `ANTHROPIC_API_KEY` | console.anthropic.com |
| OpenAI | `OPENAI_API_KEY` | platform.openai.com |
| Google | `GOOGLE_API_KEY` | console.cloud.google.com |
| Gemini | `GEMINI_API_KEY` | aistudio.google.com |
| OpenRouter | `OPENROUTER_API_KEY` | openrouter.ai |
| Ollama | `OLLAMA_HOST` | http://localhost:11434 (local) |

## Hotkeys

| Key | Action |
|---|---|
| Cmd+\` | Toggle terminal drawer |
| Cmd+K | Focus chat input + select all |
| Cmd+E | Compose email (uses active panel content) |
| Cmd+, | Open email settings |
| Cmd+1..9 | Switch to panel N |
| Cmd+W | Close active panel (skips pinned) |
| Cmd+Enter | Send chat message |

## Email — Phase 2 directives

Reply to any panel email with one of these on the first line (no quotes):

| Directive | Action |
|---|---|
| `done` / `complete` / `completed` / `finish` | Move drawer pending → completed, add COMPLETED date |
| `refresh` / `update` / `regenerate` / `sync` | Re-pull current state, write diary summary |
| `snooze 2d` (or `1w`, `3h`, etc) | Add SNOOZED.UNTIL stamp to drawer |
| `delete` | Remove drawer (only used if duplicate/ghost) |

Parser is case-insensitive. First non-quoted, non-`On X wrote:` line is checked.

## Resetting

- **Reset palace path:** Settings → ⚙️ → Change palace
- **Re-run wizard:** Delete `~/Library/Application Support/MemPalace/config.json` and restart
- **Clear all credentials:** Email Settings → Clear stored, OR delete `*.bin` files
- **Hard reset:** `rm -rf ~/Library/Application\ Support/MemPalace/`
