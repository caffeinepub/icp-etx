import TradeFrequencyBar from "@/components/TradeFrequencyBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTradeFrequencyStatus } from "@/hooks/useQueries";
import { useProfile } from "@/hooks/useQueries";
import { motion } from "motion/react";

const INDICATOR_CATEGORIES = [
  {
    name: "Momentum / Oscillator",
    color: "text-primary border-primary/30 bg-primary/5",
    badge: "bg-primary/20 text-primary",
    indicators: [
      {
        name: "RSI",
        params: "Period: 14",
        desc: "Relative Strength Index measures momentum. Overbought >70, oversold <30.",
        signal: "Reversal signal at extremes",
      },
      {
        name: "Stochastic",
        params: "K: 14, D: 3, Smooth: 3",
        desc: "Compares closing price to range over lookback period. Overbought >80, oversold <20.",
        signal: "%K/%D crossover signals",
      },
      {
        name: "CCI",
        params: "Period: 20",
        desc: "Commodity Channel Index measures deviation from average price. Extremes >±100 signal reversals.",
        signal: "Zero-line and ±100 crossovers",
      },
    ],
  },
  {
    name: "Trend",
    color: "text-secondary border-secondary/30 bg-secondary/5",
    badge: "bg-secondary/20 text-secondary",
    indicators: [
      {
        name: "MACD",
        params: "Fast: 12, Slow: 26, Signal: 9",
        desc: "Moving Average Convergence Divergence tracks trend momentum and direction.",
        signal: "Signal line crossovers, histogram divergence",
      },
      {
        name: "EMA Crossover",
        params: "Short: 50, Long: 200",
        desc: "Golden cross (50 above 200) signals bull trend; death cross signals bear trend.",
        signal: "Bullish/bearish crossover events",
      },
      {
        name: "ADX",
        params: "Period: 14",
        desc: "Average Directional Index measures trend strength. >25 strong trend, <20 weak/ranging.",
        signal: "Trend strength filter (>25 = trade trend)",
      },
      {
        name: "Ichimoku Cloud",
        params: "9, 26, 52, 26",
        desc: "All-in-one indicator providing support/resistance, trend direction, and momentum from 5 components.",
        signal: "Price vs. cloud, TK cross, Kumo breakout",
      },
    ],
  },
  {
    name: "Volatility / Risk",
    color: "text-warning border-warning/30 bg-warning/5",
    badge: "bg-warning/20 text-warning",
    indicators: [
      {
        name: "Bollinger Bands",
        params: "Period: 20, StdDev: 2",
        desc: "Price channels ±2 standard deviations. Squeeze = low volatility, expansion = breakout incoming.",
        signal: "Band touches, squeeze breakouts",
      },
      {
        name: "ATR",
        params: "Period: 14",
        desc: "Average True Range measures market volatility in price terms. Used for stop-loss sizing.",
        signal: "Volatility level for position sizing",
      },
      {
        name: "Historical Volatility",
        params: "Period: 20",
        desc: "Annualized standard deviation of log returns. Baseline for option pricing and risk models.",
        signal: "Regime change detection",
      },
    ],
  },
  {
    name: "Volume / Confirmation",
    color: "text-success border-success/30 bg-success/5",
    badge: "bg-success/20 text-success",
    indicators: [
      {
        name: "OBV",
        params: "Requires volume data",
        desc: "On-Balance Volume accumulates volume in the direction of price movement. Trend confirmation.",
        signal: "OBV divergence from price",
      },
      {
        name: "VWAP",
        params: "Requires volume data",
        desc: "Volume-Weighted Average Price. Institutional benchmark; price above = bullish bias.",
        signal: "Price above/below VWAP",
      },
    ],
  },
  {
    name: "Fibonacci",
    color: "text-primary border-primary/30 bg-primary/5",
    badge: "bg-primary/20 text-primary",
    levels: ["23.6%", "38.2%", "50%", "61.8%", "78.6%", "100%", "161.8%"],
    desc: "Key retracement and extension levels derived from the Fibonacci sequence. Used for support/resistance and price targets.",
    signal: "Price reaction at key levels, confluence with other indicators",
  },
  {
    name: "Quantitative",
    color: "text-secondary border-secondary/30 bg-secondary/5",
    badge: "bg-secondary/20 text-secondary",
    indicators: [
      {
        name: "Sharpe Ratio",
        params: "Risk-free rate: 2%",
        desc: "Risk-adjusted return. >1 good, >2 excellent, <0 losing money on a risk-adjusted basis.",
        signal: "Portfolio efficiency score",
      },
      {
        name: "Maximum Drawdown",
        params: "Full history",
        desc: "Largest peak-to-trough decline. Critical for risk tolerance assessment.",
        signal: "Worst-case loss from peak",
      },
      {
        name: "Asset Correlation",
        params: "Rolling 30-day",
        desc: "Pearson correlation between assets. Low correlation = better diversification in baskets.",
        signal: "Correlation <0.5 preferred for basket slots",
      },
    ],
  },
];

function FrequencyStatCards() {
  const { data } = useTradeFrequencyStatus();
  const { riskPreference } = useProfile();
  const usedRaw = data?.usedThisMonth ?? 0;
  const limitRaw =
    data?.limitThisMonth ??
    (riskPreference === "Aggressive"
      ? 300
      : riskPreference === "Conservative"
        ? 30
        : 100);
  const resetsAtRaw = data?.resetsAt ?? 0;

  const used = Number(usedRaw);
  const limit = Number(limitRaw);
  const resetsAt = Number(resetsAtRaw);

  const daysLeft =
    resetsAt > 0
      ? Math.max(0, Math.ceil((resetsAt / 1_000_000 - Date.now()) / 86_400_000))
      : 30;
  const pctUsed = limit > 0 ? ((used / limit) * 100).toFixed(1) : "0.0";

  const stats = [
    { label: "Used This Month", value: used.toString(), sub: "trades" },
    {
      label: "Monthly Cap",
      value: limit.toString(),
      sub: riskPreference || "Moderate",
    },
    { label: "Resets In", value: `${daysLeft}d`, sub: "days remaining" },
    { label: "Usage", value: `${pctUsed}%`, sub: "of monthly cap" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map((s) => (
        <Card key={s.label} className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
            <p className="text-2xl font-bold text-foreground font-mono">
              {s.value}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function Risk() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-4 sm:p-6 space-y-8 max-w-4xl"
      data-ocid="risk.page"
    >
      <div>
        <h1 className="text-2xl font-bold text-foreground">Risk</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Trade frequency limits and indicator reference for agent strategies
        </p>
      </div>

      {/* Trade Frequency Section */}
      <section className="space-y-4" data-ocid="risk.trade-freq.section">
        <h2 className="text-lg font-semibold text-foreground">
          Trade Frequency
        </h2>

        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <TradeFrequencyBar />
          </CardContent>
        </Card>

        <FrequencyStatCards />

        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Monthly trade caps scale by risk tier:{" "}
              <span className="text-primary font-medium">
                Conservative 30/mo
              </span>
              ,{" "}
              <span className="text-warning font-medium">Moderate 100/mo</span>,{" "}
              <span className="text-destructive font-medium">
                Aggressive 300/mo
              </span>
              . Basket trades multiply the cap — a 5-slot basket counts as 5×
              the per-trade limit toward your monthly total. Caps cannot be
              overridden and reset automatically every 30 days.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Indicator Reference Library */}
      <section className="space-y-4" data-ocid="risk.indicators.section">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Indicator Reference Library
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Indicators analyzed by AI agents in every strategy debate
          </p>
        </div>

        <div className="space-y-5">
          {INDICATOR_CATEGORIES.map((cat) => (
            <div key={cat.name}>
              <h3
                className={`text-sm font-semibold mb-3 pb-2 border-b ${cat.color}`}
              >
                {cat.name}
              </h3>

              {cat.levels ? (
                // Fibonacci special layout
                <Card className="bg-card border-border">
                  <CardContent className="p-4 space-y-3">
                    <p className="text-sm text-muted-foreground">{cat.desc}</p>
                    <div className="flex flex-wrap gap-2">
                      {cat.levels.map((level) => (
                        <div
                          key={level}
                          className={`px-3 py-1.5 rounded-md text-sm font-mono font-medium border ${cat.color}`}
                        >
                          {level}
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Signal: {cat.signal}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {(cat.indicators ?? []).map((ind) => (
                    <Card key={ind.name} className="bg-card border-border">
                      <CardHeader className="p-4 pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-sm font-semibold text-foreground">
                            {ind.name}
                          </CardTitle>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-mono whitespace-nowrap ${cat.badge}`}
                          >
                            {ind.params}
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 pt-0 space-y-1">
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {ind.desc}
                        </p>
                        <p className="text-xs text-muted-foreground/70">
                          Signal: {ind.signal}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </motion.div>
  );
}
