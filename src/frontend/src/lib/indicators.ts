// Standard technical indicator implementations
// All return null if insufficient data

function ema(prices: number[], period: number): number[] {
  if (prices.length < period) return [];
  const k = 2 / (period + 1);
  const result: number[] = [];
  let prev = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(prev);
  for (let i = period; i < prices.length; i++) {
    prev = prices[i] * k + prev * (1 - k);
    result.push(prev);
  }
  return result;
}

export function computeRSI(prices: number[], period = 14): number | null {
  if (prices.length < period + 1) return null;
  const changes = prices.slice(1).map((p, i) => p - prices[i]);
  let gains = 0;
  let losses = 0;
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) gains += changes[i];
    else losses -= changes[i];
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period; i < changes.length; i++) {
    const g = changes[i] > 0 ? changes[i] : 0;
    const l = changes[i] < 0 ? -changes[i] : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function computeStochastic(
  prices: number[],
  kPeriod = 14,
  dPeriod = 3,
): { k: number; d: number } | null {
  if (prices.length < kPeriod + dPeriod) return null;
  const kValues: number[] = [];
  for (let i = kPeriod - 1; i < prices.length; i++) {
    const window = prices.slice(i - kPeriod + 1, i + 1);
    const highest = Math.max(...window);
    const lowest = Math.min(...window);
    kValues.push(
      highest === lowest
        ? 50
        : ((prices[i] - lowest) / (highest - lowest)) * 100,
    );
  }
  if (kValues.length < dPeriod) return null;
  const k = kValues[kValues.length - 1];
  const d = kValues.slice(-dPeriod).reduce((a, b) => a + b, 0) / dPeriod;
  return { k, d };
}

export function computeCCI(prices: number[], period = 20): number | null {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const meanDev = slice.reduce((a, b) => a + Math.abs(b - mean), 0) / period;
  if (meanDev === 0) return 0;
  return (prices[prices.length - 1] - mean) / (0.015 * meanDev);
}

export function computeMACD(
  prices: number[],
  fast = 12,
  slow = 26,
  signal = 9,
): { macd: number; signal: number; histogram: number } | null {
  if (prices.length < slow + signal) return null;
  const fastEMA = ema(prices, fast);
  const slowEMA = ema(prices, slow);
  if (!fastEMA.length || !slowEMA.length) return null;
  const macdLine: number[] = [];
  const len = Math.min(fastEMA.length, slowEMA.length);
  for (let i = 0; i < len; i++) {
    macdLine.push(
      fastEMA[fastEMA.length - len + i] - slowEMA[slowEMA.length - len + i],
    );
  }
  if (macdLine.length < signal) return null;
  const signalEMA = ema(macdLine, signal);
  if (!signalEMA.length) return null;
  const macdVal = macdLine[macdLine.length - 1];
  const signalVal = signalEMA[signalEMA.length - 1];
  return { macd: macdVal, signal: signalVal, histogram: macdVal - signalVal };
}

export function computeEMACrossover(
  prices: number[],
  shortPeriod = 50,
  longPeriod = 200,
): {
  shortEMA: number;
  longEMA: number;
  crossover: "bullish" | "bearish" | "none";
} | null {
  if (prices.length < longPeriod + 2) return null;
  const shortValues = ema(prices, shortPeriod);
  const longValues = ema(prices, longPeriod);
  if (shortValues.length < 2 || longValues.length < 2) return null;
  const shortNow = shortValues[shortValues.length - 1];
  const shortPrev = shortValues[shortValues.length - 2];
  const longNow = longValues[longValues.length - 1];
  const longPrev = longValues[longValues.length - 2];
  let crossover: "bullish" | "bearish" | "none" = "none";
  if (shortPrev <= longPrev && shortNow > longNow) crossover = "bullish";
  else if (shortPrev >= longPrev && shortNow < longNow) crossover = "bearish";
  return { shortEMA: shortNow, longEMA: longNow, crossover };
}

export function computeADX(prices: number[], period = 14): number | null {
  if (prices.length < period * 2) return null;
  const trValues: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    trValues.push(Math.abs(prices[i] - prices[i - 1]));
  }
  const atr = trValues.slice(-period).reduce((a, b) => a + b, 0) / period;
  const priceRange =
    Math.max(...prices.slice(-period)) - Math.min(...prices.slice(-period));
  if (atr === 0) return 0;
  return Math.min((priceRange / (atr * period)) * 50, 100);
}

export function computeBollingerBands(
  prices: number[],
  period = 20,
  stdDev = 2,
): { upper: number; middle: number; lower: number; bandwidth: number } | null {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  const middle = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + (b - middle) ** 2, 0) / period;
  const sd = Math.sqrt(variance);
  const upper = middle + stdDev * sd;
  const lower = middle - stdDev * sd;
  const bandwidth = middle > 0 ? ((upper - lower) / middle) * 100 : 0;
  return { upper, middle, lower, bandwidth };
}

export function computeATR(prices: number[], period = 14): number | null {
  if (prices.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    trs.push(Math.abs(prices[i] - prices[i - 1]));
  }
  return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
}

export function computeHistoricalVolatility(
  prices: number[],
  period = 20,
): number | null {
  if (prices.length < period + 1) return null;
  const returns = prices.slice(1).map((p, i) => Math.log(p / prices[i]));
  const slice = returns.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance =
    slice.reduce((a, b) => a + (b - mean) ** 2, 0) / (period - 1);
  return Math.sqrt(variance * 252) * 100;
}

export function computeFibonacciLevels(
  high: number,
  low: number,
): Record<string, number> {
  const diff = high - low;
  return {
    "0%": low,
    "23.6%": low + diff * 0.236,
    "38.2%": low + diff * 0.382,
    "50%": low + diff * 0.5,
    "61.8%": low + diff * 0.618,
    "78.6%": low + diff * 0.786,
    "100%": high,
    "161.8%": low + diff * 1.618,
  };
}

export function computeSharpeRatio(
  returns: number[],
  riskFreeRate = 0.02,
): number | null {
  if (returns.length < 10) return null;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length - 1);
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) return null;
  const annualizedReturn = mean * 252;
  const annualizedStd = stdDev * Math.sqrt(252);
  return (annualizedReturn - riskFreeRate) / annualizedStd;
}

export function computeMaxDrawdown(prices: number[]): number | null {
  if (prices.length < 2) return null;
  let maxDrawdown = 0;
  let peak = prices[0];
  for (const price of prices) {
    if (price > peak) peak = price;
    const dd = (peak - price) / peak;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }
  return maxDrawdown * 100;
}

export function computeOBV(prices: number[], volumes: number[]): number | null {
  if (prices.length < 2 || volumes.length < prices.length) return null;
  let obv = 0;
  for (let i = 1; i < prices.length; i++) {
    if (prices[i] > prices[i - 1]) obv += volumes[i];
    else if (prices[i] < prices[i - 1]) obv -= volumes[i];
  }
  return obv;
}

export function computeVWAP(
  prices: number[],
  volumes: number[],
): number | null {
  if (prices.length === 0 || volumes.length < prices.length) return null;
  const totalVolume = volumes
    .slice(0, prices.length)
    .reduce((a, b) => a + b, 0);
  if (totalVolume === 0) return null;
  const pv = prices.reduce((a, p, i) => a + p * volumes[i], 0);
  return pv / totalVolume;
}
