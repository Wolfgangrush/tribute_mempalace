import { useState, useEffect } from 'react';

const PROVIDERS = [
  { key: 'anthropic',   label: 'Anthropic API key',          envVar: 'ANTHROPIC_API_KEY',   hint: 'console.anthropic.com → API Keys' },
  { key: 'openai',      label: 'OpenAI API key',             envVar: 'OPENAI_API_KEY',      hint: 'platform.openai.com → API Keys' },
  { key: 'google',      label: 'Google API key',             envVar: 'GOOGLE_API_KEY',      hint: 'console.cloud.google.com / aistudio.google.com' },
  { key: 'gemini',      label: 'Gemini API key',             envVar: 'GEMINI_API_KEY',      hint: 'aistudio.google.com → Get API key' },
  { key: 'openrouter',  label: 'OpenRouter API key',         envVar: 'OPENROUTER_API_KEY',  hint: 'openrouter.ai → Keys' },
  { key: 'ollama_host', label: 'Ollama host (URL)',          envVar: 'OLLAMA_HOST',         hint: 'http://localhost:11434' },
];

export default function AppSettings({ onClose }) {
  const [palacePath, setPalacePath] = useState('');
  const [setupComplete, setSetupComplete] = useState(false);
  const [keys, setKeys] = useState({});
  const [showValues, setShowValues] = useState({});
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    window.mempalace.config.get().then((cfg) => {
      setPalacePath(cfg.palacePath || '');
      setSetupComplete(!!cfg.setupComplete);
    });
    window.mempalace.apiKeys.get().then(setKeys);
  }, []);

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
            <div className="modal-section-header">🔑 API Keys (per provider)</div>
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
