import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart2,
  Check,
  ChevronLeft,
  Coins,
  DollarSign,
  Loader2,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { useSetProfile } from "../hooks/useQueries";

type RiskLevel = "Conservative" | "Moderate" | "Aggressive";
type Currency = "USD" | "ICP";

interface OnboardingState {
  displayName: string;
  riskPreference: RiskLevel | "";
  preferredCurrency: Currency;
}

const RISK_OPTIONS: {
  value: RiskLevel;
  icon: React.ElementType;
  title: string;
  subtitle: string;
  color: string;
  borderClass: string;
  selectedClass: string;
}[] = [
  {
    value: "Conservative",
    icon: TrendingDown,
    title: "Conservative",
    subtitle: "30 trades/month max",
    color: "text-success",
    borderClass: "border-success/20 hover:border-success/50",
    selectedClass: "border-success bg-success/10 shadow-neon-green",
  },
  {
    value: "Moderate",
    icon: BarChart2,
    title: "Moderate",
    subtitle: "100 trades/month max",
    color: "text-primary",
    borderClass: "border-primary/20 hover:border-primary/50",
    selectedClass: "border-primary bg-primary/10 shadow-neon-cyan",
  },
  {
    value: "Aggressive",
    icon: TrendingUp,
    title: "Aggressive",
    subtitle: "300 trades/month max",
    color: "text-secondary",
    borderClass: "border-secondary/20 hover:border-secondary/50",
    selectedClass: "border-secondary bg-secondary/10 shadow-neon-purple",
  },
];

const RISK_DESCRIPTIONS: Record<RiskLevel, string> = {
  Conservative:
    "Lower risk, steady approach. Perfect for long-term wealth preservation.",
  Moderate: "Balanced risk and reward. The optimal choice for most traders.",
  Aggressive:
    "High risk, maximum exposure. For experienced traders seeking high returns.",
};

function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <div
      className="flex items-center gap-2"
      aria-label={`Step ${step} of ${total}`}
    >
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={`dot-${i + 1}`}
          className={cn(
            "h-1.5 rounded-full transition-all duration-300",
            i + 1 <= step ? "bg-primary w-6" : "bg-border w-3",
            i + 1 === step ? "shadow-neon-cyan-sm" : "",
          )}
        />
      ))}
    </div>
  );
}

export default function Onboarding() {
  const navigate = useNavigate();
  const setProfile = useSetProfile();
  const [step, setStep] = useState(1);
  const [state, setState] = useState<OnboardingState>({
    displayName: "",
    riskPreference: "",
    preferredCurrency: "USD",
  });

  const totalSteps = 5;
  const next = () => setStep((s) => Math.min(s + 1, totalSteps));
  const back = () => setStep((s) => Math.max(s - 1, 1));

  const handleLaunch = async () => {
    if (!state.riskPreference) return;
    try {
      await setProfile.mutateAsync({
        name: state.displayName,
        currency: state.preferredCurrency,
        risk: state.riskPreference,
      });
      navigate({ to: "/", replace: true });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save profile",
      );
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col items-center justify-center px-4">
      <div className="absolute inset-0 grid-bg opacity-30" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-primary/5 blur-[80px] rounded-full" />

      <div className="relative z-10 w-full max-w-lg">
        {step > 1 && step < 5 && (
          <div className="flex items-center justify-between mb-8">
            <button
              type="button"
              onClick={back}
              data-ocid="onboarding.back.button"
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft size={16} />
              Back
            </button>
            <ProgressDots step={step} total={totalSteps} />
            <span className="text-xs text-muted-foreground">
              {step} / {totalSteps}
            </span>
          </div>
        )}

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35 }}
              className="flex flex-col items-center text-center"
              data-ocid="onboarding.welcome.panel"
            >
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-primary/30 blur-2xl rounded-full scale-150" />
                <div className="relative w-20 h-20 rounded-2xl bg-card border border-primary/30 flex items-center justify-center shadow-neon-cyan">
                  <Zap className="text-primary" size={40} />
                </div>
              </div>
              <h1 className="text-4xl font-bold tracking-wider mb-2">
                <span className="neon-text-cyan">ICP</span>
                <span className="text-foreground"> ETX</span>
              </h1>
              <p className="text-lg text-muted-foreground mb-2">
                Your autonomous ICP trading platform
              </p>
              <p className="text-sm text-muted-foreground/70 mb-10 max-w-sm">
                Let's get you set up with a quick profile. This takes less than
                a minute.
              </p>
              <Button
                onClick={next}
                data-ocid="onboarding.get-started.button"
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-neon-cyan font-semibold px-10 gap-2"
              >
                Get Started
                <ArrowRight size={18} />
              </Button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35 }}
              className="bg-card border border-border rounded-xl p-8 shadow-card-glow"
              data-ocid="onboarding.name.panel"
            >
              <h2 className="text-xl font-bold text-foreground mb-1">
                What should we call you?
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                Optional — you can skip this step.
              </p>
              <div className="space-y-4 mb-8">
                <div>
                  <Label
                    htmlFor="displayName"
                    className="text-sm text-muted-foreground mb-2 block"
                  >
                    Display Name
                  </Label>
                  <Input
                    id="displayName"
                    placeholder="e.g. Alex, ICP Whale, CryptoNomad..."
                    value={state.displayName}
                    onChange={(e) =>
                      setState((s) => ({ ...s, displayName: e.target.value }))
                    }
                    data-ocid="onboarding.name.input"
                    className="bg-background border-border focus:border-primary focus:ring-primary/20"
                    maxLength={40}
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={next}
                  data-ocid="onboarding.name.skip.button"
                  className="flex-1 border-border text-muted-foreground hover:text-foreground"
                >
                  Skip
                </Button>
                <Button
                  onClick={next}
                  data-ocid="onboarding.name.next.button"
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Next <ArrowRight size={16} className="ml-2" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35 }}
              className="bg-card border border-border rounded-xl p-8 shadow-card-glow"
              data-ocid="onboarding.risk.panel"
            >
              <h2 className="text-xl font-bold text-foreground mb-1">
                Risk Preference
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                Choose your trading style. You can change this later.
              </p>
              <div className="space-y-3 mb-8">
                {RISK_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setState((s) => ({ ...s, riskPreference: opt.value }))
                    }
                    data-ocid={`onboarding.risk-${opt.value.toLowerCase()}.button`}
                    className={cn(
                      "w-full flex items-center gap-4 p-4 rounded-lg border transition-all duration-200 text-left",
                      state.riskPreference === opt.value
                        ? opt.selectedClass
                        : cn(
                            "bg-background border-border hover:bg-accent",
                            opt.borderClass,
                          ),
                    )}
                  >
                    <div
                      className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center bg-background/50",
                        opt.color,
                      )}
                    >
                      <opt.icon size={22} />
                    </div>
                    <div className="flex-1">
                      <p className={cn("font-semibold text-sm", opt.color)}>
                        {opt.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {opt.subtitle}
                      </p>
                      {state.riskPreference === opt.value && (
                        <p className="text-xs text-foreground/70 mt-1">
                          {RISK_DESCRIPTIONS[opt.value]}
                        </p>
                      )}
                    </div>
                    {state.riskPreference === opt.value && (
                      <Check size={18} className={opt.color} />
                    )}
                  </button>
                ))}
              </div>
              <Button
                onClick={next}
                disabled={!state.riskPreference}
                data-ocid="onboarding.risk.next.button"
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Next <ArrowRight size={16} className="ml-2" />
              </Button>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35 }}
              className="bg-card border border-border rounded-xl p-8 shadow-card-glow"
              data-ocid="onboarding.currency.panel"
            >
              <h2 className="text-xl font-bold text-foreground mb-1">
                Preferred Currency Display
              </h2>
              <p className="text-sm text-muted-foreground mb-8">
                How should portfolio values be displayed?
              </p>
              <div className="flex gap-4 mb-8">
                {(["USD", "ICP"] as Currency[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() =>
                      setState((s) => ({ ...s, preferredCurrency: c }))
                    }
                    data-ocid={`onboarding.currency-${c.toLowerCase()}.button`}
                    className={cn(
                      "flex-1 flex flex-col items-center gap-3 p-6 rounded-xl border transition-all duration-200",
                      state.preferredCurrency === c
                        ? "border-primary bg-primary/10 shadow-neon-cyan"
                        : "border-border bg-background hover:border-primary/30 hover:bg-accent",
                    )}
                  >
                    {c === "USD" ? (
                      <DollarSign
                        size={32}
                        className={cn(
                          state.preferredCurrency === c
                            ? "text-primary"
                            : "text-muted-foreground",
                        )}
                      />
                    ) : (
                      <Coins
                        size={32}
                        className={cn(
                          state.preferredCurrency === c
                            ? "text-primary"
                            : "text-muted-foreground",
                        )}
                      />
                    )}
                    <span
                      className={cn(
                        "font-bold text-lg",
                        state.preferredCurrency === c
                          ? "text-primary"
                          : "text-foreground",
                      )}
                    >
                      {c}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {c === "USD" ? "US Dollar" : "Internet Computer"}
                    </span>
                    {state.preferredCurrency === c && (
                      <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                        <Check size={12} className="text-primary-foreground" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <Button
                onClick={next}
                data-ocid="onboarding.currency.next.button"
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Next <ArrowRight size={16} className="ml-2" />
              </Button>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div
              key="step5"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35 }}
              className="bg-card border border-border rounded-xl p-8 shadow-card-glow"
              data-ocid="onboarding.confirm.panel"
            >
              <div className="text-center mb-8">
                <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-4">
                  <Check className="text-primary" size={28} />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-1">
                  You're all set!
                </h2>
                <p className="text-sm text-muted-foreground">
                  Here's a summary of your profile.
                </p>
              </div>
              <div className="space-y-3 mb-8">
                <div className="flex items-center justify-between p-3 rounded-lg bg-background border border-border">
                  <span className="text-sm text-muted-foreground">
                    Display Name
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {state.displayName || (
                      <span className="italic text-muted-foreground">
                        Not set
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-background border border-border">
                  <span className="text-sm text-muted-foreground">
                    Risk Preference
                  </span>
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      state.riskPreference === "Conservative"
                        ? "text-success"
                        : state.riskPreference === "Moderate"
                          ? "text-primary"
                          : "text-secondary",
                    )}
                  >
                    {state.riskPreference || "Not set"}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-background border border-border">
                  <span className="text-sm text-muted-foreground">
                    Currency Display
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {state.preferredCurrency}
                  </span>
                </div>
              </div>
              <Button
                onClick={handleLaunch}
                disabled={setProfile.isPending || !state.riskPreference}
                data-ocid="onboarding.launch.button"
                size="lg"
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-neon-cyan font-bold"
              >
                {setProfile.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Launching...
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-5 w-5" />
                    Launch ICP ETX
                  </>
                )}
              </Button>
              <button
                type="button"
                onClick={back}
                data-ocid="onboarding.confirm.back.button"
                className="mt-3 w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
              >
                Edit preferences
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
