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
import GothicFigure from './components/GothicFigure';
import TrafficView from './components/TrafficView';
import AboutView from './components/AboutView';
import './App.css';

const api = window.vpnAPI;

function EyeOffIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M2 2L14 14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M6.2 6.3A2.2 2.2 0 0 0 9.6 9.5M4.2 4.4C2.7 5.3 1.6 6.6 1 8c1.3 2.7 4 4.5 7 4.5c1.2 0 2.3-0.3 3.3-0.8M12.5 11C13.7 10.1 14.5 9 15 8c-1.3-2.7-4-4.5-7-4.5c-0.5 0-1 0.05-1.5 0.15"
        stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M1 8c1.3-2.7 4-4.5 7-4.5s5.7 1.8 7 4.5c-1.3 2.7-4 4.5-7 4.5S2.3 10.7 1 8Z"
        stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none" />
      <circle cx="8" cy="8" r="2.1" stroke="currentColor" strokeWidth="1.3" fill="none" />
    </svg>
  );
}

export default function App() {
  const [tab, setTab] = useState('connect');
  const [vlessKey, setVlessKey] = useState(() => localStorage.getItem('napasvpn_key') || '');
  const [state, setState] = useState('idle');
  const [error, setError] = useState('');
  const [serverInfo, setServerInfo] = useState(null);
  const [reconnectInfo, setReconnectInfo] = useState(null); // { attempt, max }
  const [panelHidden, setPanelHidden] = useState(false); // hide data panel to reveal the figure
  const [warning, setWarning] = useState(''); // tunnel up but traffic probe failed

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
      if (result) { setServerInfo(result); setWarning(result.warning || ''); } // restore connection info panel
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
    if (!vlessKey.trim()) { setError('Вставьте ключ (vless:// / ss:// / ssconf://)'); return; }
    setError('');
    setWarning('');
    setState('connecting');
    const result = await api.connect(vlessKey.trim());
    if (result.success) {
      setState('connected');
      setServerInfo(result);
      if (result.warning) setWarning(result.warning);
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
    setWarning('');
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
              {/* Gothic figure — revealed when the tunnel is up */}
              <AnimatePresence>
                {isConnected && <GothicFigure />}
              </AnimatePresence>

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
                      stroke="#e8e8e8" strokeWidth="1.5" fill="rgba(255,255,255,0.05)" strokeLinejoin="round" />
                    <path d="M16 7.5V23" stroke="#e8e8e8" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
                    <path d="M10 12.5H22" stroke="#e8e8e8" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
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
                {isConnected && warning && (
                  <motion.div
                    className="warn-msg"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                  >
                    ⚠ {warning}
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {isConnected && serverInfo && (
                  <motion.div
                    key="status-wrap"
                    className="status-wrap"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.25 }}
                  >
                    <AnimatePresence>
                      {warning && (
                        <motion.div
                          className="warn-msg"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                        >
                          {warning}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <button
                      className="panel-toggle"
                      onClick={() => setPanelHidden(h => !h)}
                      title={panelHidden ? 'Показать данные' : 'Скрыть данные'}
                      aria-label={panelHidden ? 'Показать данные' : 'Скрыть данные'}
                    >
                      {panelHidden ? <EyeIcon /> : <EyeOffIcon />}
                      <span>{panelHidden ? 'Показать данные' : 'Скрыть данные'}</span>
                    </button>
                    <AnimatePresence>
                      {!panelHidden && (
                        <motion.div
                          key="status-info"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.25 }}
                          style={{ overflow: 'hidden', width: '100%' }}
                        >
                          <StatusInfo serverInfo={serverInfo} vlessKey={vlessKey} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
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
