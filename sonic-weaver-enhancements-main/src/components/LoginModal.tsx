// Login Modal — triggered ONLY from the Premium paywall flow.
// Free users never see this. Login is conditional on buying premium.
import { useState } from "react";
import { usePrefs } from "../lib/store";
import { X } from "lucide-react";
import { auth, googleProvider, appleProvider } from "../lib/firebase";
import { signInWithPopup } from "firebase/auth";

type LoginModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function LoginModal({ open, onClose, onSuccess }: LoginModalProps) {
  const { setPrefs } = usePrefs();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const handleSocialLogin = async (provider: "google" | "apple") => {
    setError("");
    setLoading(true);
    
    // If Firebase isn't configured yet (missing API keys), simulate login
    if (!auth) {
      setTimeout(() => {
        setPrefs((p) => ({
          ...p,
          userEmail: `user_${provider}_${Date.now()}@sonic.app`,
          userId: `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        }));
        setLoading(false);
        onSuccess();
      }, 1500);
      return;
    }

    try {
      const authProvider = provider === "google" ? googleProvider : appleProvider;
      const result = await signInWithPopup(auth, authProvider);
      
      setPrefs((p) => ({
        ...p,
        userEmail: result.user.email || "",
        userId: result.user.uid,
        name: result.user.displayName || p.name,
      }));
      setLoading(false);
      onSuccess();
    } catch (err: any) {
      console.error("Auth error:", err);
      setError(err.message || "Failed to authenticate. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[75] flex items-end md:items-center justify-center p-0 md:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full md:max-w-md rounded-t-3xl md:rounded-3xl overflow-hidden will-change-transform fade-up"
        style={{
          background: "linear-gradient(180deg, oklch(0.20 0.04 285 / 0.95), oklch(0.14 0.025 285 / 0.98))",
          backdropFilter: "blur(22px)",
          WebkitBackdropFilter: "blur(22px)",
          border: "1px solid oklch(0.97 0.01 285 / 0.1)",
        }}
      >
        {/* Grabber + close */}
        <div className="md:hidden flex justify-center pt-2">
          <div className="w-10 h-1.5 rounded-full bg-white/25" />
        </div>
        <div className="flex items-center justify-between px-5 pt-4 md:pt-6">
          <h2 className="text-xl font-semibold text-white tracking-tight">
            Sign In
          </h2>
          <button
            onClick={onClose}
            className="w-9 h-9 grid place-items-center rounded-full glass hover:bg-white/10 spring-press"
          >
            <X size={18} />
          </button>
        </div>
        <p className="px-5 mt-1 text-sm text-white/50 mb-6">
          Connect your account to save your Premium purchase permanently.
        </p>

        {error && (
          <div className="px-5 mb-4 text-xs" style={{ color: "oklch(0.66 0.24 25)" }}>
            {error}
          </div>
        )}

        {/* Social buttons */}
        <div className="px-5 pb-8 flex flex-col gap-3">
          <button
            onClick={() => handleSocialLogin("apple")}
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-white text-black font-semibold text-sm flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all spring-press disabled:opacity-60"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : (
              <>
                <svg viewBox="0 0 384 512" className="w-4 h-4 fill-current"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.1-44.6-35.9-2.8-74.3 22.7-93.1 22.7-18.9 0-46.5-20.9-74.6-20.9-38.3 0-77.4 23.3-97.4 62C-10.4 278.3 12.1 418.1 63.8 493.5c25 36.4 55.4 75.3 94.6 73.8 37.1-1.5 53.3-24.7 97.4-24.7 43.8 0 58.6 24.7 97.7 23.9 40.2-.8 67.5-36.7 90.9-72 27.6-41.5 38.6-81.8 39-83.6-1-1-76.3-29.6-76.7-142.2zM245.9 116.1c20.3-24.7 34.6-58.8 30.9-93.4-29.4 1.2-64.9 19.9-86.2 44.8-17.7 20.3-33.8 55.1-29.5 88.6 32.7 2.5 64.9-15.1 84.8-40z"/></svg>
                Continue with Apple
              </>
            )}
          </button>

          <button
            onClick={() => handleSocialLogin("google")}
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-white/5 border border-white/10 text-white font-semibold text-sm flex items-center justify-center gap-3 hover:bg-white/10 active:scale-95 transition-all spring-press disabled:opacity-60"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <svg viewBox="0 0 488 512" className="w-4 h-4 fill-current"><path d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"/></svg>
                Continue with Google
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
