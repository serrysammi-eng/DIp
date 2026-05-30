// AdGateway — A compulsory 30-second full-screen ad gateway for free users.
// Shows up on app launch if session has expired. Cannot be bypassed.
import { useState, useEffect } from "react";
import { usePrefs } from "../lib/store";

export function AdGateway({ onComplete }: { onComplete: () => void }) {
  const [timeLeft, setTimeLeft] = useState(30);
  const { setSessionExpiry } = usePrefs();

  useEffect(() => {
    // Initialize the AdMob/AdSense ad unit once mounted
    try {
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
    } catch (e) {
      console.error("AdMob initialization error", e);
    }

    if (timeLeft <= 0) return;
    const t = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearInterval(t);
  }, [timeLeft]);

  const handleSkip = () => {
    if (timeLeft > 0) return;
    setSessionExpiry();
    onComplete();
  };

  return (
    <div
      id="ad-gateway"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4 bg-black/95 backdrop-blur-xl"
      style={{ transition: "opacity 0.4s ease" }}
    >
      <div className="text-center fade-up max-w-sm w-full">
        {/* AdMob Interstitial Unit */}
        <div 
          className="aspect-square w-full max-w-[300px] mx-auto rounded-xl mb-8 relative overflow-hidden flex flex-col items-center justify-center bg-black/40"
        >
          <ins
            className="adsbygoogle"
            style={{ display: "block", width: "300px", height: "300px" }}
            data-ad-client="ca-pub-8983378905523143"
            data-ad-slot="1048571941"
            data-ad-format="auto"
            data-full-width-responsive="true"
          ></ins>
        </div>

        {/* Action area */}
        <div className="space-y-4">
          <button
            onClick={handleSkip}
            disabled={timeLeft > 0}
            className={`relative w-full py-4 rounded-full font-semibold transition-all overflow-hidden ${
              timeLeft > 0 
                ? "bg-white/5 text-white/30 cursor-not-allowed" 
                : "text-black bg-white hover:scale-[1.02] active:scale-95 spring-press"
            }`}
          >
            {/* Progress ring background when disabled */}
            {timeLeft > 0 && (
              <div 
                className="absolute inset-0 bg-white/10" 
                style={{ width: `${((30 - timeLeft) / 30) * 100}%`, transition: "width 1s linear" }} 
              />
            )}
            
            <span className="relative z-10 flex items-center justify-center gap-2">
              {timeLeft > 0 ? (
                <>Skip ad in {timeLeft}s</>
              ) : (
                <>Continue to App</>
              )}
            </span>
          </button>
          
          <div className="text-xs text-white/40">
            Tired of interruptions? Go Premium to remove all ads forever.
          </div>
        </div>
      </div>
    </div>
  );
}
