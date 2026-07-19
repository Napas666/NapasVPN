import { useMemo } from 'react';
import { motion } from 'framer-motion';

function extractHost(vlessKey) {
  try {
    const withoutScheme = vlessKey.slice('vless://'.length);
    const atIdx = withoutScheme.indexOf('@');
    if (atIdx === -1) return '—';
    const rest = withoutScheme.slice(atIdx + 1);
    const qIdx = rest.indexOf('?');
    const hostPort = qIdx !== -1 ? rest.slice(0, qIdx) : rest;
    const lastColon = hostPort.lastIndexOf(':');
    return hostPort.slice(0, lastColon) || hostPort;
  } catch { return '—'; }
}

function extractParam(vlessKey, param) {
  try {
    const match = new RegExp(`[?&]${param}=([^&]+)`).exec(vlessKey);
    return match ? decodeURIComponent(match[1]) : '—';
  } catch { return '—'; }
}

export default function StatusInfo({ serverInfo, vlessKey }) {
  const isVless = (vlessKey || '').trim().startsWith('vless://');
  const resolvedServer = serverInfo?.server;
  const host = useMemo(
    () => (isVless ? extractHost(vlessKey) : resolvedServer?.host || '—'),
    [isVless, vlessKey, resolvedServer]
  );
  const sni  = useMemo(() => extractParam(vlessKey, 'sni'), [vlessKey]);
  const flow = useMemo(() => extractParam(vlessKey, 'flow'), [vlessKey]);

  return (
    <motion.div
      className="status-info"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.25 }}
    >
      <div className="info-row">
        <span className="info-label">Server</span>
        <span className="info-value">{host}</span>
      </div>
      <div className="info-divider" />
      {isVless ? (
        <>
          <div className="info-row">
            <span className="info-label">SNI</span>
            <span className="info-value">{sni}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Flow</span>
            <span className="info-value">{flow}</span>
          </div>
        </>
      ) : (
        <>
          <div className="info-row">
            <span className="info-label">Protocol</span>
            <span className="info-value">Shadowsocks</span>
          </div>
          {resolvedServer?.tag && (
            <div className="info-row">
              <span className="info-label">Location</span>
              <span className="info-value">{resolvedServer.tag}</span>
            </div>
          )}
        </>
      )}
      <div className="info-divider" />
      <div className="info-row">
        <span className="info-label">HTTP Proxy</span>
        <span className="info-value green">127.0.0.1:{serverInfo?.httpPort || 10809}</span>
      </div>
      <div className="info-row">
        <span className="info-label">SOCKS5</span>
        <span className="info-value green">127.0.0.1:{serverInfo?.socksPort || 10808}</span>
      </div>
    </motion.div>
  );
}
