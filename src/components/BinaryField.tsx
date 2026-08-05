import { useEffect, useRef } from "react";

// Full-screen background of drifting 0/1 glyphs, adapted from the GPGPU
// ascii-wordmark reference (prompt2.txt): same flow-field shimmer and
// fading cursor trail, but canvas-2D and screen-filling instead of
// GPU particles spelling a word.
const CELL = 15;
const FONT = '11px "JetBrains Mono", ui-monospace, monospace';
const BASE_ALPHA = 0.05;
const SHIMMER_ALPHA = 0.05;
const TRAIL_LEN = 20;
const TRAIL_LIFE = 0.7;
const TRAIL_RADIUS = 6;

export function BinaryField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let cols = 0;
    let rows = 0;
    let chars = new Uint8Array(0);
    let boost = new Float32Array(0);
    let last = 0;
    let lastFlip = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      cols = Math.ceil(window.innerWidth / CELL);
      rows = Math.ceil(window.innerHeight / CELL);
      chars = new Uint8Array(cols * rows);
      boost = new Float32Array(cols * rows);
      for (let i = 0; i < chars.length; i++) {
        chars[i] = Math.random() < 0.5 ? 0 : 1;
      }
    };
    resize();
    window.addEventListener("resize", resize);

    const trail = Array.from({ length: TRAIL_LEN }, () => ({
      x: -1e4,
      y: -1e4,
      age: 1,
    }));
    const onMove = (e: PointerEvent) => {
      for (let i = TRAIL_LEN - 1; i > 0; i--) {
        trail[i].x = trail[i - 1].x;
        trail[i].y = trail[i - 1].y;
        trail[i].age = trail[i - 1].age;
      }
      trail[0].x = e.clientX;
      trail[0].y = e.clientY;
      trail[0].age = 0;
    };
    window.addEventListener("pointermove", onMove);

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const time = now / 1000;
      const dt = Math.min(time - last, 0.1);
      last = time;

      for (const p of trail) {
        p.age = Math.min(1, p.age + dt / TRAIL_LIFE);
      }
      boost.fill(0);
      for (const p of trail) {
        if (p.age >= 1) continue;
        const cx = p.x / CELL;
        const cy = p.y / CELL;
        const r = TRAIL_RADIUS * (1 - p.age * 0.5);
        const x0 = Math.max(0, Math.floor(cx - r));
        const x1 = Math.min(cols - 1, Math.ceil(cx + r));
        const y0 = Math.max(0, Math.floor(cy - r));
        const y1 = Math.min(rows - 1, Math.ceil(cy + r));
        for (let gy = y0; gy <= y1; gy++) {
          for (let gx = x0; gx <= x1; gx++) {
            const d = Math.hypot(gx + 0.5 - cx, gy + 0.5 - cy);
            const g = Math.max(0, 1 - d / r) * (1 - p.age);
            const idx = gy * cols + gx;
            if (g > boost[idx]) boost[idx] = g;
          }
        }
      }

      // Occasionally flip a few digits so the field feels alive
      if (time - lastFlip > 0.12) {
        lastFlip = time;
        const flips = Math.max(1, (cols * rows * 0.015) | 0);
        for (let i = 0; i < flips; i++) {
          const idx = (Math.random() * chars.length) | 0;
          chars[idx] ^= 1;
        }
      }

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      ctx.font = FONT;
      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          const idx = gy * cols + gx;
          // Cheap drifting flow-field, standing in for the simplex noise
          const n =
            Math.sin(gx * 0.35 + time * 0.5 + Math.sin(gy * 0.27 - time * 0.3)) *
            Math.sin(gy * 0.31 - time * 0.4 + Math.sin(gx * 0.22 + time * 0.25));
          const a = BASE_ALPHA + SHIMMER_ALPHA * (0.5 + 0.5 * n);
          const b = boost[idx];
          ctx.fillStyle = `rgba(255, 255, 255, ${
            b > 0.02 ? Math.min(0.5, a + b * 0.35) : a
          })`;
          ctx.fillText(
            chars[idx] ? "1" : "0",
            gx * CELL + CELL / 2,
            gy * CELL + CELL / 2
          );
        }
      }
    };

    const start = () => {
      if (!raf) {
        last = performance.now() / 1000;
        raf = requestAnimationFrame(loop);
      }
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVis);
    start();

    return () => {
      stop();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return <canvas ref={ref} className="binary-field" aria-hidden="true" />;
}
