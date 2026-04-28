const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { safeStorage } = require('electron');

let configDir = null;
let CONFIG_PATH = null;
let API_KEYS_PATH = null;

function init(userDataPath) {
  configDir = userDataPath;
  CONFIG_PATH = path.join(userDataPath, 'config.json');
  API_KEYS_PATH = path.join(userDataPath, 'api-keys.bin');
}

function defaultConfig() {
  return {
    palacePath: null,            // Path to user's MemPalace folder (null = first-run wizard)
    archivesSubdir: 'wing_user/archives',
    claudeBinPath: '/opt/homebrew/bin/claude',  // auto-detected fallback
    chatProvider: 'claude',      // 'claude' | 'openai' | 'google' | 'ollama' (future)
    setupComplete: false,
  };
}

function readConfig() {
  if (!CONFIG_PATH) return defaultConfig();
  try {
    if (!fs.existsSync(CONFIG_PATH)) return defaultConfig();
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    return { ...defaultConfig(), ...JSON.parse(raw) };
  } catch (err) {
    console.error('[config:read]', err);
    return defaultConfig();
  }
}

function writeConfig(cfg) {
  if (!CONFIG_PATH) return false;
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('[config:write]', err);
    return false;
  }
}

function updateConfig(partial) {
  const current = readConfig();
  const next = { ...current, ...partial };
  writeConfig(next);
  return next;
}

function readApiKeys() {
  if (!API_KEYS_PATH || !fs.existsSync(API_KEYS_PATH)) return {};
  try {
    const buf = fs.readFileSync(API_KEYS_PATH);
    if (!safeStorage.isEncryptionAvailable()) {
      return JSON.parse(buf.toString('utf8'));
    }
    return JSON.parse(safeStorage.decryptString(buf));
  } catch (err) {
    console.error('[apiKeys:read]', err);
    return {};
  }
}

function writeApiKeys(keys) {
  if (!API_KEYS_PATH) return false;
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      fs.writeFileSync(API_KEYS_PATH, JSON.stringify(keys), 'utf8');
    } else {
      const buf = safeStorage.encryptString(JSON.stringify(keys));
      fs.writeFileSync(API_KEYS_PATH, buf);
    }
    return true;
  } catch (err) {
    console.error('[apiKeys:write]', err);
    return false;
  }
}

function defaultPalacePath() {
  return path.join(os.homedir(), 'Documents', 'MemPalace');
}

module.exports = {
  init,
  readConfig,
  writeConfig,
  updateConfig,
  readApiKeys,
  writeApiKeys,
  defaultPalacePath,
};
