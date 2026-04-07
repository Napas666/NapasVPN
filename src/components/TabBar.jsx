import { motion } from 'framer-motion';

const TABS = [
  { id: 'connect',  label: 'VPN',      icon: '⚡' },
  { id: 'traffic',  label: 'Traffic',  icon: '📡' },
  { id: 'map',      label: 'Location', icon: '🌍' },
  { id: 'identity', label: 'Identity', icon: '🕵️' },
];

export default function TabBar({ active, onChange }) {
  return (
    <div className="tabbar">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          className={`tabbar-btn ${active === tab.id ? 'active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {active === tab.id && (
            <motion.div
              className="tabbar-indicator"
              layoutId="tab-indicator"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <span className="tabbar-icon">{tab.icon}</span>
          <span className="tabbar-label">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
