import { motion } from 'framer-motion';

export default function DownloadScreen({ percent, message, error }) {
  return (
    <motion.div
      className="download-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Logo */}
      <motion.div
        className="dl-logo"
        animate={{ filter: ['drop-shadow(0 0 8px rgba(196,149,106,0.3))', 'drop-shadow(0 0 20px rgba(196,149,106,0.6))', 'drop-shadow(0 0 8px rgba(196,149,106,0.3))'] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
          <path
            d="M28 4L7 13V27C7 38.9 16.1 49.8 28 52C39.9 49.8 49 38.9 49 27V13L28 4Z"
            stroke="#c4956a"
            strokeWidth="1.5"
            fill="rgba(196,149,106,0.06)"
            strokeLinejoin="round"
          />
          <path
            d="M18 28L24.5 34.5L38 22"
            stroke="#c4956a"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.5"
          />
        </svg>
      </motion.div>

      <div className="dl-title">NAPAS VPN</div>

      {error ? (
        <div className="dl-error">{error}</div>
      ) : (
        <>
          <div className="dl-message">{message || 'Инициализация…'}</div>

          <div className="dl-bar-wrap">
            <motion.div
              className="dl-bar-fill"
              initial={{ width: 0 }}
              animate={{ width: `${percent || 0}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>

          <div className="dl-percent">{percent || 0}%</div>

          <div className="dl-hint">
            Загружается движок xray-core<br />
            Только при первом запуске
          </div>
        </>
      )}
    </motion.div>
  );
}
