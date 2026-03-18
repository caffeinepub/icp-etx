import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTokenUniverse } from "@/hooks/useQueries";
import {
  computeADX,
  computeATR,
  computeBollingerBands,
  computeCCI,
  computeEMACrossover,
  computeFibonacciLevels,
  computeHistoricalVolatility,
  computeMACD,
  computeMaxDrawdown,
  computeRSI,
  computeSharpeRatio,
  computeStochastic,
} from "@/lib/indicators";
import { cn } from "@/lib/utils";
import type { UnifiedToken } from "@/types/tokenUniverse";
import { motion } from "motion/react";
import { useMemo, useState } from "react";

function buildSyntheticPrices(token: UnifiedToken, points = 30): number[] {
  if (!token.priceUsd) return [];
  const current = token.priceUsd;
  const change24h = token.priceChange24h ?? 0;
  const prices: number[] = [];
  const volatility = Math.abs(change24h) * 0.03;
  for (let i = 0; i < points; i++) {
    const progress = i / (points - 1);
    const trend = current * (1 - (change24h / 100) * (1 - progress));
    const noise =
      (Math.sin(i * 1.3) + Math.cos(i * 0.7)) * current * volatility * 0.5;
    prices.push(Math.max(trend + noise, 0.000001));
  }
  prices[prices.length - 1] = current;
  return prices;
}

function RSIGauge({ value }: { value: number }) {
  const color =
    value < 30
      ? "text-destructive"
      : value > 70
        ? "text-success"
        : "text-warning";
  const zone = value < 30 ? "Oversold" : value > 70 ? "Overbought" : "Neutral";
  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        width="100"
        height="60"
        viewBox="0 0 100 60"
        role="img"
        aria-label={`RSI gauge: ${value.toFixed(1)} — ${zone}`}
      >
        <path
          d="M 10 50 A 40 40 0 0 1 90 50"
          fill="none"
          stroke="#1e1e2e"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d="M 10 50 A 40 40 0 0 1 90 50"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${(value / 100) * 125.6} 125.6`}
          className={color}
        />
      </svg>
      <div className="-mt-4 text-center">
        <div className={cn("text-2xl font-bold font-mono", color)}>
          {value.toFixed(1)}
        </div>
        <div className="text-xs text-muted-foreground">{zone}</div>
      </div>
    </div>
  );
}

function IndicatorCard({
  title,
  children,
  className,
}: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={cn("bg-card border-border", className)}>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">{children}</CardContent>
    </Card>
  );
}

function InsufficientData() {
  return (
    <p className="text-xs text-muted-foreground italic">Insufficient data</p>
  );
}

function TokenSearchSelector({
  tokens,
  selected,
  onSelect,
}: {
  tokens: UnifiedToken[];
  selected: UnifiedToken | null;
  onSelect: (t: UnifiedToken | null) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    if (!query.trim()) return tokens.slice(0, 30);
    const q = query.toLowerCase();
    return tokens
      .filter(
        (t) =>
          t.symbol.toLowerCase().includes(q) ||
          t.name.toLowerCase().includes(q),
      )
      .slice(0, 20);
  }, [tokens, query]);

  return (
    <div className="relative">
      <input
        type="text"
        placeholder="Search token…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        data-ocid="analysis.search_input"
        className="w-full px-4 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
      />
      {selected && !query && (
        <div className="mt-2 px-3 py-2 bg-primary/10 border border-primary/30 rounded-md text-sm flex items-center gap-2">
          <span className="font-semibold text-primary">{selected.symbol}</span>
          <span className="text-muted-foreground">{selected.name}</span>
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="ml-auto text-muted-foreground hover:text-foreground text-xs"
          >
            ✕
          </button>
        </div>
      )}
      {query && (
        <div className="absolute z-20 mt-1 w-full bg-card border border-border rounded-lg shadow-lg overflow-hidden max-h-60 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              No tokens found
            </p>
          ) : (
            filtered.map((t) => (
              <button
                key={t.address}
                type="button"
                onClick={() => {
                  onSelect(t);
                  setQuery("");
                }}
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-accent flex items-center gap-3 transition-colors"
              >
                <span className="font-semibold text-foreground">
                  {t.symbol}
                </span>
                <span className="text-muted-foreground text-xs truncate">
                  {t.name}
                </span>
                {t.priceUsd && (
                  <span className="ml-auto text-xs text-muted-foreground font-mono">
                    $
                    {t.priceUsd < 0.01
                      ? t.priceUsd.toExponential(2)
                      : t.priceUsd.toFixed(4)}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function AnalysisDashboard({ token }: { token: UnifiedToken }) {
  const prices = useMemo(() => buildSyntheticPrices(token, 50), [token]);
  const returns = useMemo(
    () => prices.slice(1).map((p, i) => Math.log(p / prices[i])),
    [prices],
  );

  const rsi = useMemo(() => computeRSI(prices), [prices]);
  const stoch = useMemo(() => computeStochastic(prices), [prices]);
  const cci = useMemo(() => computeCCI(prices), [prices]);
  const macd = useMemo(() => computeMACD(prices), [prices]);
  const emaCross = useMemo(() => computeEMACrossover(prices, 10, 20), [prices]);
  const adx = useMemo(() => computeADX(prices), [prices]);
  const bb = useMemo(() => computeBollingerBands(prices), [prices]);
  const atr = useMemo(() => {
    const raw = computeATR(prices);
    return raw && token.priceUsd ? (raw / token.priceUsd) * 100 : null;
  }, [prices, token.priceUsd]);
  const hv = useMemo(() => computeHistoricalVolatility(prices), [prices]);
  const sharpe = useMemo(() => computeSharpeRatio(returns), [returns]);
  const drawdown = useMemo(() => computeMaxDrawdown(prices), [prices]);
  const fib = useMemo(() => {
    const high = Math.max(...prices);
    const low = Math.min(...prices);
    return computeFibonacciLevels(high, low);
  }, [prices]);
  const currentPrice = token.priceUsd ?? 0;

  return (
    <div className="space-y-4">
      <div className="px-4 py-2.5 rounded-lg bg-warning/10 border border-warning/30 text-xs text-warning">
        ⚠ Simulated data — synthetic price series derived from 24h change. Live
        OHLCV coming in Prompt 5.
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* RSI */}
        <IndicatorCard title="RSI (14)">
          {rsi !== null ? <RSIGauge value={rsi} /> : <InsufficientData />}
        </IndicatorCard>

        {/* MACD */}
        <IndicatorCard title="MACD (12,26,9)">
          {macd ? (
            <div className="space-y-2">
              <Badge
                className={cn(
                  "text-xs",
                  macd.histogram > 0
                    ? "bg-success/20 text-success border-success/30"
                    : "bg-destructive/20 text-destructive border-destructive/30",
                )}
              >
                {macd.histogram > 0 ? "Bullish" : "Bearish"}
              </Badge>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">MACD</span>
                  <span className="font-mono text-foreground">
                    {macd.macd.toFixed(4)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Signal</span>
                  <span className="font-mono text-foreground">
                    {macd.signal.toFixed(4)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Histogram</span>
                  <span
                    className={cn(
                      "font-mono",
                      macd.histogram > 0 ? "text-success" : "text-destructive",
                    )}
                  >
                    {macd.histogram.toFixed(4)}
                  </span>
                </div>
              </div>
              <div className="flex items-end gap-0.5 h-8">
                {([0.4, 0.65, 0.8, 1, 0.9] as const).map((mult) => {
                  const v = macd.histogram * mult;
                  return (
                    <div
                      key={mult}
                      className={cn(
                        "flex-1 rounded-sm",
                        v > 0 ? "bg-success/60" : "bg-destructive/60",
                      )}
                      style={{
                        height: `${Math.min(Math.abs(v / (Math.abs(macd.histogram) || 1)) * 32, 32)}px`,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ) : (
            <InsufficientData />
          )}
        </IndicatorCard>

        {/* Stochastic */}
        <IndicatorCard title="Stochastic (14,3,3)">
          {stoch ? (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">%K</span>
                <span
                  className={cn(
                    "font-mono font-semibold",
                    stoch.k > 80
                      ? "text-destructive"
                      : stoch.k < 20
                        ? "text-success"
                        : "text-foreground",
                  )}
                >
                  {stoch.k.toFixed(1)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">%D</span>
                <span className="font-mono text-foreground">
                  {stoch.d.toFixed(1)}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-border overflow-hidden">
                <div
                  className="h-full bg-primary/70 rounded-full"
                  style={{ width: `${stoch.k}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {stoch.k > 80
                  ? "Overbought zone"
                  : stoch.k < 20
                    ? "Oversold zone"
                    : "Neutral zone"}
              </p>
            </div>
          ) : (
            <InsufficientData />
          )}
        </IndicatorCard>

        {/* CCI */}
        <IndicatorCard title="CCI (20)">
          {cci !== null ? (
            <div className="space-y-2">
              <div
                className={cn(
                  "text-3xl font-bold font-mono",
                  cci > 100
                    ? "text-destructive"
                    : cci < -100
                      ? "text-success"
                      : "text-warning",
                )}
              >
                {cci.toFixed(0)}
              </div>
              <p className="text-xs text-muted-foreground">
                {cci > 100
                  ? "Overbought — potential reversal"
                  : cci < -100
                    ? "Oversold — potential reversal"
                    : "Within normal range"}
              </p>
            </div>
          ) : (
            <InsufficientData />
          )}
        </IndicatorCard>

        {/* Bollinger Bands */}
        <IndicatorCard title="Bollinger Bands (20,2)">
          {bb ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Upper</span>
                <span className="font-mono text-foreground">
                  ${bb.upper.toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Middle</span>
                <span className="font-mono text-primary">
                  ${bb.middle.toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Lower</span>
                <span className="font-mono text-foreground">
                  ${bb.lower.toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bandwidth</span>
                <span className="font-mono text-foreground">
                  {bb.bandwidth.toFixed(1)}%
                </span>
              </div>
              {bb.upper > bb.lower && (
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Lower</span>
                    <span>Upper</span>
                  </div>
                  <div className="relative h-2 rounded-full bg-border">
                    <div
                      className="absolute top-0 h-2 w-1 rounded-full bg-primary -translate-x-1/2"
                      style={{
                        left: `${Math.max(0, Math.min(100, ((currentPrice - bb.lower) / (bb.upper - bb.lower)) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <InsufficientData />
          )}
        </IndicatorCard>

        {/* ATR */}
        <IndicatorCard title="ATR (14)">
          {atr !== null ? (
            <div className="space-y-2">
              <div
                className={cn(
                  "text-3xl font-bold font-mono",
                  atr > 5
                    ? "text-destructive"
                    : atr > 2
                      ? "text-warning"
                      : "text-success",
                )}
              >
                {atr.toFixed(2)}%
              </div>
              <p className="text-xs text-muted-foreground">
                {atr > 5
                  ? "High volatility"
                  : atr > 2
                    ? "Moderate volatility"
                    : "Low volatility"}
              </p>
              <p className="text-xs text-muted-foreground">
                % of current price
              </p>
            </div>
          ) : (
            <InsufficientData />
          )}
        </IndicatorCard>

        {/* EMA Crossover */}
        <IndicatorCard title="EMA Crossover (10/20)">
          {emaCross ? (
            <div className="space-y-2">
              <Badge
                className={cn(
                  "text-xs",
                  emaCross.crossover === "bullish"
                    ? "bg-success/20 text-success border-success/30"
                    : emaCross.crossover === "bearish"
                      ? "bg-destructive/20 text-destructive border-destructive/30"
                      : "bg-muted/50 text-muted-foreground border-border",
                )}
              >
                {emaCross.crossover === "none"
                  ? "No recent crossover"
                  : emaCross.crossover === "bullish"
                    ? "Golden Cross"
                    : "Death Cross"}
              </Badge>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">EMA 10</span>
                  <span className="font-mono">
                    ${emaCross.shortEMA.toFixed(4)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">EMA 20</span>
                  <span className="font-mono">
                    ${emaCross.longEMA.toFixed(4)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <InsufficientData />
          )}
        </IndicatorCard>

        {/* ADX */}
        <IndicatorCard title="ADX (14)">
          {adx !== null ? (
            <div className="space-y-2">
              <div
                className={cn(
                  "text-3xl font-bold font-mono",
                  adx > 40
                    ? "text-primary"
                    : adx > 25
                      ? "text-success"
                      : "text-muted-foreground",
                )}
              >
                {adx.toFixed(0)}
              </div>
              <div className="h-2 rounded-full bg-border overflow-hidden">
                <div
                  className="h-full bg-primary/70 rounded-full transition-all"
                  style={{ width: `${Math.min(adx, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {adx > 40
                  ? "Very strong trend"
                  : adx > 25
                    ? "Strong trend"
                    : adx > 20
                      ? "Developing trend"
                      : "Weak / ranging"}
              </p>
            </div>
          ) : (
            <InsufficientData />
          )}
        </IndicatorCard>

        {/* Historical Volatility */}
        <IndicatorCard title="Historical Volatility (20)">
          {hv !== null ? (
            <div className="space-y-2">
              <div
                className={cn(
                  "text-3xl font-bold font-mono",
                  hv > 100
                    ? "text-destructive"
                    : hv > 50
                      ? "text-warning"
                      : "text-success",
                )}
              >
                {hv.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                Annualized volatility
              </p>
              <p className="text-xs text-muted-foreground">
                {hv > 100
                  ? "Extreme — high risk"
                  : hv > 50
                    ? "High — exercise caution"
                    : "Moderate — normal range"}
              </p>
            </div>
          ) : (
            <InsufficientData />
          )}
        </IndicatorCard>

        {/* Fibonacci Levels */}
        <IndicatorCard
          title="Fibonacci Levels"
          className="sm:col-span-2 lg:col-span-1"
        >
          <div className="space-y-1">
            {Object.entries(fib).map(([level, price]) => {
              const isCurrent =
                currentPrice > 0 &&
                Math.abs(price - currentPrice) / currentPrice < 0.02;
              return (
                <div
                  key={level}
                  className={cn(
                    "flex justify-between items-center text-xs py-0.5 px-1.5 rounded",
                    isCurrent
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent",
                  )}
                >
                  <span className="font-mono font-medium w-12">{level}</span>
                  <span className="font-mono">
                    ${price < 0.01 ? price.toExponential(2) : price.toFixed(4)}
                  </span>
                  {isCurrent && (
                    <span className="text-[10px] text-primary">← current</span>
                  )}
                </div>
              );
            })}
          </div>
        </IndicatorCard>

        {/* Sharpe Ratio */}
        <IndicatorCard title="Sharpe Ratio">
          {sharpe !== null ? (
            <div className="space-y-1">
              <div
                className={cn(
                  "text-3xl font-bold font-mono",
                  sharpe > 2
                    ? "text-success"
                    : sharpe > 1
                      ? "text-primary"
                      : sharpe > 0
                        ? "text-warning"
                        : "text-destructive",
                )}
              >
                {sharpe.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                {sharpe > 2
                  ? "Excellent risk-adjusted return"
                  : sharpe > 1
                    ? "Good risk-adjusted return"
                    : sharpe > 0
                      ? "Acceptable"
                      : "Poor — losing on risk-adjusted basis"}
              </p>
            </div>
          ) : (
            <InsufficientData />
          )}
        </IndicatorCard>

        {/* Max Drawdown */}
        <IndicatorCard title="Max Drawdown">
          {drawdown !== null ? (
            <div className="space-y-2">
              <div
                className={cn(
                  "text-3xl font-bold font-mono",
                  drawdown > 30
                    ? "text-destructive"
                    : drawdown > 15
                      ? "text-warning"
                      : "text-success",
                )}
              >
                -{drawdown.toFixed(1)}%
              </div>
              <div className="h-2 rounded-full bg-border overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full",
                    drawdown > 30
                      ? "bg-destructive/70"
                      : drawdown > 15
                        ? "bg-warning/70"
                        : "bg-success/70",
                  )}
                  style={{ width: `${Math.min(drawdown, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Peak-to-trough decline
              </p>
            </div>
          ) : (
            <InsufficientData />
          )}
        </IndicatorCard>
      </div>
    </div>
  );
}

export default function Analysis() {
  const { tokens, isLoading } = useTokenUniverse();
  const [selected, setSelected] = useState<UnifiedToken | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-4 sm:p-6 space-y-6"
      data-ocid="analysis.page"
    >
      <div>
        <h1 className="text-2xl font-bold text-foreground">Analysis</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Live signal dashboard — select a token to compute all indicators
        </p>
      </div>

      <div className="max-w-md">
        {isLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <TokenSearchSelector
            tokens={tokens}
            selected={selected}
            onSelect={setSelected}
          />
        )}
      </div>

      {selected ? (
        <AnalysisDashboard token={selected} />
      ) : (
        <div
          className="flex flex-col items-center justify-center py-20 text-center"
          data-ocid="analysis.empty_state"
        >
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
            <span className="text-2xl">📊</span>
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-2">
            Select a token to analyze
          </h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            Search for any token from the universe to see RSI, MACD, Bollinger
            Bands, Fibonacci levels, and more.
          </p>
        </div>
      )}
    </motion.div>
  );
}
