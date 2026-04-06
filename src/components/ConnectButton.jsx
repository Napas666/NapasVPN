import { motion } from 'framer-motion';

// Shield icon for idle/error, checkmark for connected, spinner for busy
function ShieldIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <path
        d="M16 3L5 7.5V15C5 21.5 9.8 27.6 16 29C22.2 27.6 27 21.5 27 15V7.5L16 3Z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinejoin="round"
      />
      <path
        d="M11 16L14.5 19.5L21 13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.5"
      />
    </svg>
  );
}

function CheckShieldIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <path
        d="M16 3L5 7.5V15C5 21.5 9.8 27.6 16 29C22.2 27.6 27 21.5 27 15V7.5L16 3Z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="rgba(95,168,110,0.12)"
        strokeLinejoin="round"
      />
      <path
        d="M11 16L14.5 19.5L21 13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const LABELS = {
  idle:          'CONNECT',
  connecting:    'WAIT...',
  connected:     'DISCONNECT',
  disconnecting: 'WAIT...',
  error:         'RETRY',
};

export default function ConnectButton({ state, onConnect, onDisconnect, disabled }) {
  const isConnected = state === 'connected';
  const isBusy = state === 'connecting' || state === 'disconnecting';

  const handleClick = () => {
    if (disabled) return;
    if (isConnected) onDisconnect();
    else onConnect();
  };

  return (
    <div className="connect-btn-wrap">
      <div
        className={`connect-btn-ring ${isBusy ? 'active' : isConnected ? 'connected' : ''}`}
      />

      <motion.button
        className={`connect-btn ${state}`}
        onClick={handleClick}
        disabled={disabled}
        whileTap={disabled ? {} : { scale: 0.96, y: 3 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      >
        <span className="connect-btn-icon">
          {isBusy ? (
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
              style={{ display: 'inline-block' }}
            >
              <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
                <circle cx="15" cy="15" r="11" stroke="currentColor" strokeWidth="1.5" strokeDasharray="20 50" strokeLinecap="round" opacity="0.5" />
              </svg>
            </motion.span>
          ) : isConnected ? (
            <CheckShieldIcon />
          ) : (
            <ShieldIcon />
          )}
        </span>
        <span className="connect-btn-label">{LABELS[state] || 'CONNECT'}</span>
      </motion.button>
    </div>
  );
}
