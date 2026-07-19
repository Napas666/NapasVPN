// Picks the connection engine by key type and presents one interface to main.js:
//   - vless://              → xrayManager   (system proxy, unchanged, works)
//   - ss:// / ssconf://      → tunManager    (device-wide TUN + Outline prefix helper)
//
// Shadowsocks/Outline keys go through the TUN engine because that is what makes
// them behave like the official Outline/VanyaVPN client (device-wide capture),
// which the proxy path could not achieve.

const xrayManager = require('./xrayManager');
const tunManager = require('./tunManager');

let active = null; // the engine handling the current/last connection

function engineFor(key) {
  const k = (key || '').trim();
  if (k.startsWith('ss://') || k.startsWith('ssconf://')) return tunManager;
  return xrayManager; // vless:// (and anything else xray understands)
}

async function start(key) {
  // If a different engine is currently active, make sure it's fully stopped.
  const next = engineFor(key);
  if (active && active !== next) {
    try { await active.stop(); } catch (_) {}
  }
  active = next;
  return active.start(key);
}

async function stop() {
  if (!active) {
    // Nothing active — stop both defensively.
    await Promise.allSettled([xrayManager.stop(), tunManager.stop()]);
    return { success: true };
  }
  const r = await active.stop();
  return r || { success: true };
}

function getStatus() { return active ? active.getStatus() : { connected: false }; }
function getLastKey() { return active ? active.getLastKey() : null; }
function getLastServer() { return active ? active.getLastServer() : null; }
function measureLatency(host, port) {
  const eng = active || xrayManager;
  return eng.measureLatency(host, port);
}

// Forward unexpected exits from whichever engine is active.
function onUnexpectedExit(cb) {
  xrayManager.onUnexpectedExit((info) => { if (active === xrayManager) cb(info); });
  tunManager.onUnexpectedExit((info) => { if (active === tunManager) cb(info); });
}

module.exports = { start, stop, getStatus, getLastKey, getLastServer, measureLatency, onUnexpectedExit };
