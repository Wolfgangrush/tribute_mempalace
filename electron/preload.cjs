const { contextBridge, ipcRenderer } = require('electron');

let nextStreamId = 0;
const streamHandlers = new Map();

ipcRenderer.on('claude:message', (_event, streamId, msg) => {
  const h = streamHandlers.get(streamId);
  if (h?.onMessage) h.onMessage(msg);
});
ipcRenderer.on('claude:done', (_event, streamId) => {
  const h = streamHandlers.get(streamId);
  if (h?.onDone) h.onDone();
  streamHandlers.delete(streamId);
});
ipcRenderer.on('claude:error', (_event, streamId, err) => {
  const h = streamHandlers.get(streamId);
  if (h?.onError) h.onError(err);
  streamHandlers.delete(streamId);
});

// Terminal: per-termId data/exit listeners
const terminalHandlers = new Map();
ipcRenderer.on('terminal:data', (_event, termId, data) => {
  const h = terminalHandlers.get(termId);
  if (h?.onData) h.onData(data);
});
ipcRenderer.on('terminal:exit', (_event, termId, info) => {
  const h = terminalHandlers.get(termId);
  if (h?.onExit) h.onExit(info);
  terminalHandlers.delete(termId);
});

// setup:progress events for first-run wizard
const setupProgressHandlers = new Set();
ipcRenderer.on('setup:progress', (_event, line) => {
  for (const h of setupProgressHandlers) h(line);
});

contextBridge.exposeInMainWorld('mempalace', {
  // Config + first-run setup
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    set: (partial) => ipcRenderer.invoke('config:set', partial),
    chooseFolder: () => ipcRenderer.invoke('config:choose-folder'),
    defaultPalacePath: () => ipcRenderer.invoke('config:default-palace-path'),
    validatePalace: (palacePath) => ipcRenderer.invoke('config:validate-palace', palacePath),
    installMemPalace: (palacePath) => ipcRenderer.invoke('config:install-mempalace', palacePath),
    abortInstall: () => ipcRenderer.invoke('config:abort-install'),
    openFolder: (p) => ipcRenderer.invoke('config:open-folder', p),
    onSetupProgress: (cb) => {
      setupProgressHandlers.add(cb);
      return () => setupProgressHandlers.delete(cb);
    },
  },

  // API keys (encrypted via Keychain, exposed as env vars to terminal)
  apiKeys: {
    get: () => ipcRenderer.invoke('apikeys:get'),
    set: (keys) => ipcRenderer.invoke('apikeys:set', keys),
  },

  // Claude CLI status (for subscription login flow)
  claudeCli: {
    status: () => ipcRenderer.invoke('claude:cli-status'),
  },

  // M1 — sync CLI shell-out
  sendMessage: (message) => ipcRenderer.invoke('claude:send', message),

  // M2 — streaming Agent SDK
  streamMessage: (message, openPanelTitles, { onMessage, onDone, onError }) => {
    const id = ++nextStreamId;
    streamHandlers.set(id, { onMessage, onDone, onError });
    ipcRenderer.invoke('claude:stream', id, message, openPanelTitles || []).catch((err) => {
      if (onError) onError(String(err?.message || err));
      streamHandlers.delete(id);
    });
    return () => {
      ipcRenderer.invoke('claude:cancel', id);
      streamHandlers.delete(id);
    };
  },

  // M4 — drag-drop & paste-screenshot
  saveDroppedFile: (name, dataBase64) =>
    ipcRenderer.invoke('palace:save-dropped-file', { name, dataBase64 }),
  saveScreenshot: (dataBase64) =>
    ipcRenderer.invoke('palace:save-screenshot', { dataBase64 }),

  // M5 — Terminal API
  terminal: {
    create: (termId, cols, rows, { onData, onExit } = {}) => {
      terminalHandlers.set(termId, { onData, onExit });
      return ipcRenderer.invoke('terminal:create', termId, cols, rows);
    },
    write: (termId, data) => ipcRenderer.invoke('terminal:write', termId, data),
    resize: (termId, cols, rows) => ipcRenderer.invoke('terminal:resize', termId, cols, rows),
    kill: (termId) => {
      terminalHandlers.delete(termId);
      return ipcRenderer.invoke('terminal:kill', termId);
    },
  },

  // M5 — Email API (Phase 1 SMTP + Phase 2 IMAP)
  email: {
    hasCreds: () => ipcRenderer.invoke('email:has-creds'),
    saveCreds: (user, password) => ipcRenderer.invoke('email:save-creds', { user, password }),
    clearCreds: () => ipcRenderer.invoke('email:clear-creds'),
    send: (to, subject, body, isMarkdown, panelKey) =>
      ipcRenderer.invoke('email:send', { to, subject, body, isMarkdown, panelKey }),
    phase2Enabled: () => ipcRenderer.invoke('email:phase2-enabled'),
    phase2Toggle: (enable) => ipcRenderer.invoke('email:phase2-toggle', enable),
    phase2PollNow: () => ipcRenderer.invoke('email:phase2-poll-now'),
  },
});
