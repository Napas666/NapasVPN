import { motion } from 'framer-motion';

/* Gothic monochrome icon set — stroke-only, inherits currentColor */

function ShieldCrossIcon() {
  return (
    <svg width="18" height="19" viewBox="0 0 18 19" fill="none">
      <path d="M9 1L1.5 4.2V9.5C1.5 14.2 4.9 17.8 9 19C13.1 17.8 16.5 14.2 16.5 9.5V4.2L9 1Z"
        stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round" />
      <path d="M9 4.5V13.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M5.8 7.5H12.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function TowerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M4 17V6H14V17" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M4 6V3.5H6V5H8V3.5H10V5H12V3.5H14V6" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M9 17V12.5C9 11.4 8.1 10.5 7 10.5C8.1 10.5 9 9.6 9 8.5C9 9.6 9.9 10.5 11 10.5C9.9 10.5 9 11.4 9 12.5"
        stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 17H16" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function SpirePinIcon() {
  return (
    <svg width="14" height="20" viewBox="0 0 14 20" fill="none">
      <path d="M7 0.8C3.4 0.8 0.8 3.6 0.8 7.2C0.8 11.6 7 19.2 7 19.2C7 19.2 13.2 11.6 13.2 7.2C13.2 3.6 10.6 0.8 7 0.8Z"
        stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round" />
      <path d="M7 3.6L4.4 7.2L7 10.8L9.6 7.2L7 3.6Z"
        stroke="currentColor" strokeWidth="1.1" fill="none" strokeLinejoin="round" />
    </svg>
  );
}

function SkullIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M9 1.5C5.1 1.5 2.5 4.3 2.5 8C2.5 10.2 3.5 11.7 4.8 12.7V15.5H6.6V13.8H8.1V15.5H9.9V13.8H11.4V15.5H13.2V12.7C14.5 11.7 15.5 10.2 15.5 8C15.5 4.3 12.9 1.5 9 1.5Z"
        stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round" />
      <circle cx="6.3" cy="8" r="1.5" stroke="currentColor" strokeWidth="1.1" fill="none" />
      <circle cx="11.7" cy="8" r="1.5" stroke="currentColor" strokeWidth="1.1" fill="none" />
      <path d="M9 9.6L8.2 11.3H9.8L9 9.6Z" stroke="currentColor" strokeWidth="0.9" strokeLinejoin="round" />
    </svg>
  );
}

function GrimoireIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M3.5 2.5H12.5C13.6 2.5 14.5 3.4 14.5 4.5V15.5H5.5C4.4 15.5 3.5 14.6 3.5 13.5V2.5Z"
        stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round" />
      <path d="M3.5 13.5C3.5 12.4 4.4 11.5 5.5 11.5H14.5" stroke="currentColor" strokeWidth="1.1" />
      <path d="M9 4.8V9" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M7.2 6.4H10.8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

const TABS = [
  { id: 'connect',  label: 'VPN',      Icon: ShieldCrossIcon },
  { id: 'traffic',  label: 'Traffic',  Icon: TowerIcon },
  { id: 'map',      label: 'Location', Icon: SpirePinIcon },
  { id: 'identity', label: 'Identity', Icon: SkullIcon },
  { id: 'about',    label: 'Security', Icon: GrimoireIcon },
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
          <span className="tabbar-icon"><tab.Icon /></span>
          <span className="tabbar-label">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
