import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// We use Leaflet directly (not react-leaflet) to avoid SSR issues with CRA
// Leaflet CSS is imported in App.css via CDN link in index.html

export default function MapView({ isConnected }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const [geoData, setGeoData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function fetchGeo() {
    setLoading(true);
    setError('');
    try {
      // ip-api.com — free, no key needed, returns JSON with lat/lon
      const res = await fetch('http://ip-api.com/json/?fields=status,message,country,countryCode,regionName,city,zip,lat,lon,timezone,isp,org,as,query');
      const data = await res.json();
      if (data.status !== 'success') throw new Error(data.message || 'Ошибка геолокации');
      setGeoData(data);
      return data;
    } catch (e) {
      setError('Не удалось получить геолокацию. Проверьте интернет-соединение.');
      return null;
    } finally {
      setLoading(false);
    }
  }

  // Init map
  useEffect(() => {
    if (mapInstanceRef.current) return;
    const L = window.L;
    if (!L) return;

    const map = L.map(mapRef.current, {
      center: [20, 0],
      zoom: 2,
      zoomControl: true,
      attributionControl: false,
    });

    // Dark map tiles from CartoDB
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 18,
    }).addTo(map);

    mapInstanceRef.current = map;
  }, []);

  // Fetch geo and put marker on map
  useEffect(() => {
    const L = window.L;
    if (!L || !mapInstanceRef.current) return;

    fetchGeo().then((data) => {
      if (!data) return;
      const map = mapInstanceRef.current;

      // Remove old marker
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }

      // Custom rose-gold circle marker
      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width:18px;height:18px;
          border-radius:50%;
          background:radial-gradient(circle at 35% 35%, #ffffff, #8a8a8a);
          border:2px solid #fff;
          box-shadow:0 0 12px rgba(255,255,255,0.7), 0 0 0 4px rgba(255,255,255,0.15);
        "></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      const marker = L.marker([data.lat, data.lon], { icon }).addTo(map);
      marker.bindTooltip(`${data.city}, ${data.country}`, {
        permanent: true,
        direction: 'top',
        offset: [0, -12],
        className: 'map-tooltip',
      }).openTooltip();

      markerRef.current = marker;
      map.flyTo([data.lat, data.lon], 6, { duration: 1.5 });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  return (
    <div className="mapview">
      {/* Map container */}
      <div className="map-wrap">
        <div ref={mapRef} className="map-canvas" />

        <AnimatePresence>
          {loading && (
            <motion.div
              className="map-overlay"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                style={{ fontSize: 28 }}
              >
                ↻
              </motion.div>
              <span>Определяю местоположение…</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Info cards below map */}
      <AnimatePresence>
        {geoData && !loading && (
          <motion.div
            className="map-info"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <div className="map-info-row">
              <div className="map-info-card">
                <div className="map-info-label">IP</div>
                <div className="map-info-value rg">{geoData.query}</div>
              </div>
              <div className="map-info-card">
                <div className="map-info-label">Страна</div>
                <div className="map-info-value">{geoData.country}</div>
              </div>
            </div>
            <div className="map-info-row">
              <div className="map-info-card">
                <div className="map-info-label">Город</div>
                <div className="map-info-value">{geoData.city}</div>
              </div>
              <div className="map-info-card">
                <div className="map-info-label">Провайдер</div>
                <div className="map-info-value small">{geoData.isp}</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && <div className="map-error">{error}</div>}

      {/* Refresh button */}
      <button className="map-refresh-btn" onClick={() => {
        const L = window.L;
        if (L && mapInstanceRef.current && markerRef.current) {
          markerRef.current.remove();
          markerRef.current = null;
        }
        setGeoData(null);
        fetchGeo().then((data) => {
          if (!data || !mapInstanceRef.current) return;
          const L = window.L;
          const icon = L.divIcon({
            className: '',
            html: `<div style="width:18px;height:18px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#ffffff,#8a8a8a);border:2px solid #fff;box-shadow:0 0 12px rgba(255,255,255,.7)"></div>`,
            iconSize: [18, 18], iconAnchor: [9, 9],
          });
          const marker = L.marker([data.lat, data.lon], { icon }).addTo(mapInstanceRef.current);
          marker.bindTooltip(`${data.city}, ${data.country}`, {
            permanent: true, direction: 'top', offset: [0, -12], className: 'map-tooltip',
          }).openTooltip();
          markerRef.current = marker;
          mapInstanceRef.current.flyTo([data.lat, data.lon], 6, { duration: 1.5 });
        });
      }}>
        ↻ Обновить
      </button>
    </div>
  );
}
