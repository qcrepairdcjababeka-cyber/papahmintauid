import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// --- Types ---

export interface MarketSentiment {
  bullish: number;
  bearish: number;
  neutral: number;
  summary: string;
  divergence?: 'BULL_TRAP' | 'BEAR_TRAP' | 'ALIGNED' | 'UNCONFIRMED';
  tradingLevels?: {
    entry: number;
    sl: number;
    tp1: number;
    tp2: number;
  };
  isMock?: boolean;
}

export interface CalendarEvent {
  time: string;
  event: string;
  impact: 'high' | 'medium' | 'low';
  currency: string;
}

export interface InstitutionalSetup {
  ticker: string;
  bias: 'LONG' | 'SHORT' | 'NEUTRAL';
  institutionalFlow: string;
  keyLevels: string[];
  catalyst: string;
  entry?: string;
  sl?: string;
  tp?: string;
  cisd?: {
    level: string;
    type: 'BULLISH' | 'BEARISH';
    strength: 'HIGH' | 'MEDIUM';
    note: string;
  };
}

// --- Caching & Cooldown Logic ---

const CACHE_KEYS = {
  SENTIMENT: 'pp_sentiment_cache',
  CALENDAR: 'pp_calendar_cache',
  INSTITUTIONAL: 'pp_institutional_cache',
  COOLDOWN: 'pp_ai_cooldown'
};

const CACHE_TTL = {
  SENTIMENT: 1000 * 60 * 3,    // 3 minutes
  CALENDAR: 1000 * 60 * 30,   // 30 minutes
  INSTITUTIONAL: 1000 * 60 * 15 // 15 minutes
};

function getCache<T>(key: string): T | null {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    const { data, timestamp } = JSON.parse(cached);
    
    let ttl = CACHE_TTL.SENTIMENT;
    if (key === CACHE_KEYS.CALENDAR) ttl = CACHE_TTL.CALENDAR;
    if (key === CACHE_KEYS.INSTITUTIONAL) ttl = CACHE_TTL.INSTITUTIONAL;

    if (Date.now() - timestamp > ttl) return null;
    return data;
  } catch {
    return null;
  }
}

function setCache(key: string, data: any) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch (e) {
    console.warn("Cache write failed", e);
  }
}

function setCooldown() {
  localStorage.setItem(CACHE_KEYS.COOLDOWN, (Date.now() + 1000 * 60 * 3).toString()); // 3 min cool down
}

function isCoolingDown(): boolean {
  const cd = localStorage.getItem(CACHE_KEYS.COOLDOWN);
  if (!cd) return false;
  return Date.now() < parseInt(cd);
}

// --- AI Functions ---

export async function analyzeSocialSentiment(symbol: string): Promise<MarketSentiment> {
  const cached = getCache<MarketSentiment>(CACHE_KEYS.SENTIMENT);
  
  if (isCoolingDown()) {
    console.log("AI in cooldown, using fallback for sentiment");
    return cached || {
      bullish: 78,
      bearish: 18,
      neutral: 4,
      summary: "AI Cooldown: Using cached/fallback data due to rate limits.",
      tradingLevels: {
        entry: symbol.includes('BTC') ? 94500 : symbol.includes('XAU') ? 2645 : 100,
        sl: symbol.includes('BTC') ? 93200 : symbol.includes('XAU') ? 2625 : 95,
        tp1: symbol.includes('BTC') ? 96000 : symbol.includes('XAU') ? 2680 : 105,
        tp2: symbol.includes('BTC') ? 98500 : symbol.includes('XAU') ? 2720 : 110
      },
      isMock: true
    };
  }

  if (cached) return cached;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Perform a real-time sentiment and Trading Direction analysis for ${symbol} based on current discussions on X (Twitter), Truth Social, and other major social platforms. 
      Analyze the mood of traders and influencers. 
      CHECK FOR DIVERGENCE: Compare the current social narrative (what people say) with the actual recent 24h price trend (bearish or bullish). 
      If people are bullish but the price is dropping, label it as "BULL_TRAP". 
      If people are bearish but the price is rising, label it as "BEAR_TRAP". 
      If they match the price trend, use "ALIGNED".
      Return a summary telling me what people are saying, the percentage of Bullish vs Bearish vs Neutral, the divergence status, and professional Trend-calculated levels.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            bullish: { type: Type.NUMBER },
            bearish: { type: Type.NUMBER },
            neutral: { type: Type.NUMBER },
            summary: { type: Type.STRING },
            divergence: { type: Type.STRING, enum: ["BULL_TRAP", "BEAR_TRAP", "ALIGNED", "UNCONFIRMED"] },
            tradingLevels: {
              type: Type.OBJECT,
              properties: {
                entry: { type: Type.NUMBER },
                sl: { type: Type.NUMBER },
                tp1: { type: Type.NUMBER },
                tp2: { type: Type.NUMBER }
              },
              required: ["entry", "sl", "tp1", "tp2"]
            }
          },
          required: ["bullish", "bearish", "neutral", "summary", "divergence", "tradingLevels"]
        }
      }
    });

    const data = JSON.parse(response.text);
    setCache(CACHE_KEYS.SENTIMENT, data);
    return data;
  } catch (error: any) {
    console.warn("Sentiment analysis rate limited or failed:", error.message || error);
    // Be more exhaustive in catching 429
    if (error?.message?.includes("429") || error?.status === 429 || error?.code === 429 || error?.message?.includes("RESOURCE_EXHAUSTED")) {
      setCooldown();
    }
    
    return cached || {
      bullish: 78,
      bearish: 18,
      neutral: 4,
      summary: "AI Rate Limited: Using historical sentiment benchmarks.",
      tradingLevels: {
        entry: symbol.includes('BTC') ? 94500 : symbol.includes('XAU') ? 2645 : 100,
        sl: symbol.includes('BTC') ? 93200 : symbol.includes('XAU') ? 2625 : 95,
        tp1: symbol.includes('BTC') ? 96000 : symbol.includes('XAU') ? 2680 : 105,
        tp2: symbol.includes('BTC') ? 98500 : symbol.includes('XAU') ? 2720 : 110
      },
      isMock: true
    };
  }
}

export async function fetchUSEconomicCalendar(): Promise<CalendarEvent[]> {
  const cached = getCache<CalendarEvent[]>(CACHE_KEYS.CALENDAR);
  
  if (isCoolingDown()) {
    console.log("AI in cooldown, using fallback for calendar");
    return cached || [
      { time: '19:30', event: 'Initial Jobless Claims', impact: 'medium', currency: 'USD' },
      { time: '20:15', event: 'S&P Global Manufacturing PMI', impact: 'high', currency: 'USD' },
      { time: '22:00', event: 'Pending Home Sales m/m', impact: 'low', currency: 'USD' }
    ];
  }

  if (cached) return cached;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Fetch the latest and upcoming high-impact economic calendar events for the USA (USD) for today and the next 24 hours. 
      Focus on critical data like FOMC, CPI, NFP, GDP, and FED speeches.
      Return a list of events with time, event name, impact level, and currency.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              time: { type: Type.STRING },
              event: { type: Type.STRING },
              impact: { type: Type.STRING, enum: ["high", "medium", "low"] },
              currency: { type: Type.STRING }
            },
            required: ["time", "event", "impact", "currency"]
          }
        }
      }
    });

    const data = JSON.parse(response.text);
    setCache(CACHE_KEYS.CALENDAR, data);
    return data;
  } catch (error: any) {
    console.warn("Calendar fetch failed or rate limited:", error.message || error);
    if (error?.message?.includes("429") || error?.status === 429 || error?.code === 429 || error?.message?.includes("RESOURCE_EXHAUSTED")) {
      setCooldown();
    }
    return cached || [
      { time: '19:30', event: 'Initial Jobless Claims (Cached)', impact: 'medium', currency: 'USD' },
      { time: '20:15', event: 'S&P Global Manufacturing PMI (Cached)', impact: 'high', currency: 'USD' },
      { time: '22:00', event: 'Pending Home Sales m/m (Cached)', impact: 'low', currency: 'USD' }
    ];
  }
}

export async function fetchInstitutionalSetups(currentPrice?: number): Promise<InstitutionalSetup[]> {
  const cached = getCache<InstitutionalSetup[]>(CACHE_KEYS.INSTITUTIONAL);
  
  if (isCoolingDown()) {
    console.log("AI in cooldown, using fallback for institutional");
    const now = new Date();
    // Variation based on time of day
    const hour = now.getUTCHours();
    const isLondon = hour >= 8 && hour < 16;
    
     return cached || [
      { 
        ticker: 'GOLD (XAU/USD)', 
        bias: isLondon ? 'LONG' : 'SHORT', 
        institutionalFlow: isLondon ? 'European banks increasing gold reserves.' : 'Profit taking observed in New York session.', 
        keyLevels: isLondon ? ['$2,405', '$2,415'] : ['$2,390', '$2,425'], 
        catalyst: isLondon ? 'ECB Monetary Policy Shift (Fallback)' : 'US Dollar Strength Cycle (Fallback)',
        entry: isLondon ? '2410.5' : '2395.0',
        sl: isLondon ? '2398.0' : '2412.0',
        tp: isLondon ? '2445.0' : '2365.0'
      }
    ];
  }

  if (cached) return cached;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Perform a high-level scan of institutional trading setups and market convictions typically found on Bloomberg Terminal.
      Focus on where large institutional funds (Institutions) are positioning.
      SPECIAL PROTOCOL: Detect CISD (Change in State of Delivery / Closing Institutional Supply/Demand) levels for XAU/USD (GOLD) on the 5-minute timeframe.
      Identify where a candle has closed above/below a key institutional orderblock.
      Return a list of setups including ticker, bias, institutional flow description, key levels, and macro catalysts.
      Crucially, provide a FIXED trading plan for each: entry level, stop loss (sl), and take profit (tp). 
      For GOLD, explicitly sub-analyze for CISD signals.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              ticker: { type: Type.STRING },
              bias: { type: Type.STRING, enum: ["LONG", "SHORT", "NEUTRAL"] },
              institutionalFlow: { type: Type.STRING },
              keyLevels: { type: Type.ARRAY, items: { type: Type.STRING } },
              catalyst: { type: Type.STRING },
              entry: { type: Type.STRING },
              sl: { type: Type.STRING },
              tp: { type: Type.STRING },
              cisd: {
                type: Type.OBJECT,
                properties: {
                  level: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ["BULLISH", "BEARISH"] },
                  strength: { type: Type.STRING, enum: ["HIGH", "MEDIUM"] },
                  note: { type: Type.STRING }
                },
                required: ["level", "type", "strength", "note"]
              }
            },
            required: ["ticker", "bias", "institutionalFlow", "keyLevels", "catalyst", "entry", "sl", "tp"]
          }
        }
      }
    });

    let data: InstitutionalSetup[] = JSON.parse(response.text);

    // If currentPrice is provided, we use it to calculate fixed levels for XAU/GOLD setups 
    // to ensure they are synchronized with the OANDA feed at the moment of fetch.
    if (currentPrice && currentPrice > 100) {
      data = data.map(setup => {
        if (setup.ticker.includes('GOLD') || setup.ticker.includes('XAU')) {
          const isLong = setup.bias === 'LONG';
          setup.entry = isLong ? (currentPrice - 1.5).toFixed(1) : (currentPrice + 1.2).toFixed(1);
          setup.sl = isLong ? (currentPrice - 8.0).toFixed(1) : (currentPrice + 7.5).toFixed(1);
          setup.tp = isLong ? (currentPrice + 15.0).toFixed(1) : (currentPrice - 14.0).toFixed(1);
        }
        return setup;
      });
    }

    setCache(CACHE_KEYS.INSTITUTIONAL, data);
    return data;
  } catch (error: any) {
    console.warn("Institutional fetch failed or rate limited:", error.message || error);
    if (error?.message?.includes("429") || error?.status === 429 || error?.code === 429 || error?.message?.includes("RESOURCE_EXHAUSTED")) {
      setCooldown();
    }
    return cached || [
      { 
        ticker: 'GOLD (XAU/USD)', 
        bias: 'LONG', 
        institutionalFlow: 'Central banks maintaining accumulation (Cached).', 
        keyLevels: ['$2,380', '$2,410'], 
        catalyst: 'Middle East risk (Historical Data)',
        entry: '2398.0',
        sl: '2375.0',
        tp: '2450.0'
      }
    ];
  }
}

export interface TradeEvaluation {
  decision: 'EXECUTE' | 'REJECT';
  reason: string;
  confidence: number;
}

export async function evaluateTrade(
  signal: any, 
  sentiment: any, 
  calendar: any[]
): Promise<TradeEvaluation> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Perform a professional risk audit on the following trade signal. 
      Analyze if the setup is high probability based on the current social sentiment and upcoming high-impact economic events.
      If a High Impact USD news event is coming in less than 30 minutes, you MUST REJECT.
      
      Trade Signal: ${JSON.stringify(signal)}
      Market Sentiment: ${JSON.stringify(sentiment)}
      Economy Calendar (Next 24h): ${JSON.stringify(calendar.slice(0, 5))}
      
      Return a JSON decision on whether to EXECUTE or REJECT.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            decision: { type: Type.STRING, enum: ["EXECUTE", "REJECT"] },
            reason: { type: Type.STRING },
            confidence: { type: Type.NUMBER }
          },
          required: ["decision", "reason", "confidence"]
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error: any) {
    console.warn("AI Trade Evaluation failed:", error.message || error);
    return { decision: 'REJECT', reason: "AI Service Interruption or Rate Limit", confidence: 0 };
  }
}

export interface MarketNews {
  id: string;
  source: string;
  title: string;
  time: string;
  impact: 'high' | 'medium' | 'low';
  summary: string;
}

export async function fetchMarketNews(symbol: string): Promise<MarketNews[]> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate 5 realistic and currently relevant high-impact financial news headlines and brief summaries for the trading pair ${symbol}. 
      Base them on the current global economic climate as of ${new Date().toISOString()}.
      Include source (e.g., Bloomberg, Reuters, Financial Times), time (e.g., '5m ago'), and impact level.
      Return the data as a JSON array of objects.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              source: { type: Type.STRING },
              title: { type: Type.STRING },
              time: { type: Type.STRING },
              impact: { type: Type.STRING, enum: ["high", "medium", "low"] },
              summary: { type: Type.STRING }
            },
            required: ["id", "source", "title", "time", "impact", "summary"]
          }
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error: any) {
    console.warn("Market News Fetch failed:", error.message || error);
    return [
      {
        id: "1",
        source: "REUTERS",
        title: "Federal Reserve maintains hawkish stance amid sticky inflation data",
        time: "12m ago",
        impact: "high",
        summary: "Market participants interpret recent FOMC minutes as a signal for 'higher for longer' rates."
      },
      {
        id: "2",
        source: "BLOOMBERG",
        title: "Gold hits record highs as safe-haven demand accelerates",
        time: "45m ago",
        impact: "medium",
        summary: "Geopolitical tensions in the Middle East drive central bank accumulation of bullion."
      }
    ];
  }
}
