import { useState, useEffect } from 'react';

const PROVIDERS = [
  { key: 'anthropic',   label: 'Anthropic API key',          envVar: 'ANTHROPIC_API_KEY',   hint: 'console.anthropic.com → API Keys' },
  { key: 'openai',      label: 'OpenAI API key',             envVar: 'OPENAI_API_KEY',      hint: 'platform.openai.com → API Keys' },
  { key: 'google',      label: 'Google API key',             envVar: 'GOOGLE_API_KEY',      hint: 'console.cloud.google.com / aistudio.google.com' },
  { key: 'gemini',      label: 'Gemini API key',             envVar: 'GEMINI_API_KEY',      hint: 'aistudio.google.com → Get API key' },
  { key: 'openrouter',  label: 'OpenRouter API key',         envVar: 'OPENROUTER_API_KEY',  hint: 'openrouter.ai → Keys' },
  { key: 'ollama_host', label: 'Ollama host (URL)',          envVar: 'OLLAMA_HOST',         hint: 'http://localhost:11434' },
];

export default function AppSettings({ onClose, onOpenTerminal, onSendToTerminal }) {
  const [palacePath, setPalacePath] = useState('');
  const [setupComplete, setSetupComplete] = useState(false);
  const [keys, setKeys] = useState({});
  const [showValues, setShowValues] = useState({});
  const [savedAt, setSavedAt] = useState(null);
  const [claudeCli, setClaudeCli] = useState({ installed: false, loggedIn: false, path: null });
  const [showInstallHelp, setShowInstallHelp] = useState(false);

  useEffect(() => {
    window.mempalace.config.get().then((cfg) => {
      setPalacePath(cfg.palacePath || '');
      setSetupComplete(!!cfg.setupComplete);
    });
    window.mempalace.apiKeys.get().then(setKeys);
    window.mempalace.claudeCli.status().then(setClaudeCli);
  }, []);

  function handleSubscriptionLogin() {
    if (!claudeCli.installed) {
      setShowInstallHelp(true);
      return;
    }
    // Open terminal and inject `claude login` command
    if (onOpenTerminal) onOpenTerminal();
    setTimeout(() => {
      if (onSendToTerminal) onSendToTerminal('claude login\n');
    }, 400);
    onClose();
  }

  async function refreshCliStatus() {
    const s = await window.mempalace.claudeCli.status();
    setClaudeCli(s);
  }

  async function changePalace() {
    const p = await window.mempalace.config.chooseFolder();
    if (!p) return;
    const v = await window.mempalace.config.validatePalace(p);
    if (!v.ok) {
      alert(`Invalid palace: ${v.error}`);
      return;
    }
    await window.mempalace.config.set({ palacePath: p });
    setPalacePath(p);
    alert('✅ Palace path updated. Some changes may need an app restart.');
  }

  function setKey(provider, value) {
    setKeys((prev) => ({ ...prev, [provider]: value }));
  }

  async function saveKeys() {
    await window.mempalace.apiKeys.set(keys);
    setSavedAt(new Date());
    setTimeout(() => setSavedAt(null), 2000);
  }

  function toggleShow(k) {
    setShowValues((prev) => ({ ...prev, [k]: !prev[k] }));
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>⚙️ Settings</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="modal-section-header">📂 MemPalace Path</div>
          <div className="settings-palace-row">
            <code className="settings-path">{palacePath || '(none — chat-only mode)'}</code>
            <button className="modal-btn" onClick={changePalace}>Change…</button>
            {palacePath && (
              <button className="modal-btn" onClick={() => window.mempalace.config.openFolder(palacePath)}>
                📂 Reveal
              </button>
            )}
          </div>
          <p className="modal-hint">
            Where Claude Agent SDK reads skills, agents, hooks, MCP servers, and your data.
            Restart the app after changing.
          </p>

          <div className="modal-section">
            <div className="modal-section-header">🔐 Claude Authentication</div>
            <p className="modal-hint">
              The chat sidebar uses Claude. Two ways to authenticate — pick whichever fits.
            </p>

            <div className="auth-option">
              <div className="auth-option-header">
                <span className="auth-option-title">🥇 Subscription login (Pro / Max)</span>
                <span className={`auth-option-status ${claudeCli.loggedIn ? 'good' : claudeCli.installed ? 'warn' : 'bad'}`}>
                  {claudeCli.loggedIn ? '✅ logged in' : claudeCli.installed ? '⏳ CLI installed, not logged in' : '❌ Claude CLI not installed'}
                </span>
              </div>
              <p className="auth-option-desc">
                Use your existing Claude Pro / Max subscription via OAuth.
                {claudeCli.path && <> CLI at <code>{claudeCli.path}</code>.</>}
              </p>
              <div className="auth-option-actions">
                <button
                  className="modal-btn-primary"
                  onClick={handleSubscriptionLogin}
                  disabled={!claudeCli.installed && !showInstallHelp}
                >
                  {claudeCli.loggedIn ? '🔁 Re-login' : '🔐 Login with Claude'}
                </button>
                <button className="modal-btn" onClick={refreshCliStatus}>🔄 Recheck</button>
                {!claudeCli.installed && (
                  <button className="modal-btn" onClick={() => setShowInstallHelp((v) => !v)}>
                    {showInstallHelp ? 'Hide' : 'Install help'}
                  </button>
                )}
              </div>
              {showInstallHelp && !claudeCli.installed && (
                <pre className="install-help">{`# Install Claude CLI (pick one):

# Option A — npm (works if you have Node.js)
npm install -g @anthropic-ai/claude-code

# Option B — homebrew (if you use brew)
brew install claude

# Option C — direct download
# Visit https://claude.com/download

# After install, click "Recheck" above, then "Login with Claude"`}</pre>
              )}
            </div>

            <div className="auth-option" style={{ marginTop: 14 }}>
              <div className="auth-option-header">
                <span className="auth-option-title">🥈 API key (separate billing)</span>
                <span className={`auth-option-status ${keys.anthropic ? 'good' : 'bad'}`}>
                  {keys.anthropic ? '✅ key saved' : '⚪ no key'}
                </span>
              </div>
              <p className="auth-option-desc">
                Paste an <code>ANTHROPIC_API_KEY</code> from <code>console.anthropic.com</code> below.
                Billed separately from Pro / Max subscription.
              </p>
            </div>
          </div>

          <div className="modal-section">
            <div className="modal-section-header">🔑 All API Keys (per provider)</div>
            <p className="modal-hint">
              Stored encrypted via macOS Keychain. Auto-injected as env vars in the
              terminal drawer so you can use any AI CLI seamlessly.
            </p>
            {PROVIDERS.map((p) => (
              <div key={p.key} className="settings-key-row">
                <label className="settings-key-label">
                  <span className="settings-key-title">{p.label}</span>
                  <span className="settings-key-env">{p.envVar}</span>
                </label>
                <div className="settings-key-input-wrap">
                  <input
                    type={showValues[p.key] ? 'text' : 'password'}
                    className="modal-input settings-key-input"
                    value={keys[p.key] || ''}
                    onChange={(e) => setKey(p.key, e.target.value)}
                    placeholder={p.hint}
                  />
                  <button
                    className="settings-key-show"
                    onClick={() => toggleShow(p.key)}
                    type="button"
                  >
                    {showValues[p.key] ? '🙈' : '👁'}
                  </button>
                </div>
              </div>
            ))}

            <div className="modal-actions" style={{ marginTop: 18 }}>
              <div style={{ flex: 1 }} />
              {savedAt && <span className="settings-saved">✓ saved</span>}
              <button className="modal-btn-primary" onClick={saveKeys}>💾 Save keys</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
