// Animated equalizer: 4 bars, currentColor.
export function Equalizer({ playing = true, className = "" }: { playing?: boolean; className?: string }) {
  return (
    <span className={`eq ${className}`} data-paused={!playing} aria-hidden>
      <span /><span /><span /><span />
    </span>
  );
}
