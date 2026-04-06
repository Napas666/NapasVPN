import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function Row({ label, value, highlight, mono }) {
  return (
    <motion.div
      className="id-row"
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
    >
      <span className="id-label">{label}</span>
      <span className={`id-value ${highlight ? 'rg' : ''} ${mono ? 'mono' : ''}`}>
        {value || '—'}
      </span>
    </motion.div>
  );
}

function Section({ title, children }) {
  return (
    <div className="id-section">
      <div className="id-section-title">{title}</div>
      {children}
    </div>
  );
}

export default function IdentityView({ isConnected }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function fetchIdentity() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        'http://ip-api.com/json/?fields=status,message,country,countryCode,regionName,city,zip,lat,lon,timezone,isp,org,as,query,mobile,proxy,hosting'
      );
      const ipData = await res.json();
      if (ipData.status !== 'success') throw new Error(ipData.message);

      setData({
        ip: ipData.query,
        country: `${ipData.country} (${ipData.countryCode})`,
        region: ipData.regionName,
        city: ipData.city,
        zip: ipData.zip,
        timezone: ipData.timezone,
        isp: ipData.isp,
        org: ipData.org,
        as: ipData.as,
        isProxy: ipData.proxy,
        isHosting: ipData.hosting,
        isMobile: ipData.mobile,
        lat: ipData.lat?.toFixed(4),
        lon: ipData.lon?.toFixed(4),
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        doNotTrack: navigator.doNotTrack === '1' ? 'Включён' : 'Выключен',
        cookiesEnabled: navigator.cookieEnabled ? 'Да' : 'Нет',
        screenRes: `${window.screen.width}×${window.screen.height}`,
        colorDepth: `${window.screen.colorDepth} bit`,
        timezone2: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    } catch (e) {
      setError('Не удалось получить данные. Проверьте соединение.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchIdentity();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  return (
    <div className="identityview">
      <div className="id-header">
        <div>
          <div className="id-title">My Identity</div>
          <div className="id-subtitle">Как вас видят сайты</div>
        </div>
        <button className="id-refresh-btn" onClick={fetchIdentity} title="Обновить">↻</button>
      </div>

      <AnimatePresence>
        {loading && (
          <motion.div className="id-loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
              style={{ display: 'inline-block', fontSize: 22 }}
            >↻</motion.span>
            <span>Сканирование…</span>
          </motion.div>
        )}
      </AnimatePresence>

      {error && <div className="id-error">{error}</div>}

      {data && !loading && (
        <div className="id-content">

          {/* VPN Status badge */}
          <div className={`id-vpn-badge ${isConnected ? 'on' : 'off'}`}>
            <span className="id-vpn-dot" />
            {isConnected ? 'VPN активен — трафик защищён' : 'VPN выключен — реальный IP виден'}
          </div>

          <Section title="🌐 Сеть">
            <Row label="IP-адрес"    value={data.ip}      highlight mono />
            <Row label="Страна"      value={data.country} />
            <Row label="Регион"      value={data.region} />
            <Row label="Город"       value={data.city} />
            <Row label="Часовой пояс" value={data.timezone} />
            <Row label="Провайдер"   value={data.isp} />
            <Row label="Организация" value={data.org} />
            <Row label="AS"          value={data.as} mono />
            <Row label="Прокси"      value={data.isProxy ? '⚠️ Да' : '✓ Нет'} />
            <Row label="Хостинг"     value={data.isHosting ? 'Да (VPS/DC)' : 'Нет'} />
          </Section>

          <Section title="🖥️ Браузер">
            <Row label="User-Agent"  value={data.userAgent} mono />
            <Row label="Язык"        value={data.language} />
            <Row label="Платформа"   value={data.platform} />
            <Row label="Do Not Track" value={data.doNotTrack} />
            <Row label="Cookies"     value={data.cookiesEnabled} />
          </Section>

          <Section title="🖥️ Экран">
            <Row label="Разрешение"  value={data.screenRes} />
            <Row label="Глубина цвета" value={data.colorDepth} />
          </Section>

          <Section title="🕐 Время">
            <Row label="Таймзон браузера" value={data.timezone2} />
            <Row label="Таймзон IP"       value={data.timezone} />
            <Row
              label="Совпадают"
              value={data.timezone2 === data.timezone ? '✓ Да' : '⚠️ Нет — утечка!'}
            />
          </Section>

        </div>
      )}
    </div>
  );
}
