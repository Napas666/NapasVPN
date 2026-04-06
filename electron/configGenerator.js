/**
 * Parses a VLESS URL and generates an xray-core config JSON.
 *
 * Example:
 * vless://UUID@host:port?type=tcp&security=reality&pbk=...&fp=chrome&sni=...&sid=...&flow=xtls-rprx-vision#name
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

  // host:port (handle IPv6 like [::1]:443)
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

  const params = {};
  queryString.split('&').forEach(pair => {
    const [k, v] = pair.split('=');
    if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
  });

  return { uuid, host, port, params };
}

function generateXrayConfig(vlessUrl, socksPort = 10808, httpPort = 10809) {
  const { uuid, host, port, params } = parseVlessUrl(vlessUrl);

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

  // Build stream settings based on security
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

  const config = {
    log: {
      loglevel: 'warning',
    },
    inbounds: [
      {
        tag: 'socks',
        port: socksPort,
        listen: '127.0.0.1',
        protocol: 'socks',
        settings: {
          udp: true,
          auth: 'noauth',
        },
      },
      {
        tag: 'http',
        port: httpPort,
        listen: '127.0.0.1',
        protocol: 'http',
        settings: {
          allowTransparent: false,
        },
      },
    ],
    outbounds: [
      {
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
      },
      {
        tag: 'direct',
        protocol: 'freedom',
        settings: {},
      },
      {
        tag: 'block',
        protocol: 'blackhole',
        settings: { response: { type: 'http' } },
      },
    ],
    routing: {
      domainStrategy: 'IPIfNonMatch',
      rules: [
        {
          type: 'field',
          ip: ['geoip:private'],
          outboundTag: 'direct',
        },
      ],
    },
  };

  return config;
}

module.exports = { parseVlessUrl, generateXrayConfig };
