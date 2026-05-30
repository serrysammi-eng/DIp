// Canvas frequency visualizer tied to the global AnalyserNode.
// Supports three variants: bars, wave, and pro (64-bar spectrum).
import { useEffect, useRef } from "react";
import { usePlayer } from "../lib/store";

export function Visualizer({ height = 64, className = "", variant = "bars" }: { height?: number; className?: string; variant?: "bars" | "wave" | "pro" }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { state } = usePlayer();

  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    let raf = 0;
    const analyser = state.analyser;
    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const w = cv.clientWidth, h = cv.clientHeight;
      cv.width = w * dpr; cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const data = analyser ? new Uint8Array(analyser.frequencyBinCount) : new Uint8Array(64);

    // Read art colors from CSS custom props for dynamic coloring
    const getArtColors = () => {
      const style = getComputedStyle(document.documentElement);
      const art1 = style.getPropertyValue("--art-1").trim() || "230 120 200";
      const art2 = style.getPropertyValue("--art-2").trim() || "120 80 220";
      return { art1, art2 };
    };

    const draw = () => {
      const w = cv.clientWidth, h = cv.clientHeight;
      ctx.clearRect(0, 0, w, h);
      if (analyser && state.isPlaying) analyser.getByteFrequencyData(data);
      else for (let i = 0; i < data.length; i++) data[i] = Math.max(0, data[i] - 8);

      if (variant === "pro") {
        const bars = 64;
        const gap = 1.5;
        const bw = (w - gap * (bars - 1)) / bars;
        const colors = getArtColors();

        for (let i = 0; i < bars; i++) {
          const rawVal = data[Math.floor((i / bars) * data.length)] / 255;
          const val = Math.pow(rawVal, 0.85);
          const bh = Math.max(1, val * h * 0.9);
          const x = i * (bw + gap);
          const y = h - bh;

          // Dynamic gradient based on art colors
          const g = ctx.createLinearGradient(0, y, 0, h);
          const progress = i / bars;
          g.addColorStop(0, `rgba(${colors.art1.replace(/ /g, ",")}, ${0.9})`);
          g.addColorStop(1, `rgba(${colors.art2.replace(/ /g, ",")}, ${0.6})`);
          ctx.fillStyle = g;

          // Rounded top
          const r = Math.min(bw / 2, 2);
          ctx.beginPath();
          ctx.moveTo(x + r, y);
          ctx.lineTo(x + bw - r, y);
          ctx.quadraticCurveTo(x + bw, y, x + bw, y + r);
          ctx.lineTo(x + bw, h);
          ctx.lineTo(x, h);
          ctx.lineTo(x, y + r);
          ctx.quadraticCurveTo(x, y, x + r, y);
          ctx.fill();

          // Peak glow
          if (val > 0.65) {
            ctx.shadowColor = `rgba(${colors.art1.replace(/ /g, ",")}, 0.5)`;
            ctx.shadowBlur = 8;
            ctx.fillRect(x, y, bw, 1.5);
            ctx.shadowBlur = 0;
          }
        }
      } else if (variant === "bars") {
        const bars = 40;
        const bw = w / bars;
        for (let i = 0; i < bars; i++) {
          const v = data[Math.floor((i / bars) * data.length)] / 255;
          const bh = Math.max(2, v * h * 0.95);
          const g = ctx.createLinearGradient(0, h - bh, 0, h);
          g.addColorStop(0, "rgba(255,120,220,0.95)");
          g.addColorStop(1, "rgba(100,180,255,0.8)");
          ctx.fillStyle = g;
          ctx.fillRect(i * bw + 1, h - bh, bw - 2, bh);
        }
      } else {
        ctx.beginPath();
        ctx.lineWidth = 2;
        const grad = ctx.createLinearGradient(0, 0, w, 0);
        grad.addColorStop(0, "rgba(255,120,220,0.9)");
        grad.addColorStop(0.5, "rgba(180,140,255,0.9)");
        grad.addColorStop(1, "rgba(100,200,255,0.9)");
        ctx.strokeStyle = grad;
        for (let i = 0; i < data.length; i++) {
          const x = (i / data.length) * w;
          const y = h / 2 - (data[i] / 255) * (h / 2 - 4);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [state.analyser, state.isPlaying, variant]);

  return <canvas ref={ref} style={{ height, width: "100%" }} className={className} />;
}
