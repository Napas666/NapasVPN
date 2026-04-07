import { motion } from 'framer-motion';

const CHECKS = [
  { label: 'IP-адрес скрыт',         ok: true,  detail: 'Виден только IP VPN-сервера' },
  { label: 'Трафик зашифрован',       ok: true,  detail: 'AES-256-GCM конец-в-конец' },
  { label: 'DPI-обнаружение',         ok: true,  detail: 'Reality имитирует HTTPS' },
  { label: 'DNS-утечки',              ok: true,  detail: 'IP хранится в ключе, DNS не нужен' },
  { label: 'Временна́я зона браузера', ok: false, detail: 'Браузер всегда раскрывает ОС-таймзону' },
];

const COMPARE = [
  { name: 'VLESS + Reality', enc: 'AES-256-GCM', dpi: 'Скрыт ✓',   good: true  },
  { name: 'WireGuard',       enc: 'ChaCha20',     dpi: 'Виден ✗',   good: false },
  { name: 'OpenVPN',         enc: 'AES-256',      dpi: 'Виден ✗',   good: false },
  { name: 'Shadowsocks',     enc: 'ChaCha20',     dpi: 'Частично ~', good: false },
];

function Row({ icon, text }) {
  return (
    <div className="ab-row">
      <span className="ab-row-icon">{icon}</span>
      <span className="ab-row-text">{text}</span>
    </div>
  );
}

export default function AboutView() {
  return (
    <div className="aboutview">

      <div className="ab-header">
        <div>
          <div className="ab-title">About Security</div>
          <div className="ab-subtitle">Почему NapasVPN надёжен</div>
        </div>
        <div className="ab-grade">A+</div>
      </div>

      <div className="ab-content">

        {/* ── Protocol chips ── */}
        <motion.div className="ab-section"
          initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.05 }}>
          <div className="ab-section-title">ПРОТОКОЛ</div>
          <div className="ab-chips">
            <span className="ab-chip">VLESS</span>
            <span className="ab-chip">Reality TLS 1.3</span>
            <span className="ab-chip">AES-256-GCM</span>
            <span className="ab-chip">XTLS-Vision</span>
            <span className="ab-chip">xray-core</span>
          </div>
        </motion.div>

        {/* ── Why invisible ── */}
        <motion.div className="ab-section"
          initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.1 }}>
          <div className="ab-section-title">ПОЧЕМУ VPN НЕВИДИМ</div>
          <div className="ab-info-block">
            <Row icon="🛡" text="Reality делает трафик неотличимым от обычного HTTPS. Провайдер видит TLS 1.3 к легитимному сайту (например, apple.com) — никаких VPN-признаков." />
            <Row icon="🔍" text="Глубокая инспекция пакетов (DPI) не работает: Reality имитирует TLS-handshake реального сервера, алгоритм обнаружения не срабатывает." />
            <Row icon="🌐" text="DNS-блокировка невозможна: в VLESS-ключе хранится прямой IP сервера, DNS-запросов к нему нет вообще." />
            <Row icon="🔒" text="Работает в Китае и Иране — странах с жёсткой цензурой, где заблокированы OpenVPN, WireGuard и Shadowsocks." />
          </div>
        </motion.div>

        {/* ── How it works ── */}
        <motion.div className="ab-section"
          initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.15 }}>
          <div className="ab-section-title">КАК РАБОТАЕТ</div>
          <div className="ab-flow">
            {['Твой ПК', 'xray-core', 'Reality TLS', 'Сервер', 'Интернет'].map((node, i, arr) => (
              <div key={node} className="ab-flow-item">
                <motion.div className="ab-flow-node"
                  animate={{ boxShadow: ['0 0 6px rgba(255,35,20,0.25)', '0 0 16px rgba(255,35,20,0.55)', '0 0 6px rgba(255,35,20,0.25)'] }}
                  transition={{ duration: 2 + i * 0.3, repeat: Infinity }}>
                  {node}
                </motion.div>
                {i < arr.length - 1 && (
                  <motion.div className="ab-flow-arrow"
                    animate={{ opacity: [0.25, 1, 0.25] }}
                    transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.18 }}>
                    →
                  </motion.div>
                )}
              </div>
            ))}
          </div>
          <div className="ab-flow-note">
            Весь трафик шифруется до выхода из устройства. Провайдер видит только поток зашифрованных HTTPS-пакетов.
          </div>
        </motion.div>

        {/* ── Protection checklist ── */}
        <motion.div className="ab-section"
          initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.2 }}>
          <div className="ab-section-title">СТАТУС ЗАЩИТЫ</div>
          <div className="ab-checklist">
            {CHECKS.map((c) => (
              <div key={c.label} className="ab-check-row">
                <span className={`ab-check-dot ${c.ok ? 'ok' : 'warn'}`} />
                <span className="ab-check-label">{c.label}</span>
                <span className={`ab-check-badge ${c.ok ? 'ok' : 'warn'}`}>
                  {c.ok ? 'Защищено' : 'Уязвимо'}
                </span>
                <span className="ab-check-detail">{c.detail}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Comparison table ── */}
        <motion.div className="ab-section"
          initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.25 }}>
          <div className="ab-section-title">СРАВНЕНИЕ ПРОТОКОЛОВ</div>
          <div className="ab-table">
            <div className="ab-table-row ab-table-head">
              <span>Протокол</span><span>Шифрование</span><span>DPI</span>
            </div>
            {COMPARE.map((r) => (
              <div key={r.name} className={`ab-table-row ${r.good ? 'good' : ''}`}>
                <span>{r.name}</span>
                <span>{r.enc}</span>
                <span className={r.good ? 'green' : 'red'}>{r.dpi}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Tech ── */}
        <motion.div className="ab-section"
          initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.30 }}>
          <div className="ab-section-title">ТЕХНОЛОГИЯ</div>
          <div className="ab-tech">
            {[
              ['Движок',    'xray-core · XTLS Project'],
              ['Лицензия',  'Open Source (MPL-2.0)'],
              ['Прокси',    'SOCKS5 :10808 · HTTP :10809'],
              ['Платформы', 'Windows · macOS'],
              ['Версия',    'NapasVPN 1.0'],
            ].map(([k, v]) => (
              <div key={k} className="ab-tech-row">
                <span className="ab-tech-key">{k}</span>
                <span className="ab-tech-val">{v}</span>
              </div>
            ))}
          </div>
        </motion.div>

      </div>
    </div>
  );
}
