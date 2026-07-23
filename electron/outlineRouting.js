// Named-pipe client for OutlineService (the Windows routing daemon vendored
// from Outline/VanyaVPN). It configures the system routing table so the TAP
// adapter receives all traffic while the proxy server IP is bypassed, and
// reports the gateway adapter index. Ported from Outline's routing_service.ts.

const net = require('net');

const PIPE_NAME = '\\\\.\\pipe\\OutlineServicePipe';

const ACTION = {
  CONFIGURE_ROUTING: 'configureRouting',
  RESET_ROUTING: 'resetRouting',
};
const STATUS_SUCCESS = 0;

class OutlineRouting {
  constructor() {
    this.socket = null;
    this.onDisconnect = null;
  }

  /**
   * Connects to OutlineService and configures routing.
   * @param {string} proxyIp  the VPN server IP to keep OUTSIDE the tunnel
   * @param {string[]} bypassIps  extra IPs to bypass (split-tunnel); usually []
   * @returns {Promise<string>} the gateway adapter index
   */
  configureRouting(proxyIp, bypassIps = []) {
    // Retry across the service's pipe re-arm gap (Outline fork behaviour).
    return this._retry(() => this._configureOnce(proxyIp, bypassIps), 4, 250);
  }

  async _retry(fn, attempts, delayMs) {
    let lastErr;
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (e) {
        lastErr = e;
        const msg = String((e && e.message) || e);
        const transient = /ENOENT|ECONNREFUSED|EPIPE|not running/i.test(msg);
        if (i === attempts - 1 || !transient) throw e;
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
    throw lastErr;
  }

  _configureOnce(proxyIp, bypassIps) {
    return new Promise((resolve, reject) => {
      let settled = false;
      let gotFirst = false;
      const socket = net.createConnection(PIPE_NAME, () => {
        socket.write(JSON.stringify({
          action: ACTION.CONFIGURE_ROUTING,
          parameters: {
            proxyIp,
            isAutoConnect: false,
            bypassIps: JSON.stringify(bypassIps || []),
          },
        }));
      });

      const fail = (err) => {
        if (settled) return;
        settled = true;
        try { socket.destroy(); } catch (_) {}
        reject(err instanceof Error ? err : new Error(String(err)));
      };

      socket.once('error', fail);

      socket.on('data', (data) => {
        let msg;
        try { msg = JSON.parse(data.toString()); } catch (_) { return; }
        if (!gotFirst) {
          gotFirst = true;
          if (msg.action === ACTION.CONFIGURE_ROUTING && msg.statusCode === STATUS_SUCCESS) {
            settled = true;
            socket.removeListener('error', fail);
            socket.on('error', () => { if (this.onDisconnect) this.onDisconnect(); });
            socket.on('close', () => { if (this.onDisconnect) this.onDisconnect(); });
            this.socket = socket;
            resolve(String(msg.gatewayAdapterIndex || ''));
          } else {
            fail(new Error(msg && msg.errorMessage ? msg.errorMessage : 'routing service refused CONFIGURE_ROUTING'));
          }
        }
        // Later statusChanged / setBypassRoutes echoes are ignored.
      });
    });
  }

  /** Tells OutlineService to restore the original routing, then closes. */
  resetRouting() {
    return new Promise((resolve) => {
      const sock = this.socket;
      this.socket = null;
      if (!sock) return resolve();
      try {
        sock.write(JSON.stringify({ action: ACTION.RESET_ROUTING, parameters: {} }), () => {
          setTimeout(() => { try { sock.end(); } catch (_) {} resolve(); }, 250);
        });
      } catch (_) {
        try { sock.destroy(); } catch (__) {}
        resolve();
      }
    });
  }
}

module.exports = { OutlineRouting, PIPE_NAME };
