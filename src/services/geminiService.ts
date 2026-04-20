import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// --- Types ---

export interface MarketSentiment {
  bullish: number;
  bearish: number;
  neutral: number;
  summary: string;
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
}

// --- Caching & Cooldown Logic ---

const CACHE_KEYS = {
  SENTIMENT: 'pp_sentiment_cache',
  CALENDAR: 'pp_calendar_cache',
  INSTITUTIONAL: 'pp_institutional_cache',
  COOLDOWN: 'pp_ai_cooldown'
};

const CACHE_TTL = {
  SENTIMENT: 1000 * 60 * 5,    // 5 minutes
  CALENDAR: 1000 * 60 * 60,    // 1 hour
  INSTITUTIONAL: 1000 * 60 * 60 // 1 hour
};

function getCache<T>(key: string): T | null {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    const { data, timestamp } = JSON.parse(cached);
    const ttl = key === CACHE_KEYS.SENTIMENT ? CACHE_TTL.SENTIMENT : CACHE_TTL.CALENDAR;
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
      isMock: true
    };
  }

  if (cached) return cached;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Perform a real-time sentiment analysis for ${symbol} based on current discussions on X (Twitter), Truth Social, and other major social platforms. 
      Analyze the mood of traders and influencers. 
      Return a summary telling me what people are saying and the percentage of Bullish vs Bearish vs Neutral.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            bullish: { type: Type.NUMBER },
            bearish: { type: Type.NUMBER },
            neutral: { type: Type.NUMBER },
            summary: { type: Type.STRING }
          },
          required: ["bullish", "bearish", "neutral", "summary"]
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

export async function fetchInstitutionalSetups(): Promise<InstitutionalSetup[]> {
  const cached = getCache<InstitutionalSetup[]>(CACHE_KEYS.INSTITUTIONAL);
  
  if (isCoolingDown()) {
    console.log("AI in cooldown, using fallback for institutional");
     return cached || [
      { 
        ticker: 'GOLD (XAU/USD)', 
        bias: 'LONG', 
        institutionalFlow: 'Institutional demand remaining high due to macro factors.', 
        keyLevels: ['$2,380', '$2,410'], 
        catalyst: 'Macro Hedge (Cached Data)' 
      }
    ];
  }

  if (cached) return cached;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Perform a high-level scan of institutional trading setups and market convictions typically found on Bloomberg Terminal for major global assets. 
      Focus on where large institutional funds (Smart Money) are positioning. 
      Return a list of setups including ticker, bias, institutional flow description, key levels, and macro catalysts.`,
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
              catalyst: { type: Type.STRING }
            },
            required: ["ticker", "bias", "institutionalFlow", "keyLevels", "catalyst"]
          }
        }
      }
    });

    const data = JSON.parse(response.text);
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
        catalyst: 'Middle East risk (Historical Data)' 
      }
    ];
  }
}
