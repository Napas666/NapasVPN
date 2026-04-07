import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Encryption animation canvas ──────────────────────────────────────────────
function EncryptionCanvas({ isConnected, width = 340, height = 180 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let raf;
    let t = 0;

    // Particles: raw data → encryption core → encrypted output
    const particles = Array.from({ length: 28 }, (_, i) => ({
      id: i,
      x: Math.random() * width * 0.28,
      y: height * 0.2 + Math.random() * height * 0.6,
      speed: 0.6 + Math.random() * 1.0,
      size: 2 + Math.random() * 2.5,
      phase: Math.random() * Math.PI * 2,
      encrypted: false,
      alpha: 0.5 + Math.random() * 0.5,
      char: String.fromCharCode(0x30 + Math.floor(Math.random() * 70)),
    }));

    // Falling matrix chars on right side
    const matrixCols = Math.floor(width * 0.3 / 10);
    const matrixDrops = Array.from({ length: matrixCols }, () => Math.random() * height / 14);

    function drawGauge(ctx, cx, cy, r, value, label) {
      const startAngle = Math.PI * 0.75;
      const endAngle   = Math.PI * 2.25;
      const filled     = startAngle + (endAngle - startAngle) * value;

      // Background arc
      ctx.beginPath();
      ctx.arc(cx, cy, r, startAngle, endAngle);
      ctx.strokeStyle = 'rgba(180,20,20,0.15)';
      ctx.lineWidth = 5;
      ctx.stroke();

      // Filled arc with glow
      ctx.beginPath();
      ctx.arc(cx, cy, r, startAngle, filled);
      const grad = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
      grad.addColorStop(0, 'rgba(180,0,0,0.8)');
      grad.addColorStop(1, 'rgba(255,60,40,1)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 5;
      ctx.shadowColor = 'rgba(255,30,20,0.7)';
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Tick marks
      for (let i = 0; i <= 10; i++) {
        const angle = startAngle + (endAngle - startAngle) * (i / 10);
        const inner = i % 5 === 0 ? r - 10 : r - 6;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
        ctx.lineTo(cx + Math.cos(angle) * (r + 2), cy + Math.sin(angle) * (r + 2));
        ctx.strokeStyle = i % 5 === 0 ? 'rgba(255,60,40,0.6)' : 'rgba(180,20,20,0.3)';
        ctx.lineWidth = i % 5 === 0 ? 1.5 : 0.8;
        ctx.stroke();
      }

      // Center value
      ctx.fillStyle = '#ff4030';
      ctx.font = `bold ${r * 0.42}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(255,30,20,0.5)';
      ctx.shadowBlur = 8;
      ctx.fillText(Math.round(value * 100) + '%', cx, cy - 4);
      ctx.shadowBlur = 0;

      ctx.fillStyle = 'rgba(200,100,80,0.6)';
      ctx.font = `600 ${r * 0.22}px Inter,sans-serif`;
      ctx.fillText(label, cx, cy + r * 0.35);
    }

    function render() {
      t += 0.018;
      ctx.clearRect(0, 0, width, height);

      // ── Background grid ──────────────────────────────────
      ctx.strokeStyle = 'rgba(180,20,20,0.06)';
      ctx.lineWidth = 0.5;
      for (let x = 0; x < width; x += 20) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
      }
      for (let y = 0; y < height; y += 20) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
      }

      const coreX = width * 0.48;
      const coreY = height * 0.5;
      const coreR = 28;

      // ── Encryption core rings ────────────────────────────
      for (let ring = 3; ring >= 1; ring--) {
        const rr = coreR + ring * 14;
        const alpha = 0.06 + ring * 0.04;
        ctx.beginPath();
        ctx.arc(coreX, coreY, rr, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(220,30,20,${alpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Rotating dashes on ring
        const dashCount = 6 + ring * 4;
        for (let d = 0; d < dashCount; d++) {
          const angle = (d / dashCount) * Math.PI * 2 + t * (ring % 2 === 0 ? 0.4 : -0.3) * ring;
          const dx = coreX + Math.cos(angle) * rr;
          const dy = coreY + Math.sin(angle) * rr;
          ctx.beginPath();
          ctx.arc(dx, dy, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,60,40,${0.3 + ring * 0.1})`;
          ctx.fill();
        }
      }

      // ── Core glow ────────────────────────────────────────
      const coreGlow = ctx.createRadialGradient(coreX, coreY, 0, coreX, coreY, coreR * 1.5);
      coreGlow.addColorStop(0,   'rgba(255,40,20,0.25)');
      coreGlow.addColorStop(0.5, 'rgba(180,10,5,0.12)');
      coreGlow.addColorStop(1,   'transparent');
      ctx.beginPath();
      ctx.arc(coreX, coreY, coreR * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = coreGlow;
      ctx.fill();

      // Core body
      const coreBody = ctx.createRadialGradient(coreX - 6, coreY - 6, 2, coreX, coreY, coreR);
      coreBody.addColorStop(0,   'rgba(255,80,60,0.9)');
      coreBody.addColorStop(0.4, 'rgba(200,20,10,0.7)');
      coreBody.addColorStop(1,   'rgba(100,0,0,0.5)');
      ctx.beginPath();
      ctx.arc(coreX, coreY, coreR, 0, Math.PI * 2);
      ctx.fillStyle = coreBody;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,80,60,0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Lock icon in center
      ctx.fillStyle = 'rgba(255,200,180,0.9)';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isConnected ? '🔒' : '🔓', coreX, coreY);

      // ── Left zone label ──────────────────────────────────
      ctx.fillStyle = 'rgba(200,80,60,0.4)';
      ctx.font = '600 8px Inter,sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('RAW DATA', width * 0.13, 12);

      // ── Right zone label ─────────────────────────────────
      ctx.fillStyle = 'rgba(80,200,100,0.4)';
      ctx.fillText('ENCRYPTED', width * 0.83, 12);

      // ── Separator lines ──────────────────────────────────
      const leftLine  = width * 0.3;
      const rightLine = width * 0.66;

      ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(leftLine,  0); ctx.lineTo(leftLine,  height);
      ctx.strokeStyle = 'rgba(180,20,20,0.2)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(rightLine, 0); ctx.lineTo(rightLine, height);
      ctx.stroke();
      ctx.setLineDash([]);

      // ── Particles ────────────────────────────────────────
      particles.forEach(p => {
        p.x += p.speed * (isConnected ? 1 : 0.3);
        if (p.x > width + 10) {
          p.x = -10;
          p.y = height * 0.15 + Math.random() * height * 0.7;
          p.char = String.fromCharCode(0x30 + Math.floor(Math.random() * 70));
        }

        // Wobble vertically
        const wy = p.y + Math.sin(t * 2 + p.phase) * 4;

        const inCore = Math.hypot(p.x - coreX, wy - coreY) < coreR + 8;
        const encrypted = p.x > rightLine;

        // Color based on zone
        let color;
        if (encrypted) {
          const pulse = 0.5 + Math.sin(t * 3 + p.phase) * 0.3;
          color = `rgba(60,220,100,${pulse * p.alpha})`;
        } else if (inCore) {
          color = `rgba(255,200,100,${p.alpha * 0.8})`;
        } else {
          color = `rgba(255,${60 + Math.sin(t + p.phase) * 20},40,${p.alpha * 0.7})`;
        }

        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = encrypted ? 6 : 3;

        // Encrypted particles show hex chars
        if (encrypted) {
          ctx.font = `bold ${p.size * 3.5}px monospace`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(p.char, p.x, wy);
        } else {
          ctx.beginPath();
          ctx.arc(p.x, wy, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.shadowBlur = 0;
      });

      // ── Matrix rain on far right ─────────────────────────
      const matX0 = width * 0.76;
      ctx.font = '9px monospace';
      ctx.textAlign = 'left';
      matrixDrops.forEach((drop, i) => {
        const char = String.fromCharCode(0x30 + Math.floor(Math.random() * 70));
        const alpha = isConnected ? 0.35 : 0.08;
        ctx.fillStyle = `rgba(60,220,80,${alpha})`;
        ctx.fillText(char, matX0 + i * 10, drop * 14);
        matrixDrops[i] = drop > height / 14 + Math.random() * 5 ? 0 : drop + 0.25;
      });

      // ── Gauge (right side) ───────────────────────────────
      const gaugeVal = isConnected
        ? 0.72 + Math.sin(t * 0.5) * 0.04
        : 0.05 + Math.sin(t * 0.3) * 0.02;
      drawGauge(ctx, width * 0.855, height * 0.55, 24, gaugeVal, 'AES-256');

      raf = requestAnimationFrame(render);
    }

    render();
    return () => cancelAnimationFrame(raf);
  }, [isConnected, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ width: '100%', height: height, display: 'block', borderRadius: 10 }}
    />
  );
}

// ── Live speed graph ─────────────────────────────────────────────────────────
function SpeedGraph({ points, color, label, max }) {
  if (!points || points.length < 2) return null;
  const W = 160, H = 48;
  const pts = points.slice(-30);
  const realMax = max || Math.max(...pts, 1);

  const d = pts.map((v, i) => {
    const x = (i / (pts.length - 1)) * W;
    const y = H - (v / realMax) * H * 0.85 - 4;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const fill = pts.map((v, i) => {
    const x = (i / (pts.length - 1)) * W;
    const y = H - (v / realMax) * H * 0.85 - 4;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const fillPath = `M${fill[0]} L${fill.join(' L')} L${W},${H} L0,${H} Z`;

  return (
    <div className="speed-graph-wrap">
      <div className="speed-graph-label">{label}</div>
      <div className="speed-graph-val" style={{ color }}>
        {formatSpeed(pts[pts.length - 1] || 0)}
      </div>
      <svg width={W} height={H} style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={fillPath} fill={`url(#grad-${label})`} />
        <path d={d} fill="none" stroke={color} strokeWidth="1.5"
          style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
        {/* Last point dot */}
        {pts.length > 0 && (() => {
          const lx = W;
          const ly = H - (pts[pts.length - 1] / realMax) * H * 0.85 - 4;
          return <circle cx={lx} cy={ly} r="3" fill={color}
            style={{ filter: `drop-shadow(0 0 5px ${color})` }} />;
        })()}
      </svg>
    </div>
  );
}

function formatSpeed(bps) {
  if (bps >= 1024 * 1024) return (bps / 1024 / 1024).toFixed(1) + ' MB/s';
  if (bps >= 1024)        return (bps / 1024).toFixed(1) + ' KB/s';
  return bps.toFixed(0) + ' B/s';
}

function formatBytes(bytes) {
  if (bytes >= 1024 ** 3) return (bytes / 1024 ** 3).toFixed(2) + ' GB';
  if (bytes >= 1024 ** 2) return (bytes / 1024 ** 2).toFixed(1) + ' MB';
  if (bytes >= 1024)      return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
}

const api = window.vpnAPI;

function pingColor(ms) {
  if (ms < 0)   return 'var(--muted)';
  if (ms < 80)  return '#22c55e';
  if (ms < 160) return '#f59e0b';
  return '#ff4030';
}
function pingLabel(ms) {
  if (ms < 0)   return '—';
  if (ms < 80)  return 'Отлично';
  if (ms < 160) return 'Хорошо';
  return 'Высокий';
}

// ── Main TrafficView ─────────────────────────────────────────────────────────
export default function TrafficView({ isConnected }) {
  const [upPoints,   setUpPoints]   = useState(Array(30).fill(0));
  const [downPoints, setDownPoints] = useState(Array(30).fill(0));
  const [totalUp,    setTotalUp]    = useState(0);
  const [totalDown,  setTotalDown]  = useState(0);
  const [uptime,     setUptime]     = useState(0);
  const [startTime]                 = useState(Date.now());
  const [ping,       setPing]       = useState(-1);

  // Live ping to VPN server every 3s
  useEffect(() => {
    if (!isConnected || !api) { setPing(-1); return; }
    const measure = () => api.ping().then((r) => setPing(r.ok ? r.ms : -1)).catch(() => setPing(-1));
    measure();
    const id = setInterval(measure, 3000);
    return () => clearInterval(id);
  }, [isConnected]);

  // Simulate traffic data (in real app would read from xray API)
  useEffect(() => {
    if (!isConnected) {
      setUpPoints(Array(30).fill(0));
      setDownPoints(Array(30).fill(0));
      return;
    }

    const interval = setInterval(() => {
      setUptime(Math.floor((Date.now() - startTime) / 1000));

      const up   = Math.random() * 80 * 1024 + 10 * 1024 + Math.sin(Date.now() / 3000) * 30 * 1024;
      const down = Math.random() * 500 * 1024 + 50 * 1024 + Math.cos(Date.now() / 2000) * 100 * 1024;

      setUpPoints(prev => [...prev.slice(1), up]);
      setDownPoints(prev => [...prev.slice(1), down]);
      setTotalUp(prev => prev + up / 5);
      setTotalDown(prev => prev + down / 5);
    }, 200);

    return () => clearInterval(interval);
  }, [isConnected, startTime]);

  return (
    <div className="trafficview">
      {/* Header */}
      <div className="tv-header">
        <div>
          <div className="tv-title">Traffic</div>
          <div className="tv-subtitle">Шифрование и сетевой трафик</div>
        </div>
        <div className={`tv-status-dot ${isConnected ? 'on' : 'off'}`} />
      </div>

      <div className="tv-content">

        {/* Encryption animation */}
        <div className="tv-section">
          <div className="tv-section-title">ШИФРОВАНИЕ AES-256-GCM · XTLS-VISION</div>
          <div className="tv-canvas-wrap">
            <EncryptionCanvas isConnected={isConnected} width={340} height={180} />
            {!isConnected && (
              <div className="tv-canvas-overlay">
                <span>Подключитесь для активации</span>
              </div>
            )}
          </div>
        </div>

        {/* Speed graphs */}
        <div className="tv-section">
          <div className="tv-section-title">СКОРОСТЬ · РЕАЛЬНОЕ ВРЕМЯ</div>
          <div className="tv-graphs-row">
            <SpeedGraph points={downPoints} color="#ff3030" label="↓ DOWNLOAD" />
            <div className="tv-graph-divider" />
            <SpeedGraph points={upPoints}   color="#ff7040" label="↑ UPLOAD" />
          </div>
        </div>

        {/* Ping */}
        <div className="tv-section tv-ping-section">
          <div className="tv-section-title">ПИНГ ДО СЕРВЕРА</div>
          <div className="tv-ping-row">
            <div className="tv-ping-value" style={{ color: pingColor(ping) }}>
              {ping >= 0 ? `${ping} мс` : '—'}
            </div>
            <div className="tv-ping-bar-wrap">
              <div
                className="tv-ping-bar"
                style={{
                  width: ping >= 0 ? `${Math.min(ping / 300 * 100, 100)}%` : '0%',
                  background: pingColor(ping),
                  boxShadow: ping >= 0 ? `0 0 8px ${pingColor(ping)}` : 'none',
                }}
              />
            </div>
            <div className="tv-ping-label" style={{ color: pingColor(ping) }}>
              {isConnected ? pingLabel(ping) : '—'}
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="tv-section">
          <div className="tv-section-title">СТАТИСТИКА СЕССИИ</div>
          <div className="tv-stats-grid">
            <AnimatePresence>
              {[
                { label: 'Получено',   value: formatBytes(totalDown), color: '#ff3030', icon: '↓' },
                { label: 'Отправлено', value: formatBytes(totalUp),   color: '#ff7040', icon: '↑' },
                { label: 'Время',      value: formatUptime(uptime),   color: '#ff5050', icon: '⏱' },
                { label: 'Протокол',   value: 'VLESS',                color: '#ff4030', icon: '⚡' },
                { label: 'Шифр',       value: 'AES-256',              color: '#ff5040', icon: '🔒' },
                { label: 'Flow',       value: 'XTLS-Vision',          color: '#ff4040', icon: '🌊' },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  className="tv-stat-card"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <div className="tv-stat-icon">{stat.icon}</div>
                  <div className="tv-stat-label">{stat.label}</div>
                  <div className="tv-stat-value" style={{ color: stat.color }}>
                    {isConnected || ['Протокол','Шифр','Flow'].includes(stat.label) ? stat.value : '—'}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Encryption protocol chain */}
        <div className="tv-section">
          <div className="tv-section-title">ЦЕПОЧКА ЗАЩИТЫ</div>
          <div className="tv-chain">
            {['Ваш ПК', 'AES-256', 'XTLS', 'Reality', 'Сервер', 'Интернет'].map((node, i, arr) => (
              <div key={node} className="tv-chain-item">
                <motion.div
                  className={`tv-chain-node ${isConnected ? 'active' : ''}`}
                  animate={isConnected ? {
                    boxShadow: ['0 0 6px rgba(255,30,20,0.3)', '0 0 16px rgba(255,30,20,0.6)', '0 0 6px rgba(255,30,20,0.3)']
                  } : {}}
                  transition={{ duration: 1.5 + i * 0.2, repeat: Infinity }}
                >
                  {node}
                </motion.div>
                {i < arr.length - 1 && (
                  <motion.div
                    className="tv-chain-arrow"
                    animate={isConnected ? { opacity: [0.3, 1, 0.3] } : { opacity: 0.15 }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15 }}
                  >
                    →
                  </motion.div>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
