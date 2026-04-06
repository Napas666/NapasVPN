import { useEffect, useRef } from 'react';

const JELLYFISH = [
  { x: 0.22, y: 0.38, size: 88,  speed: 0.28, phase: 0,           driftX: 0.12, driftY: 0.09 },
  { x: 0.68, y: 0.55, size: 62,  speed: 0.22, phase: Math.PI * 1.3, driftX: 0.09, driftY: 0.11 },
];

function drawJellyfish(ctx, jelly, t, W, H) {
  const { x, y, size, speed, phase, driftX, driftY } = jelly;

  const px = (x + Math.sin(t * speed * 0.5 + phase) * driftX) * W;
  const py = (y + Math.cos(t * speed * 0.4 + phase + 1) * driftY) * H;

  // Pulsing bell
  const pulse  = 1 + Math.sin(t * speed * 2.2 + phase) * 0.07;
  const bellW  = size * pulse;
  const bellH  = size * 0.68;

  ctx.save();
  ctx.translate(px, py);

  // ── Wide ambient glow ───────────────────────────────────────
  const ambGlow = ctx.createRadialGradient(0, -bellH * 0.3, 0, 0, 0, size * 2.2);
  ambGlow.addColorStop(0,   'rgba(255, 30, 30, 0.18)');
  ambGlow.addColorStop(0.4, 'rgba(200, 10, 10, 0.07)');
  ambGlow.addColorStop(1,   'transparent');
  ctx.beginPath();
  ctx.ellipse(0, -bellH * 0.2, size * 2.2, size * 1.8, 0, 0, Math.PI * 2);
  ctx.fillStyle = ambGlow;
  ctx.fill();

  // ── Bell shape ──────────────────────────────────────────────
  ctx.beginPath();
  ctx.moveTo(-bellW, 0);
  ctx.bezierCurveTo(-bellW, -bellH * 1.55, bellW, -bellH * 1.55, bellW, 0);
  ctx.bezierCurveTo(bellW * 0.75, bellH * 0.28, -bellW * 0.75, bellH * 0.28, -bellW, 0);
  ctx.closePath();

  const bellGrad = ctx.createRadialGradient(-bellW * 0.25, -bellH * 0.55, size * 0.05, 0, -bellH * 0.3, bellW * 1.1);
  bellGrad.addColorStop(0,   'rgba(255, 100, 80, 0.82)');
  bellGrad.addColorStop(0.25,'rgba(230,  35, 20, 0.68)');
  bellGrad.addColorStop(0.6, 'rgba(180,  10,  5, 0.45)');
  bellGrad.addColorStop(1,   'rgba( 80,   0,  0, 0.18)');
  ctx.fillStyle = bellGrad;
  ctx.fill();

  // Bell edge glow
  ctx.beginPath();
  ctx.moveTo(-bellW, 0);
  ctx.bezierCurveTo(-bellW, -bellH * 1.55, bellW, -bellH * 1.55, bellW, 0);
  ctx.bezierCurveTo(bellW * 0.75, bellH * 0.28, -bellW * 0.75, bellH * 0.28, -bellW, 0);
  ctx.strokeStyle = 'rgba(255, 80, 60, 0.55)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // ── Top specular highlight ──────────────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(-bellW * 0.18, -bellH * 1.1, bellW * 0.28, bellH * 0.18, -0.3, 0, Math.PI * 2);
  const specGrad = ctx.createRadialGradient(-bellW * 0.18, -bellH * 1.1, 0, -bellW * 0.18, -bellH * 1.1, bellW * 0.28);
  specGrad.addColorStop(0,   'rgba(255,180,160,0.45)');
  specGrad.addColorStop(1,   'transparent');
  ctx.fillStyle = specGrad;
  ctx.fill();
  ctx.restore();

  // ── Inner radial ribs ───────────────────────────────────────
  const ribCount = 7;
  for (let i = 0; i < ribCount; i++) {
    const ribX = -bellW * 0.85 + (bellW * 1.7 / (ribCount - 1)) * i;
    ctx.beginPath();
    ctx.moveTo(ribX, 0);
    ctx.quadraticCurveTo(ribX * 0.5, -bellH * 0.9, 0, -bellH * 1.3);
    ctx.strokeStyle = `rgba(255, 70, 50, ${0.12 + (1 - Math.abs(i - ribCount / 2) / ribCount) * 0.12})`;
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }

  // ── Oral arms (thick inner tentacles) ──────────────────────
  const oralCount = 4;
  for (let i = 0; i < oralCount; i++) {
    const ox = -bellW * 0.3 + (bellW * 0.6 / (oralCount - 1)) * i;
    ctx.beginPath();
    ctx.moveTo(ox, bellH * 0.15);
    let py2 = bellH * 0.15;
    let px2 = ox;
    const len = size * (0.9 + Math.sin(i * 1.7) * 0.3);
    const segs = 10;
    for (let s = 1; s <= segs; s++) {
      py2 = bellH * 0.15 + (len / segs) * s;
      px2 = ox + Math.sin(t * speed * 1.8 + i * 1.4 + s * 0.6 + phase) * (8 + s * 1.2);
      ctx.lineTo(px2, py2);
    }
    const oralAlpha = 0.55 - i * 0.04;
    ctx.strokeStyle = `rgba(255, 50, 30, ${oralAlpha})`;
    ctx.lineWidth = 1.5 - i * 0.1;
    ctx.stroke();
  }

  // ── Marginal tentacles ─────────────────────────────────────
  const tentCount = 16;
  for (let i = 0; i < tentCount; i++) {
    const tx2 = -bellW * 0.9 + (bellW * 1.8 / (tentCount - 1)) * i;
    const tLen = size * (1.1 + Math.sin(i * 1.3 + phase) * 0.5);
    const segs = 12;

    ctx.beginPath();
    ctx.moveTo(tx2, 0);
    for (let s = 1; s <= segs; s++) {
      const progress = s / segs;
      const ty = (tLen / segs) * s;
      const waveAmp = (6 + s * 0.8) * (1 - progress * 0.3);
      const tx3 = tx2
        + Math.sin(t * speed * 1.6 + i * 0.7 + s * 0.55 + phase) * waveAmp
        + Math.sin(t * speed * 2.8 + i * 1.1 + phase) * 3;
      ctx.lineTo(tx3, ty);
    }
    const fade = 0.55 - (i / tentCount) * 0.05;
    ctx.strokeStyle = `rgba(255, 45, 25, ${fade})`;
    ctx.lineWidth = 1.0 - (i % 2) * 0.3;
    ctx.stroke();
  }

  // ── Short frilly skirt ─────────────────────────────────────
  const frillCount = 28;
  for (let i = 0; i < frillCount; i++) {
    const fx = -bellW * 0.92 + (bellW * 1.84 / (frillCount - 1)) * i;
    const fLen = size * (0.12 + Math.sin(i * 2.3) * 0.05);
    const fw = Math.sin(t * speed * 3.5 + i * 0.55 + phase) * 5;
    ctx.beginPath();
    ctx.moveTo(fx, 0);
    ctx.lineTo(fx + fw, fLen);
    ctx.strokeStyle = 'rgba(255, 90, 60, 0.3)';
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }

  ctx.restore();
}

export default function JellyfishCanvas({ width = 380, height = 500 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let raf;
    let t = 0;

    function render() {
      t += 0.016;
      ctx.clearRect(0, 0, width, height);
      JELLYFISH.forEach(j => drawJellyfish(ctx, j, t, width, height));
      raf = requestAnimationFrame(render);
    }

    render();
    return () => cancelAnimationFrame(raf);
  }, [width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}
