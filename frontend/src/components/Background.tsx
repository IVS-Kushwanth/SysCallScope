import { useEffect, useRef } from "react";

/**
 * Ambient canvas: drifting nodes linked like a call graph, a slowly moving grid,
 * and an occasional lime pulse travelling along one link. Pauses when the tab is
 * hidden and renders a single static frame when reduced motion is requested.
 */
export function Background({ density = 1 }: { density?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, raf = 0, t = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    type N = { x: number; y: number; vx: number; vy: number };
    let nodes: N[] = [];
    let pulses: { a: number; b: number; p: number }[] = [];

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(70, (w * h) / 26000) * density);
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.18, vy: (Math.random() - 0.5) * 0.18,
      }));
    };

    const draw = () => {
      t += 1;
      ctx.clearRect(0, 0, w, h);
      // grid
      const g = 56, off = (t * 0.15) % g;
      ctx.strokeStyle = "rgba(255,255,255,0.028)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = -off; x < w; x += g) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
      for (let y = -off; y < h; y += g) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
      ctx.stroke();

      // links
      const links: [number, number][] = [];
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        if (!reduce) {
          a.x += a.vx; a.y += a.vy;
          if (a.x < 0 || a.x > w) a.vx *= -1;
          if (a.y < 0 || a.y > h) a.vy *= -1;
        }
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 150) {
            links.push([i, j]);
            ctx.strokeStyle = `rgba(21,88,201,${0.16 * (1 - d / 150)})`;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
      for (const n of nodes) {
        ctx.fillStyle = "rgba(106,155,240,0.55)";
        ctx.beginPath(); ctx.arc(n.x, n.y, 1.4, 0, Math.PI * 2); ctx.fill();
      }
      // pulses
      if (!reduce && links.length && Math.random() < 0.02 && pulses.length < 3) {
        const [a, b] = links[Math.floor(Math.random() * links.length)];
        pulses.push({ a, b, p: 0 });
      }
      pulses = pulses.filter((p) => p.p <= 1);
      for (const p of pulses) {
        p.p += 0.012;
        const A = nodes[p.a], B = nodes[p.b];
        if (!A || !B) { p.p = 2; continue; }
        const x = A.x + (B.x - A.x) * p.p, y = A.y + (B.y - A.y) * p.p;
        const grd = ctx.createRadialGradient(x, y, 0, x, y, 10);
        grd.addColorStop(0, "rgba(212,255,36,0.9)");
        grd.addColorStop(1, "rgba(212,255,36,0)");
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill();
      }
      if (!reduce && !document.hidden) raf = requestAnimationFrame(draw);
    };

    const onVis = () => { if (!document.hidden && !reduce) { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); } };
    resize();
    draw();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [density]);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden="true">
      <div className="absolute inset-0 bg-ink" />
      <div className="absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-cobalt/20 blur-[140px]" />
      <canvas ref={ref} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
