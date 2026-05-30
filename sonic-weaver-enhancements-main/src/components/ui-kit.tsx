// Small custom UI primitives — no native browser chrome.
import { type ReactNode } from "react";

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className="sw"
      data-on={on}
    />
  );
}

export function Range({
  value, min, max, step = 0.1, onChange, suffix,
}: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <div className="flex items-center gap-3 w-full">
      <input
        type="range" className="range"
        value={value} min={min} max={max} step={step}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <span className="text-xs tabular-nums w-14 text-right text-muted-foreground">
        {value.toFixed(step < 1 ? 1 : 0)}{suffix ?? ""}
      </span>
    </div>
  );
}

export function Chip({
  active, children, onClick,
}: { active?: boolean; children: ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all duration-200 active:scale-95 ${
        active
          ? "bg-gradient-to-r from-[oklch(0.72_0.22_330)] to-[oklch(0.7_0.2_200)] text-white border-transparent shadow-[0_0_24px_-6px_oklch(0.72_0.22_330/0.7)]"
          : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:border-white/20"
      }`}
    >
      {children}
    </button>
  );
}

export function Segmented<T extends string>({
  value, options, onChange,
}: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex p-1 rounded-full bg-white/5 border border-white/10">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-full transition-all ${
            value === o.value
              ? "bg-white/15 text-white shadow-inner"
              : "text-white/60 hover:text-white"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
