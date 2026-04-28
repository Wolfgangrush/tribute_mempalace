import { useState, useEffect } from 'react';

export function EmailSettings({ onClose, onSaved }) {
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [hasCreds, setHasCreds] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [phase2On, setPhase2On] = useState(false);
  const [phase2Busy, setPhase2Busy] = useState(false);

  useEffect(() => {
    window.mempalace.email.hasCreds().then(setHasCreds);
    window.mempalace.email.phase2Enabled().then(setPhase2On);
  }, []);

  async function togglePhase2() {
    if (!hasCreds) {
      setStatus('Save creds first before enabling Phase 2.');
      return;
    }
    setPhase2Busy(true);
    const res = await window.mempalace.email.phase2Toggle(!phase2On);
    setPhase2Busy(false);
    if (res.ok) {
      setPhase2On(res.enabled);
      setStatus(res.enabled ? '✅ Phase 2 enabled — polling every 5 min while app is open.' : 'Phase 2 disabled.');
    } else {
      setStatus('❌ ' + (res.error || 'Toggle failed'));
    }
  }

  async function pollNow() {
    setPhase2Busy(true);
    setStatus('Polling inbox now…');
    const res = await window.mempalace.email.phase2PollNow();
    setPhase2Busy(false);
    if (res.ok) {
      setStatus(`✅ Polled. Processed: ${res.processed}, errors: ${res.errors?.length || 0}`);
    } else {
      setStatus('❌ ' + (res.error || 'Poll failed'));
    }
  }

  async function save() {
    if (!user || !password) {
      setStatus('Both fields required.');
      return;
    }
    setSaving(true);
    setStatus('Saving (encrypted via Keychain)…');
    const res = await window.mempalace.email.saveCreds(user, password);
    setSaving(false);
    if (res.ok) {
      setStatus('✅ Saved. Close to use.');
      setHasCreds(true);
      if (onSaved) onSaved();
      setTimeout(() => onClose && onClose(), 600);
    } else {
      setStatus('❌ ' + (res.error || 'Failed'));
    }
  }

  async function clear() {
    if (!confirm('Clear stored email credentials?')) return;
    await window.mempalace.email.clearCreds();
    setUser('');
    setPassword('');
    setHasCreds(false);
    setStatus('Credentials cleared.');
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📧 Email Setup</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="modal-hint">
            One-time setup. Credentials encrypted via macOS Keychain (<code>safeStorage</code>).
            Generate a Gmail App Password at{' '}
            <code>myaccount.google.com/apppasswords</code> (requires 2FA on).
          </p>

          <label className="modal-label">Gmail address</label>
          <input
            type="email"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="you@gmail.com"
            className="modal-input"
            autoFocus
          />

          <label className="modal-label">App Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="16-character app password"
            className="modal-input"
          />

          <div className="modal-actions">
            {hasCreds && (
              <button className="modal-btn-danger" onClick={clear}>🗑 Clear stored</button>
            )}
            <div style={{ flex: 1 }} />
            <button className="modal-btn" onClick={onClose}>Cancel</button>
            <button className="modal-btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : '💾 Save'}
            </button>
          </div>

          {status && <div className="modal-status">{status}</div>}
          {hasCreds && !status && (
            <div className="modal-status">📌 Credentials stored. Re-enter to overwrite.</div>
          )}

          {hasCreds && (
            <div className="modal-section">
              <div className="modal-section-header">
                📨 Phase 2 — Inbound poller (reply-to-act)
              </div>
              <p className="modal-hint" style={{ marginTop: 0, marginBottom: 12 }}>
                Reply to a panel email with <code>done</code>, <code>refresh</code>, <code>snooze 2d</code>, or
                {' '}<code>delete</code> on the first line. App polls inbox every 5 min while running, parses
                directive, mutates palace via <code>claude</code> CLI, sends confirmation back.
              </p>
              <div className="modal-actions" style={{ marginTop: 0 }}>
                <button
                  className={phase2On ? 'modal-btn-danger' : 'modal-btn-primary'}
                  onClick={togglePhase2}
                  disabled={phase2Busy}
                >
                  {phase2Busy ? '…' : phase2On ? '⏹ Disable Phase 2' : '▶ Enable Phase 2'}
                </button>
                {phase2On && (
                  <button className="modal-btn" onClick={pollNow} disabled={phase2Busy}>
                    🔄 Poll now
                  </button>
                )}
                <div style={{ flex: 1 }} />
                <span className="phase2-state">
                  {phase2On ? '🟢 polling active' : '⚪ not polling'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function EmailCompose({ initialSubject, initialBody, panelKey, onClose }) {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState(initialSubject || '');
  const [body, setBody] = useState(initialBody || '');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState('');
  const [hasCreds, setHasCreds] = useState(true);

  useEffect(() => {
    window.mempalace.email.hasCreds().then((has) => {
      setHasCreds(has);
      if (!has) setStatus('No credentials. Set up Email first.');
    });
  }, []);

  async function send() {
    if (!subject) {
      setStatus('Subject required.');
      return;
    }
    setSending(true);
    setStatus('Sending…');
    const res = await window.mempalace.email.send(to || '', subject, body, true, panelKey);
    setSending(false);
    if (res.ok) {
      setStatus('✅ Sent.');
      setTimeout(() => onClose && onClose(), 800);
    } else {
      setStatus('❌ ' + (res.error || 'Send failed'));
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📧 Send Email</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {!hasCreds && (
            <div className="modal-warn">
              ⚠️ No email credentials. Open Email Setup first (gear icon in titlebar).
            </div>
          )}
          <label className="modal-label">To (leave empty = send to yourself)</label>
          <input
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="(yourself)"
            className="modal-input"
          />

          <label className="modal-label">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="modal-input"
          />

          <label className="modal-label">Body (markdown)</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={14}
            className="modal-textarea"
            placeholder="Type, or auto-filled from current panel"
          />

          <div className="modal-actions">
            <div style={{ flex: 1 }} />
            <button className="modal-btn" onClick={onClose}>Cancel</button>
            <button className="modal-btn-primary" onClick={send} disabled={sending || !hasCreds}>
              {sending ? 'Sending…' : '📤 Send'}
            </button>
          </div>

          {status && <div className="modal-status">{status}</div>}
        </div>
      </div>
    </div>
  );
}
