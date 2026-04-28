import { useState, useEffect, useRef } from 'react';

/**
 * First-run wizard. Shows when config.palacePath is null.
 * Three options:
 *   1. Connect to existing MemPalace folder (file picker)
 *   2. Create new (auto pip install + mempalace init at chosen path)
 *   3. Skip — chat only mode (no palace integration)
 */
export default function SetupWizard({ onDone }) {
  const [step, setStep] = useState('intro');  // intro | choose-existing | create-new | installing | done | skip
  const [defaultPath, setDefaultPath] = useState('');
  const [chosenPath, setChosenPath] = useState('');
  const [progress, setProgress] = useState([]);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState('');
  const progressUnsub = useRef(null);

  useEffect(() => {
    window.mempalace.config.defaultPalacePath().then((p) => {
      setDefaultPath(p);
      setChosenPath(p);
    });
    progressUnsub.current = window.mempalace.config.onSetupProgress((line) => {
      setProgress((prev) => [...prev, line]);
    });
    return () => {
      if (progressUnsub.current) progressUnsub.current();
    };
  }, []);

  async function pickExistingFolder() {
    const p = await window.mempalace.config.chooseFolder();
    if (!p) return;
    const v = await window.mempalace.config.validatePalace(p);
    if (!v.ok) {
      setError(v.error || 'Invalid folder');
      return;
    }
    if (!v.hasClaude) {
      const proceed = window.confirm(
        `The folder "${p}" doesn't have a .claude/ subfolder yet. Use it anyway? (You can run "mempalace init" inside it later.)`
      );
      if (!proceed) return;
    }
    await window.mempalace.config.set({ palacePath: p, setupComplete: true });
    onDone();
  }

  async function pickInstallFolder() {
    const p = await window.mempalace.config.chooseFolder();
    if (p) setChosenPath(p);
  }

  async function runInstall() {
    if (!chosenPath) {
      setError('Pick a folder first.');
      return;
    }
    setInstalling(true);
    setProgress([]);
    setError('');
    setStep('installing');
    const res = await window.mempalace.config.installMemPalace(chosenPath);
    setInstalling(false);
    if (res.ok) {
      setStep('done');
    } else {
      setError(res.error || 'Install failed');
      setStep('create-new');
    }
  }

  async function abortInstall() {
    await window.mempalace.config.abortInstall();
    setInstalling(false);
    setError('Install cancelled');
    setStep('create-new');
  }

  async function skipPalace() {
    await window.mempalace.config.set({ palacePath: null, setupComplete: true });
    onDone();
  }

  async function finish() {
    onDone();
  }

  return (
    <div className="modal-backdrop wizard-backdrop">
      <div className="modal modal-large wizard-modal">
        <div className="modal-header">
          <h2>📦 Welcome to MemPalace</h2>
        </div>
        <div className="modal-body">
          {step === 'intro' && (
            <>
              <p className="wizard-intro">
                MemPalace.app is a desktop wrapper for the Claude agent loop, with a multi-panel canvas, terminal, email, and palace integration.
              </p>
              <p className="wizard-intro">
                It can read/write a <strong>MemPalace</strong> — a structured memory store using "wings", "rooms", and "drawers" — for skills, agents, hooks, and your personal data.
              </p>
              <p className="wizard-intro">Pick how to start:</p>

              <div className="wizard-options">
                <div className="wizard-card" onClick={() => setStep('choose-existing')}>
                  <div className="wizard-card-icon">📂</div>
                  <div className="wizard-card-title">I have an existing MemPalace</div>
                  <div className="wizard-card-desc">Point me at the folder.</div>
                </div>
                <div className="wizard-card" onClick={() => setStep('create-new')}>
                  <div className="wizard-card-icon">✨</div>
                  <div className="wizard-card-title">Create new MemPalace</div>
                  <div className="wizard-card-desc">Install <code>mempalace</code> via pip + initialize an empty palace.</div>
                </div>
                <div className="wizard-card" onClick={() => setStep('skip')}>
                  <div className="wizard-card-icon">⏭️</div>
                  <div className="wizard-card-title">Skip — chat-only mode</div>
                  <div className="wizard-card-desc">Use Claude chat without a palace. (Configure later in settings.)</div>
                </div>
              </div>

              <div className="wizard-auth-hint">
                <strong>📌 You'll also need Claude authentication:</strong> after setup, open
                {' '}<strong>Settings (⚙️) → API Keys</strong> and paste your
                {' '}<code>ANTHROPIC_API_KEY</code> from <code>console.anthropic.com</code>,
                {' '}<em>OR</em> open the terminal (<code>Cmd+`</code>) and run <code>claude login</code>.
                Without one of these, chat won't work.
              </div>
            </>
          )}

          {step === 'choose-existing' && (
            <>
              <p>Choose the folder that contains your MemPalace data.</p>
              <div className="modal-actions" style={{ marginTop: 24 }}>
                <button className="modal-btn" onClick={() => setStep('intro')}>← Back</button>
                <div style={{ flex: 1 }} />
                <button className="modal-btn-primary" onClick={pickExistingFolder}>📂 Choose folder…</button>
              </div>
              {error && <div className="modal-status" style={{ color: '#ff9090' }}>{error}</div>}
            </>
          )}

          {step === 'create-new' && (
            <>
              <p>Where should the new MemPalace live?</p>
              <div className="wizard-path-row">
                <code>{chosenPath || defaultPath}</code>
                <button className="modal-btn" onClick={pickInstallFolder}>Change…</button>
              </div>

              <p className="modal-hint" style={{ marginTop: 18 }}>
                I'll run: <code>pip3 install --user mempalace</code> then <code>mempalace init {chosenPath}</code>
              </p>
              <p className="modal-hint">
                Requires Python 3 + pip3 in PATH. If pip3 is missing, install Python from <code>python.org</code> first.
              </p>

              <div className="modal-actions" style={{ marginTop: 24 }}>
                <button className="modal-btn" onClick={() => setStep('intro')}>← Back</button>
                <div style={{ flex: 1 }} />
                <button className="modal-btn-primary" onClick={runInstall} disabled={installing}>
                  {installing ? 'Installing…' : '✨ Install + Init'}
                </button>
              </div>
              {error && <div className="modal-status" style={{ color: '#ff9090', marginTop: 12 }}>{error}</div>}
            </>
          )}

          {step === 'installing' && (
            <>
              <p>Installing MemPalace… <span className="modal-hint" style={{ fontSize: 11 }}>(pip install can take 1-3 min)</span></p>
              <pre className="wizard-progress">
                {progress.length === 0 ? '(starting…)' : progress.join('')}
              </pre>
              <div className="modal-actions" style={{ marginTop: 12 }}>
                <button className="modal-btn-danger" onClick={abortInstall}>⏹ Cancel install</button>
              </div>
            </>
          )}

          {step === 'skip' && (
            <>
              <p>Skipping palace setup. Claude chat will work, but skills/agents/hooks/MCP from a palace won't be available.</p>
              <p className="modal-hint">You can configure a palace later: Settings → Palace.</p>
              <div className="modal-actions" style={{ marginTop: 24 }}>
                <button className="modal-btn" onClick={() => setStep('intro')}>← Back</button>
                <div style={{ flex: 1 }} />
                <button className="modal-btn-primary" onClick={skipPalace}>OK — skip palace</button>
              </div>
            </>
          )}

          {step === 'done' && (
            <>
              <p>✅ MemPalace installed at:</p>
              <pre className="wizard-progress" style={{ maxHeight: 80 }}>{chosenPath}</pre>
              <p className="modal-hint">Opening folder for verification…</p>
              <div className="modal-actions" style={{ marginTop: 18 }}>
                <button className="modal-btn" onClick={() => window.mempalace.config.openFolder(chosenPath)}>📂 Reveal in Finder</button>
                <div style={{ flex: 1 }} />
                <button className="modal-btn-primary" onClick={finish}>Continue →</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
