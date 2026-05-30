// Anti-gravity particle background — canvas-based constellation effect.
// Particles float, connect with thin lines, and respond to mouse/touch.
// Click/touch scatters nearby particles, which spring back over ~1 second.
import { useEffect, useRef, useCallback } from "react";

type Particle = {
  x: number;
  y: number;
  originX: number;
  originY: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  hue: number; // 200 = cyan, 280 = violet, 330 = magenta
  scattered: boolean;
};

const DESKTOP_COUNT = 70;
const MOBILE_COUNT = 35;
const CONNECTION_DIST = 140;
const MOUSE_RADIUS = 200;
const SCATTER_RADIUS = 100;
const SCATTER_FORCE = 5;

export function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef(0);

  const init = useCallback((w: number, h: number) => {
    const isMobile = w < 768;
    const count = isMobile ? MOBILE_COUNT : DESKTOP_COUNT;
    const particles: Particle[] = [];
    const hues = [200, 260, 280, 330];
    for (let i = 0; i < count; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      particles.push({
        x, y,
        originX: x,
        originY: y,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        radius: Math.random() * 2 + 0.8,
        opacity: Math.random() * 0.5 + 0.15,
        hue: hues[Math.floor(Math.random() * hues.length)],
        scattered: false,
      });
    }
    particlesRef.current = particles;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (particlesRef.current.length === 0) init(w, h);
    };
    resize();

    const onMouse = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
      // Also set CSS custom properties for the cursor-following gradient
      document.body.style.setProperty("--mouse-x", `${e.clientX}px`);
      document.body.style.setProperty("--mouse-y", `${e.clientY}px`);
    };

    const onTouch = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const t = e.touches[0];
        mouseRef.current = { x: t.clientX, y: t.clientY };
      }
    };

    // Scatter particles on click/touch
    const scatterAt = (px: number, py: number) => {
      for (const p of particlesRef.current) {
        const dx = p.x - px;
        const dy = p.y - py;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < SCATTER_RADIUS && dist > 1) {
          const angle = Math.atan2(dy, dx);
          const force = ((SCATTER_RADIUS - dist) / SCATTER_RADIUS) * SCATTER_FORCE;
          p.vx += Math.cos(angle) * force;
          p.vy += Math.sin(angle) * force;
          p.scattered = true;
        }
      }
    };

    const onClick = (e: MouseEvent) => {
      scatterAt(e.clientX, e.clientY);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const t = e.touches[0];
        scatterAt(t.clientX, t.clientY);
        mouseRef.current = { x: t.clientX, y: t.clientY };
      }
    };

    window.addEventListener("mousemove", onMouse, { passive: true });
    window.addEventListener("touchmove", onTouch, { passive: true });
    window.addEventListener("click", onClick, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("resize", resize, { passive: true });

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const particles = particlesRef.current;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      // Update + draw particles
      for (const p of particles) {
        // Drift
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around edges
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10;
        if (p.y > h + 10) p.y = -10;

        // Mouse/pointer repulsion (subtle — particles near cursor repel)
        const dx = mx - p.x;
        const dy = my - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MOUSE_RADIUS && dist > 1) {
          const force = (MOUSE_RADIUS - dist) / MOUSE_RADIUS * 0.012;
          p.vx -= (dx / dist) * force;
          p.vy -= (dy / dist) * force;
        }

        // Spring back after scatter (~1 second recovery)
        if (p.scattered) {
          const sdx = p.originX - p.x;
          const sdy = p.originY - p.y;
          // Spring constant — higher = faster return
          p.vx += sdx * 0.006;
          p.vy += sdy * 0.006;
          const sDist = Math.sqrt(sdx * sdx + sdy * sdy);
          if (sDist < 3 && Math.abs(p.vx) < 0.4 && Math.abs(p.vy) < 0.4) {
            p.scattered = false;
          }
        }

        // Dampen velocity
        p.vx *= 0.988;
        p.vy *= 0.988;

        // Update origin to track organic drift when not scattered
        if (!p.scattered) {
          p.originX = p.x;
          p.originY = p.y;
        }

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `oklch(0.75 0.15 ${p.hue} / ${p.opacity})`;
        ctx.fill();

        // Outer glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 3, 0, Math.PI * 2);
        ctx.fillStyle = `oklch(0.7 0.18 ${p.hue} / ${p.opacity * 0.15})`;
        ctx.fill();
      }

      // Draw connections
      const connDist = w < 768 ? CONNECTION_DIST * 0.7 : CONNECTION_DIST;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < connDist) {
            const alpha = (1 - dist / connDist) * 0.12;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `oklch(0.75 0.15 280 / ${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("click", onClick);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("resize", resize);
    };
  }, [init]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: -1 }}
      aria-hidden
    />
  );
}
