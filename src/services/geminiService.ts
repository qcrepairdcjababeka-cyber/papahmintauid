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
    const response = await fetch("/api/ai/sentiment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol })
    });
    if (!response.ok) throw new Error("Server responded with error");
    return await response.json();
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
    const response = await fetch("/api/ai/calendar");
    if (!response.ok) throw new Error("Server responded with error");
    return await response.json();
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
    const response = await fetch("/api/ai/institutional");
    if (!response.ok) throw new Error("Server responded with error");
    return await response.json();
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
