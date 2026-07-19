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
        animate={{ filter: ['drop-shadow(0 0 8px rgba(255,255,255,0.25))', 'drop-shadow(0 0 20px rgba(255,255,255,0.55))', 'drop-shadow(0 0 8px rgba(255,255,255,0.25))'] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
          <path
            d="M28 4L7 13V27C7 38.9 16.1 49.8 28 52C39.9 49.8 49 38.9 49 27V13L28 4Z"
            stroke="#e8e8e8"
            strokeWidth="1.5"
            fill="rgba(255,255,255,0.04)"
            strokeLinejoin="round"
          />
          <path d="M28 13V42" stroke="#e8e8e8" strokeWidth="2" strokeLinecap="round" opacity="0.55" />
          <path d="M17.5 22.5H38.5" stroke="#e8e8e8" strokeWidth="2" strokeLinecap="round" opacity="0.55" />
        </svg>
      </motion.div>

      <div className="dl-title">Napas VPN</div>

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
