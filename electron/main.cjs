const { app, BrowserWindow, ipcMain, Notification, safeStorage, dialog, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawn, execFile } = require('node:child_process');
const config = require('./config.cjs');

const isDev = process.env.NODE_ENV === 'development';

let mainWindow = null;
let lastTurnStartTime = 0;

function getClaudeBinPath() {
  const cfg = config.readConfig();
  if (cfg.claudeBinPath && fs.existsSync(cfg.claudeBinPath)) return cfg.claudeBinPath;
  // Fallback: try common paths
  const candidates = [
    '/opt/homebrew/bin/claude',
    '/usr/local/bin/claude',
    path.join(os.homedir(), '.local/bin/claude'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return 'claude';  // Hope it's in PATH
}

function getPalaceCwd() {
  const cfg = config.readConfig();
  return cfg.palacePath || os.homedir();  // Fallback to home if no palace set
}

function getArchivesDir() {
  const cfg = config.readConfig();
  if (!cfg.palacePath) return path.join(os.homedir(), 'Downloads', 'MemPalace-archives');
  return path.join(cfg.palacePath, cfg.archivesSubdir || 'wing_user/archives');
}

const SYSTEM_PROMPT_APPEND = `
# MemPalace.app — Canvas + Palace-Data Rules

You are running inside MemPalace.app, a desktop wrapper for the Claude agent loop.
The UI has surfaces:
  - 💬 Right sidebar = transient chat
  - 📋 Left canvas  = persistent multi-panel workspace
  - 🖥️ Bottom drawer = terminal (shell access)
  - 📧 Email = send panel content via Gmail

## CANVAS ROUTING
- Replies >180 chars OR with markdown structure → auto-promoted to canvas panel
- Panel identity = first H1/H2 heading (case-insensitive, emoji-stripped)
- Same heading → REFRESHES existing panel (no token waste)
- Stable headings: "# 📋 Task Board", "# ⚖️ Court Cause-List", etc.
- Reuse exact same H1 when refreshing/regenerating an open panel
- Explicit slot: <!-- canvas:KEY -->
- Short replies (<180 chars, no markdown) stay in chat
- After palace mutations, regenerate stale panels using SAME H1 (open panels listed in [CANVAS CONTEXT])

## PALACE-DATA DISCIPLINE
- NEVER mempalace_delete_drawer to mark complete — destroys history
- USE mempalace_update_drawer to change room "pending" → "completed" + COMPLETED date
- Reserve delete for: true duplicates, ghost drawers user explicitly labels for cleanup, test data

## TIME
Run \`date +"%Y-%m-%d %H:%M"\` for current time. Never guess.
`;

function createWindow() {
  const iconPath = path.join(__dirname, '..', 'build', 'icon.icns');
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'MemPalace',
    backgroundColor: '#1a1a1f',
    titleBarStyle: 'hiddenInset',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

/* ================== Config + setup wizard ================== */

ipcMain.handle('config:get', async () => {
  return config.readConfig();
});

ipcMain.handle('config:set', async (_event, partial) => {
  return config.updateConfig(partial);
});

ipcMain.handle('config:choose-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    defaultPath: config.defaultPalacePath(),
    title: 'Choose your MemPalace folder',
    buttonLabel: 'Use this folder',
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

ipcMain.handle('config:default-palace-path', async () => {
  return config.defaultPalacePath();
});

ipcMain.handle('config:validate-palace', async (_event, palacePath) => {
  if (!palacePath) return { ok: false, error: 'No path' };
  if (!fs.existsSync(palacePath)) return { ok: false, error: 'Folder does not exist', recoverable: 'create' };
  const claudeDir = path.join(palacePath, '.claude');
  const hasClaude = fs.existsSync(claudeDir);
  return { ok: true, hasClaude, hasMcpConfig: fs.existsSync(path.join(claudeDir, 'settings.json')) };
});

function findPythonUserBin() {
  return new Promise((resolve) => {
    const proc = spawn('python3', ['-c', 'import site,os,sys; print(os.path.join(site.getuserbase(), "bin"))'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    proc.stdout.on('data', (d) => { out += d.toString(); });
    proc.on('error', () => resolve(null));
    proc.on('close', (code) => resolve(code === 0 ? out.trim() : null));
  });
}

function isCustomWrapper(binaryPath) {
  // Detect user-customized bash wrappers that intercept mempalace args
  try {
    const buf = fs.readFileSync(binaryPath, 'utf8');
    if (!buf || buf.length < 2) return false;
    if (!buf.startsWith('#!')) return false;
    const firstChunk = buf.slice(0, 4096);
    // Real pip-installed binary is a Python script, not bash with custom logic
    if (firstChunk.includes('MEMPALACE_HOME') || firstChunk.includes('single-command launcher')) return true;
    return false;
  } catch {
    return false;
  }
}

async function findMempalaceBinary() {
  // Priority: python user-base (clean pip install) > known fallback paths > `which` (last resort)
  // Reason: users may have custom bash wrappers in PATH that intercept args.
  const candidates = [];

  const userBin = await findPythonUserBin();
  if (userBin) candidates.push(path.join(userBin, 'mempalace'));

  candidates.push(
    path.join(os.homedir(), '.local/bin/mempalace'),
    '/opt/homebrew/bin/mempalace',
    '/usr/local/bin/mempalace'
  );

  // `which` last
  const whichResult = await new Promise((resolve) => {
    const proc = spawn('which', ['mempalace'], { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    proc.stdout.on('data', (d) => { out += d.toString(); });
    proc.on('error', () => resolve(null));
    proc.on('close', (code) => resolve(code === 0 ? out.trim() : null));
  });
  if (whichResult) candidates.push(whichResult);

  for (const c of candidates) {
    if (!c) continue;
    if (!fs.existsSync(c)) continue;
    if (isCustomWrapper(c)) continue;  // skip user wrappers — they break arg parsing
    return c;
  }
  return null;
}

ipcMain.handle('config:install-mempalace', async (_event, palacePath) => {
  return new Promise(async (resolve) => {
    if (!palacePath) return resolve({ ok: false, error: 'No path' });
    fs.mkdirSync(palacePath, { recursive: true });

    const log = [];
    const sendProgress = (line) => {
      log.push(line);
      mainWindow?.webContents.send('setup:progress', line);
    };

    sendProgress(`▸ pip3 install --user mempalace\n`);
    const pip = spawn('pip3', ['install', '--user', 'mempalace'], { stdio: ['ignore', 'pipe', 'pipe'] });
    pip.stdout.on('data', (d) => sendProgress(d.toString()));
    pip.stderr.on('data', (d) => sendProgress(d.toString()));
    pip.on('error', (err) => resolve({ ok: false, error: `pip3 not in PATH or failed to spawn: ${err.message}`, log: log.join('') }));
    pip.on('close', async (code) => {
      if (code !== 0) {
        return resolve({ ok: false, error: `pip install exit ${code} — is pip3 installed?`, log: log.join('') });
      }
      sendProgress(`\n✓ pip install done\n`);

      // Find mempalace binary now
      const mpBin = await findMempalaceBinary();
      if (!mpBin) {
        return resolve({
          ok: false,
          error: `mempalace binary not found after install. Add ~/Library/Python/<version>/bin to PATH and restart, or check pip3 user-base.`,
          log: log.join(''),
        });
      }
      sendProgress(`▸ ${mpBin} init ${palacePath} --yes\n`);

      const init = spawn(mpBin, ['init', palacePath, '--yes'], { stdio: ['ignore', 'pipe', 'pipe'] });
      init.stdout.on('data', (d) => sendProgress(d.toString()));
      init.stderr.on('data', (d) => sendProgress(d.toString()));
      init.on('error', (err) => resolve({ ok: false, error: `mempalace init spawn failed: ${err.message}`, log: log.join('') }));
      init.on('close', (icode) => {
        if (icode === 0) {
          config.updateConfig({ palacePath, setupComplete: true });
          sendProgress(`\n✓ mempalace init done — palace ready at ${palacePath}\n`);
          resolve({ ok: true, log: log.join(''), mempalaceBin: mpBin });
        } else {
          resolve({ ok: false, error: `mempalace init exit ${icode}`, log: log.join('') });
        }
      });
    });
  });
});

ipcMain.handle('config:open-folder', async (_event, p) => {
  if (p && fs.existsSync(p)) shell.openPath(p);
});

/* ================== Claude CLI detection + subscription login ================== */

ipcMain.handle('claude:cli-status', async () => {
  // Returns: { installed: bool, path: string|null, loggedIn: bool|'unknown' }
  const claudeBin = await new Promise((resolve) => {
    const proc = spawn('which', ['claude'], { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    proc.stdout.on('data', (d) => { out += d.toString(); });
    proc.on('error', () => resolve(null));
    proc.on('close', (code) => resolve(code === 0 ? out.trim() : null));
  });

  if (!claudeBin || !fs.existsSync(claudeBin)) {
    return { installed: false, path: null, loggedIn: false };
  }

  // Check for Claude credentials file (typical paths)
  const credsPaths = [
    path.join(os.homedir(), '.claude/credentials.json'),
    path.join(os.homedir(), '.config/claude/credentials.json'),
    path.join(os.homedir(), 'Library/Application Support/Claude/credentials.json'),
  ];
  const loggedIn = credsPaths.some((p) => fs.existsSync(p));

  return { installed: true, path: claudeBin, loggedIn };
});

/* ================== API keys ================== */

ipcMain.handle('apikeys:get', async () => {
  return config.readApiKeys();
});

ipcMain.handle('apikeys:set', async (_event, keys) => {
  return config.writeApiKeys(keys || {});
});

/* ================== M1 fallback (CLI shell-out) ================== */
ipcMain.handle('claude:send', async (_event, message) => {
  return new Promise((resolve, reject) => {
    const proc = spawn(getClaudeBinPath(), ['--print'], { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env } });
    let stdout = '', stderr = '';
    proc.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    proc.on('error', (err) => reject(new Error(`Failed: ${err.message}`)));
    proc.on('close', (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr.trim() || `claude exited ${code}`));
    });
    proc.stdin.write(message);
    proc.stdin.end();
  });
});

/* ================== M2 Agent SDK streaming ================== */
const activeQueries = new Map();

ipcMain.handle('claude:stream', async (event, streamId, message, openPanelTitles) => {
  const sender = event.sender;
  lastTurnStartTime = Date.now();
  let prompt = String(message || '');
  if (Array.isArray(openPanelTitles) && openPanelTitles.length > 0) {
    const list = openPanelTitles.map((t) => `"${t}"`).join(', ');
    prompt = `[CANVAS CONTEXT — currently open panels: ${list}]\n\nIf any palace mutation in this turn affects data shown in one of these panels, regenerate that panel using its EXACT SAME H1 heading at the end of your reply.\n\n---\n\n${prompt}`;
  }
  const palaceCwd = getPalaceCwd();

  // Inject saved Anthropic API key into env so SDK can authenticate
  // (lets users log in via Settings → API Keys without needing terminal)
  const apiKeys = config.readApiKeys();
  const previousKey = process.env.ANTHROPIC_API_KEY;
  if (apiKeys.anthropic) {
    process.env.ANTHROPIC_API_KEY = apiKeys.anthropic;
  }

  try {
    const { query } = await import('@anthropic-ai/claude-agent-sdk');
    const additional = [];
    if (!isDev) {
      additional.push(app.getAppPath());
    }
    const q = query({
      prompt,
      options: {
        cwd: palaceCwd,
        additionalDirectories: additional,
        permissionMode: 'bypassPermissions',
        maxTurns: 50,
        systemPrompt: { type: 'preset', preset: 'claude_code', append: SYSTEM_PROMPT_APPEND },
      },
    });
    activeQueries.set(streamId, q);
    try {
      for await (const msg of q) sender.send('claude:message', streamId, msg);
      sender.send('claude:done', streamId);
      maybeNotify('done');
    } finally {
      activeQueries.delete(streamId);
    }
  } catch (err) {
    console.error('[claude:stream]', err);
    let msg = String(err?.message || err);
    // Friendlier error for missing auth
    if (/api[_-]?key|authentication|unauthorized|401|403/i.test(msg)) {
      msg = `Authentication failed. Either:\n  1. Open Settings (⚙️) → API Keys → paste your Anthropic API key, or\n  2. Run "claude login" in the terminal drawer (Cmd+\`) once.\n\nOriginal error: ${msg}`;
    }
    sender.send('claude:error', streamId, msg);
    activeQueries.delete(streamId);
    maybeNotify('error');
  } finally {
    // Restore env var to whatever it was before this call
    if (previousKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = previousKey;
  }
});

ipcMain.handle('claude:cancel', async (_event, streamId) => {
  const q = activeQueries.get(streamId);
  if (q && typeof q.interrupt === 'function') {
    try { await q.interrupt(); } catch (err) { console.error('[cancel]', err); }
  }
});

/* ================== Notifications ================== */
function maybeNotify(kind) {
  if (!mainWindow) return;
  const elapsed = Date.now() - lastTurnStartTime;
  if (mainWindow.isFocused()) return;
  if (elapsed < 8000) return;
  const title = kind === 'error' ? '⚠️ MemPalace · error' : '✅ MemPalace · reply ready';
  const body = kind === 'error' ? 'Something failed — check chat' : 'Claude finished — switch to MemPalace';
  try { new Notification({ title, body, silent: false }).show(); } catch (err) { console.error('[notify]', err); }
}

/* ================== Drag-drop / paste-screenshot ================== */
function ensureArchivesDir() {
  const dir = getArchivesDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}
function timestampPrefix() {
  const d = new Date(), pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}
function safeFilename(name) {
  return String(name || 'file').replace(/[^\w.\-]/g, '_').slice(0, 80);
}

ipcMain.handle('palace:save-dropped-file', async (_event, { name, dataBase64 }) => {
  try {
    const dir = ensureArchivesDir();
    const filename = `${timestampPrefix()}-${safeFilename(name)}`;
    const fullPath = path.join(dir, filename);
    fs.writeFileSync(fullPath, Buffer.from(dataBase64, 'base64'));
    return { ok: true, path: fullPath, filename };
  } catch (err) { return { ok: false, error: String(err?.message || err) }; }
});

ipcMain.handle('palace:save-screenshot', async (_event, { dataBase64 }) => {
  try {
    const dir = ensureArchivesDir();
    const filename = `screenshot-${timestampPrefix()}.png`;
    const fullPath = path.join(dir, filename);
    fs.writeFileSync(fullPath, Buffer.from(dataBase64, 'base64'));
    return { ok: true, path: fullPath, filename };
  } catch (err) { return { ok: false, error: String(err?.message || err) }; }
});

/* ================== Terminal (xterm + node-pty) ================== */
const terminals = new Map();

ipcMain.handle('terminal:create', async (event, termId, cols, rows) => {
  try {
    const { spawn: spawnPty } = require('@homebridge/node-pty-prebuilt-multiarch');
    const shellBin = process.env.SHELL || '/bin/zsh';
    // Inject saved API keys as env vars so user can use any AI CLI seamlessly
    const apiKeys = config.readApiKeys();
    const envExtra = {};
    if (apiKeys.anthropic) envExtra.ANTHROPIC_API_KEY = apiKeys.anthropic;
    if (apiKeys.openai) envExtra.OPENAI_API_KEY = apiKeys.openai;
    if (apiKeys.google) envExtra.GOOGLE_API_KEY = apiKeys.google;
    if (apiKeys.gemini) envExtra.GEMINI_API_KEY = apiKeys.gemini;
    if (apiKeys.ollama_host) envExtra.OLLAMA_HOST = apiKeys.ollama_host;
    if (apiKeys.openrouter) envExtra.OPENROUTER_API_KEY = apiKeys.openrouter;

    // Pre-seed PATH with common Apple Silicon + Intel + user-local locations
    // so that even if .zshrc/.zprofile fail to load, brew/npm/python tools work.
    const PATH_BOOTSTRAP = [
      '/opt/homebrew/bin', '/opt/homebrew/sbin',
      '/usr/local/bin', '/usr/local/sbin',
      path.join(os.homedir(), '.local/bin'),
      path.join(os.homedir(), '.cargo/bin'),
      path.join(os.homedir(), 'Library/Python/3.14/bin'),
      path.join(os.homedir(), 'Library/Python/3.13/bin'),
      path.join(os.homedir(), 'Library/Python/3.12/bin'),
      path.join(os.homedir(), 'Library/Python/3.11/bin'),
      path.join(os.homedir(), 'Library/Python/3.10/bin'),
      path.join(os.homedir(), 'Library/Python/3.9/bin'),
      '/usr/bin', '/bin', '/usr/sbin', '/sbin',
    ].filter((p) => fs.existsSync(p));
    const seededPath = [...new Set([...PATH_BOOTSTRAP, ...(process.env.PATH || '').split(':').filter(Boolean)])].join(':');

    // -i = interactive (sources .zshrc) + -l = login (sources .zprofile)
    // This is what Terminal.app does and what gives users their full PATH.
    const shellArgs = shellBin.endsWith('zsh') || shellBin.endsWith('bash') ? ['-il'] : [];

    const pty = spawnPty(shellBin, shellArgs, {
      name: 'xterm-256color',
      cols: cols || 100,
      rows: rows || 30,
      cwd: getPalaceCwd(),
      env: {
        ...process.env,
        PATH: seededPath,
        TERM: 'xterm-256color',
        LANG: 'en_US.UTF-8',
        SHELL: shellBin,
        HOME: os.homedir(),
        ...envExtra,
      },
    });
    terminals.set(termId, pty);
    pty.onData((data) => {
      try { event.sender.send('terminal:data', termId, data); } catch {}
    });
    pty.onExit(({ exitCode, signal }) => {
      try { event.sender.send('terminal:exit', termId, { exitCode, signal }); } catch {}
      terminals.delete(termId);
    });
    return { ok: true, pid: pty.pid };
  } catch (err) {
    console.error('[terminal:create]', err);
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle('terminal:write', async (_event, termId, data) => {
  const pty = terminals.get(termId);
  if (pty) try { pty.write(data); } catch (err) { console.error(err); }
});

ipcMain.handle('terminal:resize', async (_event, termId, cols, rows) => {
  const pty = terminals.get(termId);
  if (pty) try { pty.resize(cols, rows); } catch (err) { console.error(err); }
});

ipcMain.handle('terminal:kill', async (_event, termId) => {
  const pty = terminals.get(termId);
  if (pty) {
    try { pty.kill(); } catch (err) { console.error(err); }
    terminals.delete(termId);
  }
});

/* ================== Email Phase 1 (SMTP) ================== */
const EMAIL_CREDS_FILE = () => path.join(app.getPath('userData'), 'email-creds.bin');

function saveCredsEncrypted(json) {
  if (!safeStorage.isEncryptionAvailable()) {
    fs.writeFileSync(EMAIL_CREDS_FILE(), JSON.stringify(json), 'utf8');
    return;
  }
  fs.writeFileSync(EMAIL_CREDS_FILE(), safeStorage.encryptString(JSON.stringify(json)));
}
function loadCredsEncrypted() {
  const f = EMAIL_CREDS_FILE();
  if (!fs.existsSync(f)) return null;
  try {
    const buf = fs.readFileSync(f);
    if (!safeStorage.isEncryptionAvailable()) return JSON.parse(buf.toString('utf8'));
    return JSON.parse(safeStorage.decryptString(buf));
  } catch (err) { return null; }
}

ipcMain.handle('email:has-creds', async () => {
  const creds = loadCredsEncrypted();
  return !!(creds && creds.user && creds.password);
});

ipcMain.handle('email:save-creds', async (_event, { user, password }) => {
  try { saveCredsEncrypted({ user, password }); return { ok: true }; }
  catch (err) { return { ok: false, error: String(err?.message || err) }; }
});

ipcMain.handle('email:clear-creds', async () => {
  try { if (fs.existsSync(EMAIL_CREDS_FILE())) fs.unlinkSync(EMAIL_CREDS_FILE()); return { ok: true }; }
  catch (err) { return { ok: false, error: String(err?.message || err) }; }
});

ipcMain.handle('email:send', async (_event, { to, subject, body, isMarkdown, panelKey }) => {
  try {
    const creds = loadCredsEncrypted();
    if (!creds) return { ok: false, error: 'No email credentials configured.' };
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: creds.user, pass: creds.password },
    });
    let finalSubject = subject || '(MemPalace)';
    if (panelKey && !finalSubject.includes('[mempalace')) {
      finalSubject = `[mempalace panel:${panelKey}] ${finalSubject}`;
    }
    let finalBody = body || '';
    if (panelKey) {
      finalBody += `\n\n---\nReply with: done | refresh | snooze 2d | delete  (first line, no quotes)\n`;
    }
    const info = await transporter.sendMail({
      from: `"MemPalace" <${creds.user}>`,
      to: to || creds.user,
      subject: finalSubject,
      text: finalBody,
      html: isMarkdown ? simpleMarkdownToHtml(finalBody) : undefined,
    });
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    console.error('[email:send]', err);
    return { ok: false, error: String(err?.message || err) };
  }
});

function simpleMarkdownToHtml(md) {
  if (!md) return '';
  return `<pre style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 14px; white-space: pre-wrap;">${md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`;
}

/* ================== Email Phase 2 (inbound IMAP poller) ================== */
const PHASE2_FLAG_FILE = () => path.join(app.getPath('userData'), 'email-phase2-enabled.flag');
let pollIntervalHandle = null;
let pollInProgress = false;

ipcMain.handle('email:phase2-enabled', async () => fs.existsSync(PHASE2_FLAG_FILE()));

ipcMain.handle('email:phase2-toggle', async (_event, enable) => {
  try {
    if (enable) {
      fs.writeFileSync(PHASE2_FLAG_FILE(), new Date().toISOString());
      startPolling();
      return { ok: true, enabled: true };
    } else {
      if (fs.existsSync(PHASE2_FLAG_FILE())) fs.unlinkSync(PHASE2_FLAG_FILE());
      stopPolling();
      return { ok: true, enabled: false };
    }
  } catch (err) { return { ok: false, error: String(err?.message || err) }; }
});

ipcMain.handle('email:phase2-poll-now', async () => await pollInbox());

function startPolling() {
  if (pollIntervalHandle) return;
  pollIntervalHandle = setInterval(() => { pollInbox(); }, 5 * 60 * 1000);
  setTimeout(() => { pollInbox(); }, 10_000);
  console.log('[phase2] polling started');
}

function stopPolling() {
  if (pollIntervalHandle) { clearInterval(pollIntervalHandle); pollIntervalHandle = null; }
}

async function pollInbox() {
  if (pollInProgress) return { ok: false, error: 'already polling' };
  pollInProgress = true;
  const creds = loadCredsEncrypted();
  if (!creds) { pollInProgress = false; return { ok: false, error: 'no creds' }; }
  let processed = 0, errors = [], client = null;
  try {
    const { ImapFlow } = require('imapflow');
    const { simpleParser } = require('mailparser');
    client = new ImapFlow({
      host: 'imap.gmail.com', port: 993, secure: true,
      auth: { user: creds.user, pass: creds.password }, logger: false,
    });
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const since = new Date(Date.now() - 7 * 86400_000);
      const uids = await client.search({ seen: false, since, header: { subject: '[mempalace' } }, { uid: true });
      for (const uid of (uids || [])) {
        try {
          const msg = await client.fetchOne(uid, { source: true, envelope: true }, { uid: true });
          if (!msg) continue;
          const subject = (msg.envelope && msg.envelope.subject) || '';
          const m = subject.match(/\[mempalace\s+(?:panel|task):([a-zA-Z0-9_-]+)\]/i);
          if (!m) continue;
          const targetKey = m[1];
          const parsed = await simpleParser(msg.source);
          const directive = parseEmailDirective((parsed.text || '').trim());
          if (!directive) {
            await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
            continue;
          }
          await processEmailDirective(targetKey, directive, creds.user);
          await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
          processed++;
        } catch (innerErr) { errors.push(String(innerErr?.message || innerErr)); }
      }
    } finally { lock.release(); }
    await client.logout();
  } catch (err) { errors.push(String(err?.message || err)); }
  finally { pollInProgress = false; if (client && client.usable) try { await client.logout(); } catch {} }
  console.log(`[phase2] processed=${processed} errors=${errors.length}`);
  return { ok: true, processed, errors };
}

function parseEmailDirective(body) {
  if (!body) return null;
  const firstLine = body.split('\n').map((l) => l.trim()).find((l) => l && !l.startsWith('>') && !l.startsWith('On ') && !l.startsWith('---')) || '';
  const lc = firstLine.toLowerCase();
  if (/^(done|complete|completed|finish|finished|✓|✅)/.test(lc)) return { type: 'complete', firstLine };
  if (/^(refresh|update|regenerate|sync)/.test(lc)) return { type: 'refresh', firstLine };
  if (/^(delete|remove)/.test(lc)) return { type: 'delete', firstLine };
  const snooze = lc.match(/^snooze\s+(\d+)\s*(d|day|days|h|hour|hours|m|min|mins|w|week|weeks)?/);
  if (snooze) return { type: 'snooze', amount: parseInt(snooze[1], 10), unit: snooze[2] || 'd', firstLine };
  return null;
}

async function processEmailDirective(targetKey, directive, userEmail) {
  let prompt = '';
  if (directive.type === 'complete') {
    prompt = `User completed task referenced by panel/drawer key "${targetKey}" via inbound email. Update palace: search for matching drawer, move pending → completed via mempalace_update_drawer. Add COMPLETED date. DO NOT delete. Then write a brief diary entry.`;
  } else if (directive.type === 'refresh') {
    prompt = `Refresh panel "${targetKey}" — pull current state from palace, write brief diary summary.`;
  } else if (directive.type === 'snooze') {
    prompt = `Snooze drawer "${targetKey}" by ${directive.amount} ${directive.unit}. Add SNOOZED.UNTIL stamp.`;
  } else if (directive.type === 'delete') {
    prompt = `User explicitly requested deletion of "${targetKey}" via email reply (line: "${directive.firstLine}"). Use mempalace_delete_drawer ONLY if genuine duplicate/ghost. If unsure, mark complete instead.`;
  }
  let result = '', success = false;
  try { result = await runClaudeCli(prompt); success = true; }
  catch (err) { result = String(err?.message || err); }
  await sendInboundAck(userEmail, targetKey, directive, success, result);
}

function runClaudeCli(prompt) {
  return new Promise((resolve, reject) => {
    const proc = spawn(getClaudeBinPath(), ['--print'], {
      cwd: getPalaceCwd(),
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = '', err = '';
    proc.stdout.on('data', (d) => { out += d.toString(); });
    proc.stderr.on('data', (d) => { err += d.toString(); });
    proc.on('error', (e) => reject(e));
    proc.on('close', (code) => {
      if (code === 0) resolve(out.trim());
      else reject(new Error(err.trim() || `claude exited ${code}`));
    });
    proc.stdin.write(prompt);
    proc.stdin.end();
    setTimeout(() => { try { proc.kill('SIGTERM'); } catch {} }, 90_000);
  });
}

async function sendInboundAck(userEmail, targetKey, directive, success, result) {
  try {
    const creds = loadCredsEncrypted();
    if (!creds) return;
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: creds.user, pass: creds.password },
    });
    const status = success ? '✅' : '⚠️';
    const subject = `[mempalace ack:${targetKey}] ${status} ${directive.type}`;
    const body = success
      ? `${status} Processed.\n\nDirective: ${directive.type}\nTarget: ${targetKey}\nReceived line: "${directive.firstLine}"\n\n--- Claude response ---\n${result.slice(0, 2000)}\n\n— MemPalace`
      : `${status} Failed.\n\nDirective: ${directive.type}\nTarget: ${targetKey}\nError: ${result.slice(0, 1500)}\n\n— MemPalace`;
    await transporter.sendMail({
      from: `"MemPalace" <${creds.user}>`, to: userEmail, subject, text: body,
    });
  } catch (err) { console.error('[ack]', err); }
}

/* ================== App lifecycle ================== */

app.whenReady().then(() => {
  config.init(app.getPath('userData'));
  createWindow();
  if (fs.existsSync(PHASE2_FLAG_FILE())) {
    setTimeout(startPolling, 8_000);
  }
});

app.on('window-all-closed', () => {
  for (const t of terminals.values()) try { t.kill(); } catch {}
  terminals.clear();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
