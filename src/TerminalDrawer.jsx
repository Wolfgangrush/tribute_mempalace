import { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';

let nextTermId = 1000;

export default function TerminalDrawer({ visible }) {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const fitRef = useRef(null);
  const termIdRef = useRef(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!visible || initialized.current || !containerRef.current) return;
    initialized.current = true;

    const term = new Terminal({
      fontFamily: '"SF Mono", ui-monospace, Menlo, monospace',
      fontSize: 12,
      lineHeight: 1.3,
      theme: {
        background: '#0f0f14',
        foreground: '#e8e8ea',
        cursor: '#7aa8ff',
        cursorAccent: '#0f0f14',
        selectionBackground: '#3a4a64',
        black: '#1a1a1f',
        red: '#ff7a7a',
        green: '#9ada9a',
        yellow: '#e8c878',
        blue: '#7aa8ff',
        magenta: '#c8a8ff',
        cyan: '#7adada',
        white: '#d8d8da',
        brightBlack: '#3a3a40',
        brightRed: '#ff9090',
        brightGreen: '#aaffaa',
        brightYellow: '#ffd888',
        brightBlue: '#9ac8ff',
        brightMagenta: '#d8b8ff',
        brightCyan: '#9aeaea',
        brightWhite: '#ffffff',
      },
      cursorBlink: true,
      scrollback: 5000,
      allowProposedApi: true,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(containerRef.current);
    fit.fit();

    termRef.current = term;
    fitRef.current = fit;

    const termId = `term-${nextTermId++}`;
    termIdRef.current = termId;

    const cols = term.cols, rows = term.rows;

    window.mempalace.terminal
      .create(termId, cols, rows, {
        onData: (data) => term.write(data),
        onExit: ({ exitCode }) => {
          term.write(`\r\n\x1b[31m[shell exited code=${exitCode}]\x1b[0m\r\n`);
        },
      })
      .then((res) => {
        if (!res.ok) {
          term.write(`\r\n\x1b[31m[failed to start shell: ${res.error}]\x1b[0m\r\n`);
        } else {
          term.focus();
        }
      });

    term.onData((data) => {
      window.mempalace.terminal.write(termId, data);
    });

    // Listen for external write requests (e.g. Settings → "Login with Claude")
    function onExternalWrite(e) {
      const text = e.detail;
      if (text && termIdRef.current) {
        window.mempalace.terminal.write(termIdRef.current, text);
      }
    }
    window.addEventListener('mempalace:terminal:write', onExternalWrite);

    const onResize = () => {
      try {
        fit.fit();
        const c = term.cols, r = term.rows;
        window.mempalace.terminal.resize(termId, c, r);
      } catch (err) {
        console.error('[term resize]', err);
      }
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      window.removeEventListener('mempalace:terminal:write', onExternalWrite);
      try { window.mempalace.terminal.kill(termId); } catch {}
      try { term.dispose(); } catch {}
      termRef.current = null;
      fitRef.current = null;
      termIdRef.current = null;
      initialized.current = false;
    };
  }, [visible]);

  // Refit when visibility changes
  useEffect(() => {
    if (visible && fitRef.current) {
      const t = setTimeout(() => {
        try { fitRef.current?.fit(); } catch {}
      }, 50);
      return () => clearTimeout(t);
    }
  }, [visible]);

  return (
    <div className={`terminal-drawer ${visible ? 'visible' : 'hidden'}`}>
      <div className="terminal-header">
        <span className="terminal-title">🖥️ Terminal</span>
        <span className="terminal-cwd">{visible ? '~/Desktop/mempalace' : ''}</span>
        <span className="terminal-hint">Cmd+` to toggle</span>
      </div>
      <div ref={containerRef} className="terminal-container" />
    </div>
  );
}
