import { motion } from 'framer-motion';

// ── SVG icons matching the glassmorphism dark+red style ──────────────────────

function ShieldIcon() {
  return (
    <svg width="17" height="19" viewBox="0 0 17 19" fill="none">
      {/* Shield body */}
      <path
        d="M8.5 1L1.5 4.2V9.5C1.5 14.2 4.6 17.8 8.5 19C12.4 17.8 15.5 14.2 15.5 9.5V4.2L8.5 1Z"
        fill="rgba(8,2,2,0.92)"
        stroke="currentColor"
        strokeWidth="0.7"
        strokeOpacity="0.45"
        strokeLinejoin="round"
      />
      {/* Ambient glow around dot */}
      <circle cx="5.8" cy="6" r="3.2" fill="rgba(180,20,20,0.22)" />
      {/* Red dot outer ring */}
      <circle cx="5.8" cy="6" r="2.1" fill="rgba(180,20,20,0.55)" />
      {/* Red dot core */}
      <circle cx="5.8" cy="6" r="1.3" fill="#cc2525" />
      {/* Specular highlight */}
      <circle cx="5.2" cy="5.4" r="0.5" fill="rgba(255,140,120,0.55)" />
    </svg>
  );
}

function ServerIcon() {
  return (
    <svg width="18" height="15" viewBox="0 0 18 15" fill="none">
      {/* Server bar 1 */}
      <rect x="0.5" y="0.5" width="17" height="6" rx="1.5"
        fill="rgba(8,2,2,0.92)" stroke="currentColor" strokeWidth="0.7" strokeOpacity="0.4" />
      {/* LED glow */}
      <circle cx="4" cy="3.5" r="2" fill="rgba(180,20,20,0.25)" />
      <circle cx="4" cy="3.5" r="1.3" fill="rgba(180,20,20,0.6)" />
      <circle cx="4" cy="3.5" r="0.8" fill="#cc2525" />
      <circle cx="3.6" cy="3.1" r="0.3" fill="rgba(255,140,120,0.5)" />
      {/* Detail lines */}
      <rect x="8" y="2.3" width="7" height="0.9" rx="0.45" fill="rgba(140,25,25,0.4)" />
      <rect x="8" y="4" width="4.5" height="0.9" rx="0.45" fill="rgba(140,25,25,0.22)" />

      {/* Server bar 2 */}
      <rect x="0.5" y="8.5" width="17" height="6" rx="1.5"
        fill="rgba(8,2,2,0.92)" stroke="currentColor" strokeWidth="0.7" strokeOpacity="0.4" />
      <circle cx="4" cy="11.5" r="2" fill="rgba(180,20,20,0.25)" />
      <circle cx="4" cy="11.5" r="1.3" fill="rgba(180,20,20,0.6)" />
      <circle cx="4" cy="11.5" r="0.8" fill="#cc2525" />
      <circle cx="3.6" cy="11.1" r="0.3" fill="rgba(255,140,120,0.5)" />
      <rect x="8" y="10.3" width="7" height="0.9" rx="0.45" fill="rgba(140,25,25,0.4)" />
      <rect x="8" y="12" width="4.5" height="0.9" rx="0.45" fill="rgba(140,25,25,0.22)" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="14" height="20" viewBox="0 0 14 20" fill="none">
      {/* Pin drop body */}
      <path
        d="M7 0.5C3.4 0.5 0.5 3.5 0.5 7.2C0.5 11.8 7 19.5 7 19.5C7 19.5 13.5 11.8 13.5 7.2C13.5 3.5 10.6 0.5 7 0.5Z"
        fill="rgba(8,2,2,0.88)"
        stroke="currentColor"
        strokeWidth="0.7"
        strokeOpacity="0.45"
      />
      {/* Specular highlight top-left */}
      <path
        d="M3 2.5C2 3.5 1.5 4.8 1.5 6"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Ambient glow */}
      <circle cx="7" cy="7.2" r="3.5" fill="rgba(180,20,20,0.25)" />
      {/* Red center */}
      <circle cx="7" cy="7.2" r="2.4" fill="rgba(180,20,20,0.65)" />
      <circle cx="7" cy="7.2" r="1.4" fill="#cc2525" />
      {/* Specular */}
      <circle cx="6.3" cy="6.5" r="0.5" fill="rgba(255,140,120,0.55)" />
    </svg>
  );
}

function FingerprintIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      {/* Outer bubble */}
      <circle cx="9" cy="9" r="8.5"
        fill="rgba(8,2,2,0.9)"
        stroke="currentColor"
        strokeWidth="0.7"
        strokeOpacity="0.35"
      />
      {/* Specular top-left arc */}
      <path d="M3 4C4.5 2.2 6.6 1.2 9 1.2"
        stroke="rgba(255,255,255,0.07)" strokeWidth="1.5" strokeLinecap="round" fill="none" />

      {/* Fingerprint ridges — outer → inner */}
      <path d="M9 3.5C5.4 3.5 2.5 6.4 2.5 10"
        stroke="#c02020" strokeWidth="1.0" strokeLinecap="round" fill="none" opacity="0.8" />
      <path d="M9 5.2C6.4 5.2 4.3 7.3 4.3 10"
        stroke="#c02020" strokeWidth="1.0" strokeLinecap="round" fill="none" opacity="0.75" />
      <path d="M9 6.8C7.2 6.8 5.8 8.2 5.8 10"
        stroke="#c02020" strokeWidth="1.0" strokeLinecap="round" fill="none" opacity="0.7" />

      {/* Center dot */}
      <circle cx="9" cy="9.5" r="1.2" fill="#cc2525" />
      <circle cx="8.5" cy="9" r="0.45" fill="rgba(255,140,120,0.5)" />

      {/* Right-side arcs */}
      <path d="M13.7 10C13.7 7.3 11.6 5.2 9 5.2"
        stroke="#c02020" strokeWidth="1.0" strokeLinecap="round" fill="none" opacity="0.75" />
      <path d="M15.5 10C15.5 6.4 12.6 3.5 9 3.5"
        stroke="#c02020" strokeWidth="1.0" strokeLinecap="round" fill="none" opacity="0.8" />

      {/* Bottom arcs */}
      <path d="M2.5 11.5C3.3 14.5 5.9 16.5 9 16.5"
        stroke="#c02020" strokeWidth="1.0" strokeLinecap="round" fill="none" opacity="0.7" />
      <path d="M4.3 12C5 14 6.8 15.2 9 15.2"
        stroke="#c02020" strokeWidth="1.0" strokeLinecap="round" fill="none" opacity="0.6" />
      <path d="M13.7 12C13 14 11.2 15.2 9 15.2"
        stroke="#c02020" strokeWidth="1.0" strokeLinecap="round" fill="none" opacity="0.6" />
      <path d="M15.5 11.5C14.7 14.5 12.1 16.5 9 16.5"
        stroke="#c02020" strokeWidth="1.0" strokeLinecap="round" fill="none" opacity="0.7" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'connect',  label: 'VPN',      Icon: ShieldIcon },
  { id: 'traffic',  label: 'Traffic',  Icon: ServerIcon },
  { id: 'map',      label: 'Location', Icon: PinIcon },
  { id: 'identity', label: 'Identity', Icon: FingerprintIcon },
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
          <span className="tabbar-icon">
            <tab.Icon />
          </span>
          <span className="tabbar-label">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
