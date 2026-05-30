// Premium Paywall — ₹99 Lifetime purchase screen
// Triggered when user taps "Unlock Premium". Checks login status first.
import { useState } from "react";
import { usePrefs } from "../lib/store";
import { X } from "lucide-react";

type PaywallProps = {
  open: boolean;
  onClose: () => void;
  onNeedLogin: () => void;
};

export function PremiumPaywall({ open, onClose, onNeedLogin }: PaywallProps) {
  const { prefs, setPremium } = usePrefs();
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [restoreEmail, setRestoreEmail] = useState("");
  const [restoreMode, setRestoreMode] = useState(false);
  const [restoreResult, setRestoreResult] = useState<"idle" | "found" | "not-found">("idle");
  const { restorePurchase } = usePrefs();

  if (!open) return null;

  const handleUnlock = () => {
    // Check if logged in
    if (!prefs.userEmail) {
      onNeedLogin();
      return;
    }
    // Mock payment
    setProcessing(true);
    setTimeout(() => {
      setPremium(prefs.userEmail);
      setProcessing(false);
      setSuccess(true);
    }, 2000);
  };

  const handleRestore = () => {
    if (!restoreEmail.trim()) return;
    const found = restorePurchase(restoreEmail.trim());
    setRestoreResult(found ? "found" : "not-found");
    if (found) {
      setTimeout(onClose, 1500);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: "oklch(0.14 0.025 285)" }}>
        <div className="text-center fade-up">
          <div className="text-7xl mb-6">🎉</div>
          <h1 className="text-3xl font-bold text-white mb-2">You're Premium!</h1>
          <p className="text-white/60 text-sm mb-8">All ads removed. Premium forever. Enjoy!</p>
          <button
            onClick={onClose}
            className="px-8 py-3 rounded-full bg-gradient-to-r from-[oklch(0.72_0.22_330)] to-[oklch(0.7_0.2_200)] text-white font-semibold hover:scale-105 active:scale-95 transition-transform glow-primary"
          >
            Start Listening
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] overflow-auto" style={{ background: "oklch(0.14 0.025 285)" }}>
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-10 h-10 grid place-items-center rounded-full glass hover:bg-white/10 spring-press"
      >
        <X size={20} className="text-white/70" />
      </button>

      <div className="min-h-full flex flex-col items-center px-5 py-10 max-w-lg mx-auto">
        {/* Hero */}
        <div className="text-center fade-up">
          <div className="text-6xl mb-4">👑</div>
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
            Enjoy Music Without Limits
          </h1>
          <p className="mt-3 text-white/50 text-sm leading-relaxed max-w-sm mx-auto">
            Pay once — premium for life. No subscriptions. No hidden fees.
          </p>
        </div>

        {/* Trust badge */}
        <div
          className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full fade-up"
          style={{
            background: "linear-gradient(90deg, oklch(0.3 0.1 50 / 0.3), oklch(0.25 0.08 40 / 0.2))",
            border: "1px solid oklch(0.5 0.15 50 / 0.3)",
            animationDelay: "100ms",
          }}
        >
          <span>⭐</span>
          <span className="text-xs font-medium" style={{ color: "oklch(0.85 0.12 50)" }}>
            Trusted by 2M+ music lovers
          </span>
        </div>

        {/* Features */}
        <div className="mt-8 w-full space-y-3 fade-up" style={{ animationDelay: "200ms" }}>
          {[
            { emoji: "🚫", text: "100% ad-free music" },
            { emoji: "⚡", text: "Smooth music streaming" },
            { emoji: "🔒", text: "Unlock all future premium features" },
          ].map(({ emoji, text }) => (
            <div
              key={text}
              className="flex items-center gap-4 px-4 py-3.5 rounded-2xl"
              style={{ background: "oklch(0.18 0.03 285 / 0.6)", border: "1px solid oklch(0.97 0.01 285 / 0.08)" }}
            >
              <span className="text-xl shrink-0">{emoji}</span>
              <span className="text-sm font-medium text-white">{text}</span>
            </div>
          ))}
        </div>

        {/* Pricing card */}
        <div
          className="mt-8 w-full rounded-2xl p-5 fade-up"
          style={{
            border: "1px solid oklch(0.72 0.22 330 / 0.3)",
            background: "linear-gradient(135deg, oklch(0.18 0.04 330 / 0.3), oklch(0.16 0.03 285 / 0.4))",
            animationDelay: "300ms",
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base font-semibold text-white">Lifetime Access</div>
              <div className="text-xs mt-0.5" style={{ color: "oklch(0.72 0.22 330)" }}>
                Special launch price
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-white">₹99</div>
              <div className="text-[10px] text-white/50">one-time</div>
            </div>
          </div>
          <div className="mt-2 text-xs text-white/40">Pay once, own forever</div>
        </div>

        {/* CTA */}
        <button
          onClick={handleUnlock}
          disabled={processing}
          className="mt-6 w-full py-4 rounded-full font-semibold text-white text-base transition-all hover:scale-[1.02] active:scale-95 spring-press disabled:opacity-60 fade-up"
          style={{
            background: "linear-gradient(90deg, oklch(0.72 0.22 330), oklch(0.65 0.25 330))",
            boxShadow: "0 0 40px -8px oklch(0.72 0.22 330 / 0.6)",
            animationDelay: "400ms",
          }}
        >
          {processing ? (
            <span className="inline-flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processing...
            </span>
          ) : (
            "Unlock Premium"
          )}
        </button>

        {/* Restore */}
        <div
          className="mt-4 w-full rounded-2xl p-4 fade-up"
          style={{
            background: "oklch(0.16 0.03 285)",
            border: "1px solid oklch(0.97 0.01 285 / 0.08)",
            animationDelay: "500ms",
          }}
        >
          {!restoreMode ? (
            <button
              onClick={() => setRestoreMode(true)}
              className="w-full text-left text-sm text-white/60 hover:text-white/80 transition-colors"
            >
              Already purchased? <span className="text-white/80">Restore your Premium purchase →</span>
            </button>
          ) : (
            <div className="space-y-3">
              <div className="text-sm text-white/70 font-medium">Restore Purchase</div>
              <input
                type="email"
                value={restoreEmail}
                onChange={(e) => setRestoreEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[oklch(0.72_0.22_330)] text-white placeholder:text-white/30"
              />
              <button
                onClick={handleRestore}
                className="w-full py-2.5 rounded-xl bg-white/10 text-sm font-medium text-white hover:bg-white/15 active:scale-95 transition-all"
              >
                Restore
              </button>
              {restoreResult === "found" && (
                <div className="text-xs text-green-400">✅ Premium restored! Redirecting...</div>
              )}
              {restoreResult === "not-found" && (
                <div className="text-xs" style={{ color: "oklch(0.66 0.24 25)" }}>
                  No purchase found for this email. Please check and try again.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <button className="text-xs text-white/30 hover:text-white/50 underline transition-colors">
            Privacy Policy
          </button>
        </div>
      </div>
    </div>
  );
}
