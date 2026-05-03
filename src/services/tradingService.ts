
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface LiquidityLevels {
  pdh: number; // Previous Day High
  pdl: number; // Previous Day Low
  pwh: number; // Previous Week High
  pwl: number; // Previous Week Low
}

export interface FVG {
  top: number;
  bottom: number;
  ce: number; 
  type: 'bull' | 'bear';
  time: number;
  isInverse: boolean;
  entry?: number;
  sl?: number;
  tp?: number;
}

export interface OrderBlock {
  top: number;
  bottom: number;
  time: number;
  type: 'bull' | 'bear';
  isBreaker: boolean;
  entry?: number;
  sl?: number;
  tp?: number;
}

export interface TradeSignal {
  type: 'BULLISH_BIAS' | 'BEARISH_BIAS' | 'RANGE_BOUND';
  entry: number;
  sl: number;
  tp: number;
  description: string;
  timestamp: number;
}

export interface Position {
  id: string;
  symbol: string;
  type: 'LONG' | 'SHORT';
  entry: number;
  sl: number;
  tp: number;
  size: number;
  status: 'OPEN' | 'CLOSED';
  pnl: number;
  pnlPercent: number;
  openTime: number;
  closeTime?: number;
  exitPrice?: number;
  result?: 'TP' | 'SL' | 'MANUAL';
}

export async function fetchCandles(symbol: string, interval: string = '5m', limit: number = 200, currentPrice?: number): Promise<Candle[]> {
  try {
    const targetSymbol = symbol === 'XAUUSD' ? 'PAXGUSDT' : symbol;
    const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${targetSymbol.toUpperCase()}&interval=${interval}&limit=${limit}`);
    
    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!Array.isArray(data)) {
      throw new Error("Invalid data format from Binance");
    }

    return data.map((d: any) => ({
      time: d[0],
      open: parseFloat(d[1]),
      high: parseFloat(d[2]),
      low: parseFloat(d[3]),
      close: parseFloat(d[4])
    }));
  } catch (error) {
    console.warn("Candle fetch error, using stable anchored mockup data:", error);
    
    const now = Date.now();
    const intervalMs = 300000; // 5m
    const roundedNow = Math.floor(now / intervalMs) * intervalMs;
    const mockCandles: Candle[] = [];
    
    let lastPrice = currentPrice || (symbol === 'XAUUSD' ? 2350 : (symbol === 'BTCUSDT' ? 65000 : 3500));
    const seed = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    for (let i = 0; i < limit; i++) {
      const time = roundedNow - (limit - i) * intervalMs;
      const tSeed = Math.sin(time + seed) * 10000;
      const pseudoRand = tSeed - Math.floor(tSeed);
      
      const volatility = lastPrice * 0.0004;
      const change = (pseudoRand - 0.5) * volatility;
      
      const open = lastPrice;
      const close = lastPrice + change;
      const high = Math.max(open, close) + (Math.abs(Math.cos(time)) * volatility * 0.3);
      const low = Math.min(open, close) - (Math.abs(Math.sin(time)) * volatility * 0.3);
      
      mockCandles.push({
        time,
        open,
        high,
        low,
        close
      });
      lastPrice = close;
    }
    return mockCandles;
  }
}

export function calculateLiquidityLevels(candles: Candle[]): LiquidityLevels {
  // Mock logic for PDH/PDL based on available candle data if we don't have daily timeframe
  // In a real app, we would fetch 1D candles
  const last24h = candles.slice(-288); // Approx 24h at 5m
  const lastWeek = candles.slice(-2016); // Approx 7d at 5m

  return {
    pdh: Math.max(...last24h.map(c => c.high)),
    pdl: Math.min(...last24h.map(c => c.low)),
    pwh: Math.max(...lastWeek.map(c => c.high)),
    pwl: Math.min(...lastWeek.map(c => c.low))
  };
}

export function detectSignals(candles: Candle[], levels: LiquidityLevels, fvgs: FVG[], obs: OrderBlock[]): TradeSignal[] {
  const current = candles[candles.length - 1];
  const signals: TradeSignal[] = [];

  // Bullish Bias Strategy: Bias Turun ke PDL -> FVG Bullish / MSS -> Target PWH atau PDH
  if (current.low <= levels.pdl * 1.0005) {
    const freshBullishFVG = fvgs.find(f => f.type === 'bull' && !f.isInverse && f.time > current.time - 3600000);
    const freshBullishOB = obs.find(ob => ob.type === 'bull' && !ob.isBreaker && ob.time > current.time - 3600000);

    if (freshBullishFVG || freshBullishOB) {
      signals.push({
        type: 'BULLISH_BIAS',
        entry: current.close,
        sl: levels.pdl * 0.9995,
        tp: Math.max(levels.pdh, levels.pwh),
        description: "Price swept PDL. Bullish MSS/FVG detected. Targeting PDH/PWH.",
        timestamp: Date.now()
      });
    }
  }

  // Bearish Bias Strategy: Bias Naik ke PDH -> FVG Bearish / MSS -> Target PWL atau PDL
  if (current.high >= levels.pdh * 0.9995) {
    const freshBearishFVG = fvgs.find(f => f.type === 'bear' && !f.isInverse && f.time > current.time - 3600000);
    const freshBearishOB = obs.find(ob => ob.type === 'bear' && !ob.isBreaker && ob.time > current.time - 3600000);

    if (freshBearishFVG || freshBearishOB) {
      signals.push({
        type: 'BEARISH_BIAS',
        entry: current.close,
        sl: levels.pdh * 1.0005,
        tp: Math.min(levels.pdl, levels.pwl),
        description: "Price swept PDH. Bearish MSS/FVG detected. Targeting PDL/PWL.",
        timestamp: Date.now()
      });
    }
  }

  // Range Bound: Naik ke PWH + SMT (Divergence simulated by trend exhaustion)
  if (current.high >= levels.pwh * 0.9998) {
    signals.push({
      type: 'RANGE_BOUND',
      entry: current.close,
      sl: levels.pwh * 1.001,
      tp: (levels.pwh + levels.pwl) / 2,
      description: "PWH Reach with Volatility SMT. Reversal to Equilibrium.",
      timestamp: Date.now()
    });
  }

  return signals;
}

export function detectFVGs(candles: Candle[]): FVG[] {
  const fvgs: FVG[] = [];
  
  for (let i = 2; i < candles.length; i++) {
    const c0 = candles[i];
    const c2 = candles[i - 2];
    const c1 = candles[i - 1];
    
    if (c0.low > c2.high) {
      const entry = (c0.low + c2.high) / 2;
      fvgs.push({
        top: c0.low,
        bottom: c2.high,
        ce: entry,
        type: 'bull',
        time: c1.time,
        isInverse: false,
        entry: entry,
        sl: c2.high - (c0.low - c2.high) * 0.5,
        tp: entry + (c0.low - c2.high) * 2
      });
    } else if (c0.high < c2.low) {
      const entry = (c2.low + c0.high) / 2;
      fvgs.push({
        top: c2.low,
        bottom: c0.high,
        ce: entry,
        type: 'bear',
        time: c1.time,
        isInverse: false,
        entry: entry,
        sl: c2.low + (c2.low - c0.high) * 0.5,
        tp: entry - (c2.low - c0.high) * 2
      });
    }
  }
  return fvgs;
}

export function updateInverseFVGs(fvgs: FVG[], currentCandle: Candle): FVG[] {
  return fvgs.map(f => {
    if (f.isInverse) return f;
    if (f.type === 'bull' && currentCandle.close < f.bottom) {
      const risk = f.top - f.bottom;
      return { 
        ...f, 
        isInverse: true, 
        type: 'bear',
        entry: f.ce,
        sl: f.top + risk * 0.5,
        tp: f.ce - risk * 2
      };
    }
    if (f.type === 'bear' && currentCandle.close > f.top) {
      const risk = f.top - f.bottom;
      return { 
        ...f, 
        isInverse: true, 
        type: 'bull',
        entry: f.ce,
        sl: f.bottom - risk * 0.5,
        tp: f.ce + risk * 2
      };
    }
    return f;
  });
}

export function detectOrderBlocks(candles: Candle[], length: number = 10): OrderBlock[] {
  const obs: OrderBlock[] = [];
  
  for (let i = length; i < candles.length; i++) {
    const current = candles[i];
    const lookback = candles.slice(i - length, i);
    const maxHigh = Math.max(...lookback.map(c => c.high));
    const minLow = Math.min(...lookback.map(c => c.low));

    if (current.close > maxHigh) {
      for (let j = i - 1; j >= i - 5; j--) {
        if (candles[j].close < candles[j].open) {
          const risk = candles[j].high - candles[j].low;
          obs.push({
            top: candles[j].high,
            bottom: candles[j].low,
            time: candles[j].time,
            type: 'bull',
            isBreaker: false,
            entry: candles[j].high,
            sl: candles[j].low,
            tp: candles[j].high + risk * 3
          });
          break;
        }
      }
    }

    if (current.close < minLow) {
      for (let j = i - 1; j >= i - 5; j--) {
        if (candles[j].close > candles[j].open) {
          const risk = candles[j].high - candles[j].low;
          obs.push({
            top: candles[j].high,
            bottom: candles[j].low,
            time: candles[j].time,
            type: 'bear',
            isBreaker: false,
            entry: candles[j].low,
            sl: candles[j].high,
            tp: candles[j].low - risk * 3
          });
          break;
        }
      }
    }
  }

  const latest = candles[candles.length - 1];
  return obs.map(ob => {
    if (ob.type === 'bull' && latest.close < ob.bottom) return { ...ob, isBreaker: true };
    if (ob.type === 'bear' && latest.close > ob.top) return { ...ob, isBreaker: true };
    return ob;
  }).slice(-15);
}
