import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TitleBar from './components/TitleBar';
import TabBar from './components/TabBar';
import ConnectButton from './components/ConnectButton';
import KeyInput from './components/KeyInput';
import StatusInfo from './components/StatusInfo';
import DownloadScreen from './components/DownloadScreen';
import MapView from './components/MapView';
import IdentityView from './components/IdentityView';
import JellyfishCanvas from './components/JellyfishCanvas';
import TrafficView from './components/TrafficView';
import AboutView from './components/AboutView';
import './App.css';

const api = window.vpnAPI;

export default function App() {
  const [tab, setTab] = useState('connect');
  const [vlessKey, setVlessKey] = useState(() => localStorage.getItem('napasvpn_key') || '');
  const [state, setState] = useState('idle');
  const [error, setError] = useState('');
  const [serverInfo, setServerInfo] = useState(null);
  const [reconnectInfo, setReconnectInfo] = useState(null); // { attempt, max }

  // xray download state
  const [xrayReady, setXrayReady] = useState(false);
  const [dlPercent, setDlPercent] = useState(0);
  const [dlMessage, setDlMessage] = useState('');
  const [dlError, setDlError] = useState('');

  useEffect(() => {
    if (!api) { setXrayReady(true); return; }
    api.onDownloadProgress(({ percent, message }) => {
      setDlPercent(percent);
      setDlMessage(message);
    });
    api.onXrayReady(() => setXrayReady(true));
    api.onXrayError(({ error: e }) => setDlError(e));

    // Auto-reconnect events
    api.onReconnecting(({ attempt, max }) => {
      setState('connecting');
      setReconnectInfo({ attempt, max });
      setServerInfo(null);
    });
    api.onReconnected((result) => {
      setState('connected');
      setReconnectInfo(null);
      if (result) setServerInfo(result); // restore connection info panel
    });
    api.onReconnectFailed(() => {
      setState('error');
      setReconnectInfo(null);
      setError('Соединение потеряно. Авто-реконнект не удался.');
      setTimeout(() => setState('idle'), 5000);
    });
  }, []);

  useEffect(() => {
    if (!api) return;
    api.getStatus().then((s) => {
      if (s.connected) { setState('connected'); setServerInfo(s); }
    });
  }, []);

  const handleConnect = useCallback(async () => {
    if (!vlessKey.trim()) { setError('Вставьте VLESS-ключ'); return; }
    setError('');
    setState('connecting');
    const result = await api.connect(vlessKey.trim());
    if (result.success) {
      setState('connected');
      setServerInfo(result);
      localStorage.setItem('napasvpn_key', vlessKey.trim());
    } else {
      setState('error');
      setError(result.error || 'Ошибка подключения');
      setTimeout(() => setState('idle'), 5000);
    }
  }, [vlessKey]);

  const handleDisconnect = useCallback(async () => {
    setState('disconnecting');
    setReconnectInfo(null);
    await api.disconnect();
    setState('idle');
    setServerInfo(null);
  }, []);

  const isConnected = state === 'connected';
  const isBusy = state === 'connecting' || state === 'disconnecting';

  return (
    <div className="app">
      <TitleBar />

      <AnimatePresence>
        {!xrayReady && (
          <DownloadScreen percent={dlPercent} message={dlMessage} error={dlError} />
        )}
      </AnimatePresence>

      <TabBar active={tab} onChange={setTab} />

      <div className="tab-content">
        {/* ── VPN TAB ── */}
        <AnimatePresence mode="wait">
          {tab === 'connect' && (
            <motion.div
              key="connect"
              className="app-body"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {/* Jellyfish background */}
              <JellyfishCanvas width={380} height={500} />

              {/* Logo */}
              <motion.div
                className="logo-area"
                initial={{ opacity: 0, y: -16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <div className="logo-icon">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                    <path d="M16 2L4 7V15C4 22.2 9.2 28.8 16 30C22.8 28.8 28 22.2 28 15V7L16 2Z"
                      stroke="#c4956a" strokeWidth="1.5" fill="rgba(196,149,106,0.08)" strokeLinejoin="round" />
                    <path d="M10.5 16L14.5 20L21.5 13"
                      stroke="#c4956a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
                  </svg>
                </div>
                <span className="logo-text">NapasVPN</span>
              </motion.div>

              {/* Status badge */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={state}
                  className={`status-badge ${state}`}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.15 }}
                >
                  <span className="status-dot" />
                  <span className="status-text">
                    {state === 'idle'          && 'Отключено'}
                    {state === 'connecting'    && (reconnectInfo
                      ? `Реконнект ${reconnectInfo.attempt}/${reconnectInfo.max}...`
                      : 'Подключение...')}
                    {state === 'connected'     && 'Подключено'}
                    {state === 'disconnecting' && 'Отключение...'}
                    {state === 'error'         && 'Ошибка'}
                  </span>
                </motion.div>
              </AnimatePresence>

              <ConnectButton
                state={state}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
                disabled={isBusy}
              />

              <AnimatePresence>
                {isConnected && serverInfo && (
                  <StatusInfo serverInfo={serverInfo} vlessKey={vlessKey} />
                )}
              </AnimatePresence>

              <AnimatePresence>
                {!isConnected && (
                  <motion.div
                    className="key-section"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.25 }}
                  >
                    <KeyInput value={vlessKey} onChange={setVlessKey} />
                    <AnimatePresence>
                      {error && (
                        <motion.div
                          className="error-msg"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                        >
                          {error}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* ── TRAFFIC TAB ── */}
          {tab === 'traffic' && (
            <motion.div
              key="traffic"
              className="app-body no-pad"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <TrafficView isConnected={isConnected} />
            </motion.div>
          )}

          {/* ── MAP TAB ── */}
          {tab === 'map' && (
            <motion.div
              key="map"
              className="app-body no-pad"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <MapView isConnected={isConnected} />
            </motion.div>
          )}

          {/* ── IDENTITY TAB ── */}
          {tab === 'identity' && (
            <motion.div
              key="identity"
              className="app-body no-pad"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <IdentityView isConnected={isConnected} />
            </motion.div>
          )}

          {/* ── ABOUT TAB ── */}
          {tab === 'about' && (
            <motion.div
              key="about"
              className="app-body no-pad"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <AboutView />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="app-footer">
        <span>SOCKS5: 127.0.0.1:10808 &nbsp;|&nbsp; HTTP: 127.0.0.1:10809</span>
      </div>
    </div>
  );
}
