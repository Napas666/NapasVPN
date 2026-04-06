const api = window.vpnAPI;

export default function TitleBar() {
  return (
    <div className="titlebar">
      <span className="titlebar-title">NapasVPN — VLESS+Reality</span>
      <div className="titlebar-controls">
        <button className="titlebar-btn" onClick={() => api?.minimize()} title="Свернуть">
          &#8211;
        </button>
        <button className="titlebar-btn close" onClick={() => api?.close()} title="Закрыть">
          &#10005;
        </button>
      </div>
    </div>
  );
}
