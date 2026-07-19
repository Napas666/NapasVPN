/**
 * Parses access keys and generates an xray-core config JSON.
 *
 * Supported key formats:
 *  - vless://UUID@host:port?type=tcp&security=reality&pbk=...&fp=chrome&sni=...&sid=...&flow=xtls-rprx-vision#name
 *  - ss://base64(method:password)@host:port#name          (Shadowsocks SIP002)
 *  - ss://base64(method:password@host:port)#name          (Shadowsocks legacy)
 *  - ssconf://host/path  (Outline dynamic key: fetched over https,
 *                         returns JSON {server, server_port, method, password}
 *                         or an ss:// link)
 */

function parseVlessUrl(url) {
  if (!url.startsWith('vless://')) {
    throw new Error('Неверный формат: ключ должен начинаться с vless://');
  }

  // vless://UUID@host:port?params#name
  const withoutScheme = url.slice('vless://'.length);
  const hashIdx = withoutScheme.indexOf('#');
  const withoutHash = hashIdx !== -1 ? withoutScheme.slice(0, hashIdx) : withoutScheme;

  const atIdx = withoutHash.indexOf('@');
  if (atIdx === -1) throw new Error('Неверный формат: UUID не найден');

  const uuid = withoutHash.slice(0, atIdx);
  const rest = withoutHash.slice(atIdx + 1);

  const questionIdx = rest.indexOf('?');
  const hostPort = questionIdx !== -1 ? rest.slice(0, questionIdx) : rest;
  const queryString = questionIdx !== -1 ? rest.slice(questionIdx + 1) : '';

  const { host, port } = splitHostPort(hostPort);

  const params = {};
  queryString.split('&').forEach(pair => {
    const [k, v] = pair.split('=');
    if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
  });

  return { uuid, host, port, params };
}

// host:port (handle IPv6 like [::1]:443)
function splitHostPort(hostPort) {
  let host, port;
  if (hostPort.startsWith('[')) {
    const closeBracket = hostPort.indexOf(']');
    host = hostPort.slice(1, closeBracket);
    port = parseInt(hostPort.slice(closeBracket + 2), 10);
  } else {
    const lastColon = hostPort.lastIndexOf(':');
    host = hostPort.slice(0, lastColon);
    port = parseInt(hostPort.slice(lastColon + 1), 10);
  }
  if (!host || !Number.isFinite(port)) {
    throw new Error(`Неверный адрес сервера: «${hostPort}»`);
  }
  return { host, port };
}

function base64Decode(str) {
  // tolerate base64url and missing padding
  const normalized = str.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64').toString('utf-8');
}

function parseSsUrl(url) {
  if (!url.startsWith('ss://')) {
    throw new Error('Неверный формат: ключ должен начинаться с ss://');
  }

  let s = url.slice('ss://'.length);
  let tag = '';
  const hashIdx = s.indexOf('#');
  if (hashIdx !== -1) {
    tag = decodeURIComponent(s.slice(hashIdx + 1));
    s = s.slice(0, hashIdx);
  }

  let method, password, host, port;
  const atIdx = s.lastIndexOf('@');

  if (atIdx !== -1) {
    // SIP002: userinfo@host:port, userinfo = base64(method:password) or plain
    let userinfo = s.slice(0, atIdx);
    let decoded = base64Decode(userinfo);
    if (!decoded.includes(':')) decoded = decodeURIComponent(userinfo);
    const colonIdx = decoded.indexOf(':');
    if (colonIdx === -1) throw new Error('Неверный ss://-ключ: не удалось извлечь метод и пароль');
    method = decoded.slice(0, colonIdx);
    password = decoded.slice(colonIdx + 1);
    ({ host, port } = splitHostPort(s.slice(atIdx + 1)));
  } else {
    // legacy: всё тело — base64(method:password@host:port)
    const decoded = base64Decode(s);
    const at2 = decoded.lastIndexOf('@');
    if (at2 === -1) throw new Error('Неверный ss://-ключ');
    const colonIdx = decoded.indexOf(':');
    method = decoded.slice(0, colonIdx);
    password = decoded.slice(colonIdx + 1, at2);
    ({ host, port } = splitHostPort(decoded.slice(at2 + 1)));
  }

  return { method, password, host, port, tag };
}

async function fetchText(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    if (!res.ok) throw new Error(`сервер ключей ответил ${res.status}`);
    return await res.text();
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('таймаут запроса к серверу ключей');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Normalizes any supported key into a descriptor:
 *  { kind: 'vless', uuid, host, port, params }
 *  { kind: 'shadowsocks', method, password, host, port, tag }
 */
async function resolveKey(key) {
  key = key.trim();

  if (key.startsWith('vless://')) {
    return { kind: 'vless', ...parseVlessUrl(key) };
  }

  if (key.startsWith('ss://')) {
    return { kind: 'shadowsocks', ...parseSsUrl(key) };
  }

  if (key.startsWith('ssconf://')) {
    const httpsUrl = 'https://' + key.slice('ssconf://'.length);
    let body;
    try {
      body = (await fetchText(httpsUrl)).trim();
    } catch (err) {
      throw new Error(`Не удалось получить конфиг по ssconf-ссылке:\n${err.message}`);
    }

    if (body.startsWith('ss://')) {
      return { kind: 'shadowsocks', ...parseSsUrl(body.split(/\s/)[0]) };
    }

    let json;
    try {
      json = JSON.parse(body);
    } catch {
      throw new Error('ssconf-сервер вернул неизвестный формат (не JSON и не ss://)');
    }
    if (!json.server || !json.server_port || !json.method || !json.password) {
      throw new Error('В ssconf-конфиге нет server/server_port/method/password');
    }
    return {
      kind: 'shadowsocks',
      host: String(json.server),
      port: parseInt(json.server_port, 10),
      method: json.method,
      password: json.password,
      // Outline "prefix" — маскирует начало соединения под TLS (обход DPI).
      // xray его не поддерживает, поэтому такие ключи гоним через napas-ss-proxy.
      prefix: typeof json.prefix === 'string' ? json.prefix : '',
      tag: json.tag || '',
    };
  }

  throw new Error('Неизвестный формат ключа.\nПоддерживаются: vless://, ss://, ssconf://');
}

function buildProxyOutbound(resolved) {
  if (resolved.kind === 'shadowsocks') {
    return {
      tag: 'proxy',
      protocol: 'shadowsocks',
      settings: {
        servers: [
          {
            address: resolved.host,
            port: resolved.port,
            method: resolved.method,
            password: resolved.password,
          },
        ],
      },
      streamSettings: { network: 'tcp' },
    };
  }

  // vless
  const { uuid, host, port, params } = resolved;
  const {
    type = 'tcp',
    security = 'none',
    pbk = '',
    fp = 'chrome',
    sni = '',
    sid = '',
    spx = '/',
    flow = '',
    // mux is intentionally ignored — incompatible with xtls-rprx-vision
  } = params;

  const streamSettings = {
    network: type,
  };

  if (security === 'reality') {
    streamSettings.security = 'reality';
    streamSettings.realitySettings = {
      serverName: sni,
      fingerprint: fp,
      show: false,
      publicKey: pbk,
      shortId: sid,
      spiderX: spx,
    };
  } else if (security === 'tls') {
    streamSettings.security = 'tls';
    streamSettings.tlsSettings = {
      serverName: sni,
      allowInsecure: params.allowInsecure === '1',
    };
  }

  const user = {
    id: uuid,
    encryption: 'none',
  };
  if (flow) user.flow = flow;

  return {
    tag: 'proxy',
    protocol: 'vless',
    settings: {
      vnext: [
        {
          address: host,
          port: port,
          users: [user],
        },
      ],
    },
    streamSettings,
  };
}

/**
 * Resolves the key (fetching ssconf if needed) and builds the full xray config.
 * Returns { config, server: { host, port, protocol, tag } }.
 */
/**
 * A socks outbound that points xray at a local helper (used for Outline
 * shadowsocks keys with a prefix, which xray can't speak directly).
 */
function socksOutbound(host, port) {
  return {
    tag: 'proxy',
    protocol: 'socks',
    settings: {
      servers: [{ address: host, port }],
    },
  };
}

/** Wraps a proxy outbound in the standard inbounds/routing xray config. */
function buildConfig(proxyOutbound, socksPort = 10808, httpPort = 10809) {
  return {
    log: { loglevel: 'warning' },
    inbounds: [
      {
        tag: 'socks',
        port: socksPort,
        listen: '127.0.0.1',
        protocol: 'socks',
        settings: { udp: true, auth: 'noauth' },
      },
      {
        tag: 'http',
        port: httpPort,
        listen: '127.0.0.1',
        protocol: 'http',
        settings: { allowTransparent: false },
      },
    ],
    outbounds: [
      proxyOutbound,
      { tag: 'direct', protocol: 'freedom', settings: {} },
      { tag: 'block', protocol: 'blackhole', settings: { response: { type: 'http' } } },
    ],
    routing: {
      domainStrategy: 'IPIfNonMatch',
      rules: [{ type: 'field', ip: ['geoip:private'], outboundTag: 'direct' }],
    },
  };
}

async function generateXrayConfig(key, socksPort = 10808, httpPort = 10809) {
  const resolved = await resolveKey(key);
  const config = buildConfig(buildProxyOutbound(resolved), socksPort, httpPort);

  const server = {
    host: resolved.host,
    port: resolved.port,
    protocol: resolved.kind,
    tag: resolved.tag || '',
    prefix: resolved.prefix || '',
  };

  return { config, server };
}

module.exports = {
  parseVlessUrl, parseSsUrl, resolveKey,
  generateXrayConfig, buildConfig, buildProxyOutbound, socksOutbound,
};
