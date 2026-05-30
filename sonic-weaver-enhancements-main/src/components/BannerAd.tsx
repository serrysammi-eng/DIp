// BannerAd — Non-intrusive banner ad for free users.
// Displays above the mini player. Automatically hidden if premium.
import { useState, useEffect } from "react";

export function BannerAd() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Smooth fade in after a brief delay
    const t = setTimeout(() => {
      setVisible(true);
      // Initialize the AdMob/AdSense ad unit once it's visible
      try {
        ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
      } catch (e) {
        console.error("AdMob initialization error", e);
      }
    }, 1000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div 
      className="banner-ad w-full px-2 pb-2 md:px-4 md:pb-4 transition-opacity duration-1000"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <div className="relative w-full max-w-3xl mx-auto rounded-xl overflow-hidden shadow-lg bg-black/40 backdrop-blur-md">
        {/* AdMob Banner Unit */}
        <div className="min-h-[60px] flex items-center justify-center relative">
          <ins
            className="adsbygoogle"
            style={{ display: "block", minWidth: "320px", height: "60px" }}
            data-ad-client="ca-pub-8983378905523143"
            data-ad-slot="3490372222"
            data-ad-format="horizontal"
            data-full-width-responsive="true"
          ></ins>
        </div>
        
        {/* Subtle upgrade CTA */}
        <button 
          onClick={() => window.dispatchEvent(new CustomEvent("open-paywall"))}
          className="absolute top-1 right-2 text-[10px] text-white/40 hover:text-white/80 transition-colors z-10 bg-black/50 px-1.5 rounded"
        >
          Remove Ads
        </button>
      </div>
    </div>
  );
}
