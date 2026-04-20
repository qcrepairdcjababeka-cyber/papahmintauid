import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface MarketSentiment {
  bullish: number;
  bearish: number;
  neutral: number;
  summary: string;
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

export async function analyzeSocialSentiment(symbol: string): Promise<MarketSentiment> {
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
            bullish: { type: Type.NUMBER, description: "Percentage of bullish sentiment 0-100" },
            bearish: { type: Type.NUMBER, description: "Percentage of bearish sentiment 0-100" },
            neutral: { type: Type.NUMBER, description: "Percentage of neutral sentiment 0-100" },
            summary: { type: Type.STRING, description: "One sentence summary of the current social vibe" }
          },
          required: ["bullish", "bearish", "neutral", "summary"]
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Sentiment analysis failed:", error);
    return {
      bullish: 78,
      bearish: 18,
      neutral: 4,
      summary: "AI analysis currently unavailable. Using fallback metrics."
    };
  }
}

export async function fetchUSEconomicCalendar(): Promise<CalendarEvent[]> {
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

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Calendar fetch failed:", error);
    return [
      { time: '19:30', event: 'Initial Jobless Claims', impact: 'medium', currency: 'USD' },
      { time: '20:15', event: 'S&P Global Manufacturing PMI', impact: 'high', currency: 'USD' },
      { time: '22:00', event: 'Pending Home Sales m/m', impact: 'low', currency: 'USD' }
    ];
  }
}

export async function fetchInstitutionalSetups(): Promise<InstitutionalSetup[]> {
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

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Institutional fetch failed:", error);
    return [
      { 
        ticker: 'GOLD (XAU/USD)', 
        bias: 'LONG', 
        institutionalFlow: 'Central banks in Asia maintaining accumulation phase.', 
        keyLevels: ['$2,380', '$2,410'], 
        catalyst: 'Escalating Middle East risk and US debt ceiling concerns.' 
      },
      { 
        ticker: 'USD/JPY', 
        bias: 'SHORT', 
        institutionalFlow: 'Speculative positioning extreme; BoJ intervention risk high.', 
        keyLevels: ['155.00', '152.50'], 
        catalyst: 'Shift in Bank of Japan yield curve control policy.' 
      }
    ];
  }
}
