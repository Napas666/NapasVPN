const net = require('net');

/** Waits until a TCP port is accepting connections (default ~5s). */
function waitForPort(port, host = '127.0.0.1', timeout = 5000) {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeout;
    function attempt() {
      const sock = new net.Socket();
      sock.setTimeout(500);
      sock.on('connect', () => { sock.destroy(); resolve(true); });
      sock.on('error',   () => { sock.destroy(); retry(); });
      sock.on('timeout', () => { sock.destroy(); retry(); });
      sock.connect(port, host);
    }
    function retry() {
      if (Date.now() >= deadline) { resolve(false); return; }
      setTimeout(attempt, 300);
    }
    attempt();
  });
}

/** Measures TCP connect latency to host:port (ms), or -1 on failure. */
function measureLatency(host, port) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const sock = new net.Socket();
    sock.setTimeout(3000);
    sock.on('connect', () => { const ms = Date.now() - t0; sock.destroy(); resolve({ ms, ok: true }); });
    sock.on('error',   () => { sock.destroy(); resolve({ ms: -1, ok: false }); });
    sock.on('timeout', () => { sock.destroy(); resolve({ ms: -1, ok: false }); });
    sock.connect(port, host);
  });
}

/**
 * Verifies real traffic flows by fetching a 204 endpoint through the local
 * HTTP proxy. Proves the whole chain works, not just that a port opened.
 * For TUN mode there is no HTTP proxy, so pass a direct=true probe instead.
 */
function checkConnectivityViaHttpProxy(httpPort, timeout = 10000) {
  const endpoints = [
    { host: 'www.gstatic.com',  path: 'http://www.gstatic.com/generate_204' },
    { host: 'cp.cloudflare.com', path: 'http://cp.cloudflare.com/generate_204' },
    { host: 'detectportal.firefox.com', path: 'http://detectportal.firefox.com/success.txt' },
  ];
  function probe(ep) {
    return new Promise((resolve) => {
      const sock = new net.Socket();
      let done = false, buf = '';
      const finish = (ok, detail) => { if (!done) { done = true; try { sock.destroy(); } catch (_) {} resolve({ ok, detail }); } };
      sock.setTimeout(timeout);
      sock.on('timeout', () => finish(false, 'timeout'));
      sock.on('error', (e) => finish(false, e.message));
      sock.on('connect', () => {
        sock.write(`GET ${ep.path} HTTP/1.1\r\nHost: ${ep.host}\r\nUser-Agent: NapasVPN\r\nProxy-Connection: close\r\nConnection: close\r\n\r\n`);
      });
      sock.on('data', (d) => {
        buf += d.toString('latin1');
        const m = buf.match(/^HTTP\/1\.[01] (\d{3})/);
        if (m) { const code = parseInt(m[1], 10); finish(code >= 200 && code < 400, `HTTP ${code}`); }
      });
      sock.connect(httpPort, '127.0.0.1');
    });
  }
  return (async () => {
    let last = 'нет ответа';
    for (const ep of endpoints) {
      const r = await probe(ep);
      if (r.ok) return { ok: true, detail: r.detail };
      last = r.detail;
    }
    return { ok: false, detail: last };
  })();
}

/**
 * Verifies connectivity with a plain HTTP request (no proxy). In TUN mode all
 * traffic is already routed through the tunnel, so a normal request that
 * succeeds proves the tunnel carries traffic.
 */
function checkConnectivityDirect(timeout = 10000) {
  const endpoints = [
    { host: 'www.gstatic.com', path: '/generate_204' },
    { host: 'cp.cloudflare.com', path: '/generate_204' },
    { host: 'detectportal.firefox.com', path: '/success.txt' },
  ];
  function probe(ep) {
    return new Promise((resolve) => {
      const sock = new net.Socket();
      let done = false, buf = '';
      const finish = (ok, detail) => { if (!done) { done = true; try { sock.destroy(); } catch (_) {} resolve({ ok, detail }); } };
      sock.setTimeout(timeout);
      sock.on('timeout', () => finish(false, 'timeout'));
      sock.on('error', (e) => finish(false, e.message));
      sock.on('connect', () => {
        sock.write(`GET ${ep.path} HTTP/1.1\r\nHost: ${ep.host}\r\nUser-Agent: NapasVPN\r\nConnection: close\r\n\r\n`);
      });
      sock.on('data', (d) => {
        buf += d.toString('latin1');
        const m = buf.match(/^HTTP\/1\.[01] (\d{3})/);
        if (m) { const code = parseInt(m[1], 10); finish(code >= 200 && code < 400, `HTTP ${code}`); }
      });
      sock.connect(80, ep.host);
    });
  }
  return (async () => {
    let last = 'нет ответа';
    for (const ep of endpoints) {
      const r = await probe(ep);
      if (r.ok) return { ok: true, detail: r.detail };
      last = r.detail;
    }
    return { ok: false, detail: last };
  })();
}

module.exports = { waitForPort, measureLatency, checkConnectivityViaHttpProxy, checkConnectivityDirect };
