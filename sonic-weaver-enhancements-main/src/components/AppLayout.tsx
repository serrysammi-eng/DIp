// App layout — sidebar (desktop) + bottom nav (mobile) + global players.
// Onboarding renders as a popup overlay above the shell for new users; the
// underlying app is always present so closing/completing onboarding never
// reloads the page or remounts the player.
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Home, Library, Search, Settings, Sparkles, Crown } from "lucide-react";
import { type ReactNode, useState, useEffect } from "react";
import { Logo } from "./Logo";
import { MiniPlayer } from "./MiniPlayer";
import { FullScreenPlayer } from "./FullScreenPlayer";
import { OnboardingModal } from "./OnboardingModal";
import { ParticleBackground } from "./ParticleBackground";
import { usePlayer, usePrefs } from "../lib/store";
import { AdGateway } from "./AdGateway";
import { BannerAd } from "./BannerAd";
import { PremiumPaywall } from "./PremiumPaywall";
import { LoginModal } from "./LoginModal";

const NAV = [
  { to: "/app", label: "Home", icon: Home },
  { to: "/search", label: "Search", icon: Search },
  { to: "/library", label: "Library", icon: Library },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppLayout({ children }: { children: ReactNode }) {
  const { prefs } = usePrefs();
  const loc = useLocation();
  const { state, player } = usePlayer();
  const playing = !!state.current;
  const navigate = useNavigate();

  const [showPaywall, setShowPaywall] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showGateway, setShowGateway] = useState(false);

  useEffect(() => {
    const handlePaywall = () => setShowPaywall(true);
    const handleLogin = () => setShowLogin(true);
    window.addEventListener("open-paywall", handlePaywall);
    window.addEventListener("open-login", handleLogin);
    return () => {
      window.removeEventListener("open-paywall", handlePaywall);
      window.removeEventListener("open-login", handleLogin);
    };
  }, []);

  useEffect(() => {
    // Only show gateway if onboarded, session expired, and NOT premium
    if (prefs.onboarded && !prefs.isPremium && prefs.sessionExpiry < Date.now()) {
      setShowGateway(true);
    }
  }, [prefs.onboarded, prefs.isPremium, prefs.sessionExpiry]);

  // Closing the full-screen player on nav. We delay nav slightly so the user
  // sees the collapse animation before the route swaps in. Song keeps playing.
  const navClose = (to: string) => (e: React.MouseEvent) => {
    if (state.fullscreen) {
      e.preventDefault();
      player?.setFullscreen(false);
      setTimeout(() => { navigate({ to }); }, 260);
    }
  };

  const padClass = playing
    ? "pb-[170px] md:pb-32"
    : "pb-20 md:pb-12";

  return (
    <div className="min-h-screen md:flex">
      {/* Anti-gravity particle background */}
      <ParticleBackground />

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 p-5 gap-2 sticky top-0 h-screen">
        <div className="px-2 py-3"><Logo /></div>
        <nav className="mt-2 flex flex-col gap-0.5">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = to === "/app" ? loc.pathname === "/app" : loc.pathname.startsWith(to);
            return (
              <Link key={to} to={to} onClick={navClose(to)}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 magnetic-hover ${
                  active
                    ? "bg-white/10 text-white shadow-[inset_0_0_20px_oklch(0.72_0.22_330/0.1)]"
                    : "text-white/70 hover:text-white hover:bg-white/5"
                }`}>
                <Icon size={18} className={active ? "drop-shadow-[0_0_6px_oklch(0.72_0.22_330/0.6)]" : ""} />{label}
                {active && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-gradient-to-r from-[oklch(0.78_0.2_330)] to-[oklch(0.72_0.2_200)]" />
                )}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex flex-col gap-3">
          <div className="glass-glow rounded-2xl p-4 float-drift">
            <div className="flex items-center gap-2 text-sm">
              <Sparkles size={14} className="text-[oklch(0.78_0.2_330)]" />
              <span className="font-medium">AI DJ</span>
            </div>
            <p className="mt-1 text-xs text-white/60">
              Toggle live mixing in the player or in Settings.
            </p>
          </div>
        </div>
      </aside>

      <main className={`flex-1 min-w-0 ${padClass}`}>
        <div className="md:hidden flex items-center justify-between p-4">
          <Logo />
        </div>
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 glass-strong border-t border-white/10">
        <div className="grid grid-cols-4">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = to === "/app" ? loc.pathname === "/app" : loc.pathname.startsWith(to);
            return (
              <Link key={to} to={to} onClick={navClose(to)} className="flex flex-col items-center gap-0.5 py-2.5 text-[11px] transition-all duration-300">
                <Icon size={20} className={active ? "text-white drop-shadow-[0_0_8px_oklch(0.72_0.22_330/0.6)]" : "text-white/55"} />
                <span className={active ? "text-white" : "text-white/55"}>{label}</span>
                {active && (
                  <span className="w-4 h-0.5 rounded-full bg-gradient-to-r from-[oklch(0.78_0.2_330)] to-[oklch(0.72_0.2_200)] mt-0.5" />
                )}
              </Link>
            );
          })}
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>


      <MiniPlayer />
      <FullScreenPlayer />
      {!prefs.onboarded && <OnboardingModal />}
      
      {showGateway && <AdGateway onComplete={() => setShowGateway(false)} />}
      <PremiumPaywall 
        open={showPaywall} 
        onClose={() => setShowPaywall(false)} 
        onNeedLogin={() => {
          setShowPaywall(false);
          setShowLogin(true);
        }} 
      />
      <LoginModal 
        open={showLogin} 
        onClose={() => setShowLogin(false)} 
        onSuccess={() => {
          setShowLogin(false);
          setShowPaywall(true); // Bring them back to paywall to finish payment
        }} 
      />
    </div>
  );
}
