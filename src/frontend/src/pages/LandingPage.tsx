import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2, Shield, TrendingUp, Zap } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { useInternetIdentity } from "../hooks/useInternetIdentity";

function PairTradesIcon({
  className,
  size,
}: { className?: string; size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size ?? 24}
      height={size ?? 24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <title>Pair Trades</title>
      <path d="m17 3 4 4-4 4" />
      <path d="M3 7h18" />
      <path d="m7 21-4-4 4-4" />
      <path d="M21 17H3" />
    </svg>
  );
}

export default function LandingPage() {
  const { login, isLoggingIn } = useInternetIdentity();
  const [isStarting, setIsStarting] = useState(false);

  const handleLogin = async () => {
    setIsStarting(true);
    sessionStorage.setItem("pending_auth_check", "true");
    try {
      await login();
    } catch {
      sessionStorage.removeItem("pending_auth_check");
      setIsStarting(false);
    }
  };

  const loading = isLoggingIn || isStarting;

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col items-center justify-center px-4">
      {/* Grid background */}
      <div className="absolute inset-0 grid-bg opacity-50" />

      {/* Top gradient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/5 blur-[80px] rounded-full" />
      <div className="absolute top-1/4 right-1/4 w-[200px] h-[200px] bg-secondary/5 blur-[60px] rounded-full" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-2xl mx-auto">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center gap-4 mb-8"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-primary/30 blur-2xl rounded-full scale-150" />
            <div className="relative w-20 h-20 rounded-2xl bg-card border border-primary/30 flex items-center justify-center shadow-neon-cyan">
              <Zap className="text-primary" size={40} />
            </div>
          </div>

          <div>
            <h1 className="text-5xl font-bold tracking-widest">
              <span className="neon-text-cyan">ICP</span>
              <span className="text-foreground"> ETX</span>
            </h1>
          </div>
        </motion.div>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-xl text-muted-foreground mb-4 leading-relaxed"
        >
          Your autonomous ICP trading platform
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="text-sm text-muted-foreground/70 mb-12 max-w-md"
        >
          Execute precision pair trades, build automated baskets, and take full
          control of your ICP portfolio with a single identity.
        </motion.p>

        {/* Login button */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        >
          <Button
            onClick={handleLogin}
            disabled={loading}
            data-ocid="landing.login.button"
            size="lg"
            className="relative group bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-base px-8 py-6 rounded-lg shadow-neon-cyan transition-all duration-300 hover:shadow-neon-cyan disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Shield className="mr-2 h-5 w-5" />
                Login with Internet Identity
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </>
            )}
          </Button>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-xl"
        >
          {[
            {
              Icon: PairTradesIcon,
              label: "Pair Trades",
              desc: "Precision ICP pair trading",
            },
            {
              Icon: TrendingUp,
              label: "Baskets",
              desc: "Automated trade bundles",
            },
            { Icon: Shield, label: "Secure", desc: "Internet Identity only" },
          ].map(({ Icon, label, desc }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-2 p-4 rounded-lg bg-card border border-border/50 backdrop-blur-sm"
            >
              <Icon className="text-primary" size={20} />
              <span className="text-sm font-semibold text-foreground">
                {label}
              </span>
              <span className="text-xs text-muted-foreground text-center">
                {desc}
              </span>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="absolute bottom-6 text-xs text-muted-foreground/50"
      >
        © {new Date().getFullYear()}. Built with ♥ using{" "}
        <a
          href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-primary transition-colors"
        >
          caffeine.ai
        </a>
      </motion.footer>
    </div>
  );
}
