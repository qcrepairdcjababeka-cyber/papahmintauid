/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, 
  ChevronDown, 
  Clock, 
  Search, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  AlertCircle,
  Zap,
  BarChart2,
  Settings,
  Crosshair,
  Pencil,
  Type,
  Square,
  Circle,
  Info
} from 'lucide-react';

import { GoogleGenAI } from "@google/genai";
import { analyzeSocialSentiment, MarketSentiment, fetchUSEconomicCalendar, CalendarEvent, fetchInstitutionalSetups, InstitutionalSetup } from './services/geminiService';
import { BacktestView } from './components/BacktestView';

// --- Types ---
declare global {
  interface Window {
    TradingView: any;
  }
}

interface Asset {
  symbol: string;
  label: string;
  price: string;
  isUp: boolean;
  change: string;
}

interface SNRLevel {
  label: string;
  value: string;
  percent: string;
  type: 'resistance' | 'pivot' | 'support' | 'high' | 'low';
}

// --- Constants ---
const SYMBOLS_CONFIG = [
  { symbol: 'BTCUSDT', label: 'BTC/USDT' },
  { symbol: 'ETHUSDT', label: 'ETH/USDT' },
  { symbol: 'SOLUSDT', label: 'SOL/USDT' },
  { symbol: 'BNBUSDT', label: 'BNB/USDT' },
  { symbol: 'ADAUSDT', label: 'ADA/USDT' },
  { symbol: 'XRPUSDT', label: 'XRP/USDT' },
];

// --- TradingView Widget Component ---
const TradingViewWidget = ({ symbol = "OANDA:XAUUSD" }: { symbol?: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Only load the script if it hasn't been loaded
    const scriptId = "tradingview-widget-script";
    let script = document.getElementById(scriptId) as HTMLScriptElement;
    
    const initializeWidget = () => {
      if (window.TradingView && containerRef.current) {
        new window.TradingView.widget({
          autosize: true,
          symbol,
          interval: "15",
          timezone: "Etc/UTC",
          theme: "dark",
          style: "1",
          locale: "en",
          toolbar_bg: "#020617",
          enable_publishing: false,
          allow_symbol_change: true,
          container_id: containerRef.current.id,
          studies: ["MASimple@tv-basicstudies"],
          backgroundColor: "#020617",
          gridColor: "rgba(255, 255, 255, 0.05)",
        });
      }
    };

    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://s3.tradingview.com/tv.js";
      script.async = true;
      script.onload = initializeWidget;
      document.head.appendChild(script);
    } else {
      initializeWidget();
    }
  }, [symbol]);

  return (
    <div id="tradingview_chart" ref={containerRef} className="w-full h-full" />
  );
};

const SNR_LEVELS: SNRLevel[] = [
  { label: 'SWING HIGH', value: '4895.4', percent: '1.19%', type: 'high' },
  { label: 'SWING HIGH', value: '4874.6', percent: '0.76%', type: 'resistance' },
  { label: '24H HIGH', value: '4861.3', percent: '0.48%', type: 'high' },
  { label: 'R1', value: '4829.74', percent: '0.17%', type: 'resistance' },
  { label: 'PIVOT', value: '4813.87', percent: '0.50%', type: 'pivot' },
  { label: '24H LOW', value: '4807.9', percent: '0.62%', type: 'low' },
  { label: 'S1', value: '4784.14', percent: '1.11%', type: 'support' },
  { label: 'SWING LOW', value: '4725.2', percent: '2.33%', type: 'low' },
];

// --- Sub-Components ---

const Header = ({ activeView, setActiveView }: { activeView: string, setActiveView: (v: 'terminal' | 'strategy' | 'backtest' | 'advice' | 'institutional') => void }) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="h-14 border-b border-brand-border px-4 flex items-center justify-between bg-slate-900/50">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-brand-green rounded-sm flex items-center justify-center">
            <Zap className="w-4 h-4 text-slate-950 fill-slate-950" />
          </div>
          <span className="font-bold tracking-tighter text-xl text-white">PAPAMINTAUID AI</span>
        </div>
        
        <div className="flex items-center gap-1 bg-slate-950 rounded-lg p-1 border border-brand-border">
          <button 
            onClick={() => setActiveView('terminal')}
            className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all ${
              activeView === 'terminal' ? 'bg-brand-green/20 text-brand-green border border-brand-green/30' : 'text-slate-500 hover:text-white'
            }`}
          >
            Terminal
          </button>
          <button 
            onClick={() => setActiveView('strategy')}
            className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all ${
              activeView === 'strategy' ? 'bg-brand-green/20 text-brand-green border border-brand-green/30' : 'text-slate-500 hover:text-white'
            }`}
          >
            Strategy
          </button>
          <button 
            onClick={() => setActiveView('advice')}
            className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all ${
              activeView === 'advice' ? 'bg-brand-green/20 text-brand-green border border-brand-green/30' : 'text-slate-500 hover:text-white'
            }`}
          >
            Trading Advice
          </button>
          <button 
            onClick={() => setActiveView('institutional')}
            className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all ${
              activeView === 'institutional' ? 'bg-brand-green/20 text-brand-green border border-brand-green/30' : 'text-slate-500 hover:text-white'
            }`}
          >
            Institutional
          </button>
          <button 
            onClick={() => setActiveView('backtest')}
            className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all ${
              activeView === 'backtest' ? 'bg-brand-green/20 text-brand-green border border-brand-green/30' : 'text-slate-500 hover:text-white'
            }`}
          >
            Backtest
          </button>
        </div>
      </div>

      <div className="flex items-center gap-6 text-[10px] font-mono tracking-wider">
        <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded text-xs">
          <div className="w-2 h-2 rounded-full bg-brand-green animate-pulse" />
          <span className="text-slate-400 font-medium">Binance Real-Time</span>
        </div>
        <div className="flex items-center gap-2 text-slate-500">
          <Clock className="w-3 h-3" />
          <span>{time.toLocaleTimeString('en-US', { hour12: false })} UTC</span>
        </div>
        <div className="w-8 h-8 bg-slate-700 rounded-full border border-slate-600 hidden md:block" />
      </div>
    </header>
  );
};

const ScannerBar = ({ status = "Scanning..." }: { status?: string }) => {
  return (
    <div className="h-12 border-b border-brand-border px-4 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest bg-slate-950">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2 text-brand-green px-2 py-1 bg-brand-green/10 rounded border border-brand-green/30">
          <span className="animate-pulse">{status}</span>
        </div>
        <div className="flex items-center gap-6 text-slate-500">
          <div className="flex flex-col">
            <span className="text-[9px] text-slate-600">Vol 24h</span>
            <span className="text-white font-mono text-xs tracking-tight">Active</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] text-slate-600">Market</span>
            <span className="text-white font-mono text-xs uppercase tracking-tight">SPOT / PERP</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] text-slate-600">Session</span>
            <div className="flex items-center gap-1 text-white text-xs">
              <span>London</span>
              <ChevronDown className="w-3 h-3 text-slate-500" />
            </div>
          </div>
        </div>
      </div>
      <div className="text-slate-600">
        Source: <span className="text-brand-green">Binance WebSocket API</span>
      </div>
    </div>
  );
};

const SidebarLeft = ({ prices, sentiment, onRefreshSentiment, isRefreshing }: { 
  prices: Record<string, string>; 
  sentiment: MarketSentiment;
  onRefreshSentiment: () => void;
  isRefreshing: boolean;
}) => {
  return (
    <aside className="w-56 border-r border-brand-border overflow-y-auto flex flex-col bg-slate-900/20">
      {/* Search mock from design */}
      <div className="p-3">
        <input type="text" placeholder="Search Binance..." className="w-full bg-slate-800 border-none text-xs rounded px-2 py-1.5 text-slate-300 placeholder:text-slate-600 focus:ring-1 focus:ring-brand-green outline-none" />
      </div>

      {/* AI Sentiment */}
      <div className="px-4 py-4 border-b border-brand-border">
        <div className="text-[10px] uppercase font-bold text-slate-500 mb-3 tracking-widest flex items-center justify-between">
          <span>AI Sentiment</span>
          <button 
            onClick={onRefreshSentiment} 
            disabled={isRefreshing}
            className={`text-slate-600 hover:text-brand-green transition-colors ${isRefreshing ? 'animate-spin' : ''}`}
          >
            <Zap className="w-2.5 h-2.5" />
          </button>
        </div>
        <div className="text-center">
          <div className={`text-sm font-bold tracking-widest uppercase ${sentiment.bullish > sentiment.bearish ? 'text-brand-green' : 'text-brand-red'}`}>
            {sentiment.bullish > sentiment.bearish ? 'Bullish' : 'Bearish'}
          </div>
          <div className="w-full h-1 bg-slate-800 rounded-full mt-2 overflow-hidden flex gap-0.5">
            <div className="h-full bg-brand-green" style={{ width: `${sentiment.bullish}%` }} />
            <div className="h-full bg-brand-red" style={{ width: `${sentiment.bearish}%` }} />
            <div className="h-full bg-orange-400" style={{ width: `${sentiment.neutral}%` }} />
          </div>
          <div className="flex justify-between items-center mt-2 text-[9px] font-mono text-slate-500 uppercase">
             <span>Bull {sentiment.bullish}%</span>
             <span>Bear {sentiment.bearish}%</span>
          </div>
          <div className="mt-3 text-[9px] text-slate-600 italic leading-tight text-left">
            "{sentiment.summary}"
          </div>
        </div>
      </div>

      {/* Live Prices */}
      <div className="p-2 flex-1">
        <div className="px-2 py-2 text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-1 flex items-center justify-between">
          <span>Binance Data</span>
          <div className="w-1.5 h-1.5 bg-brand-green rounded-full animate-pulse" />
        </div>
        <div className="space-y-1">
          {SYMBOLS_CONFIG.map((conf) => (
            <div key={conf.symbol} className="flex items-center justify-between p-2 rounded hover:bg-slate-800/30 cursor-pointer group transition-all">
              <span className="text-xs font-bold text-slate-400 group-hover:text-white uppercase tracking-tighter">{conf.label}</span>
              <span className="text-[11px] font-mono font-bold text-white tabular-nums">
                {prices[conf.symbol] || 'Loading...'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* SNR Levels */}
      <div className="p-4 border-t border-brand-border bg-slate-900/30">
        <div className="flex items-center justify-between mb-3 text-[10px] uppercase font-bold text-slate-500 tracking-widest">
          SNR Levels
        </div>
        <div className="space-y-1">
          {SNR_LEVELS.map((level, i) => (
            <div 
              key={i} 
              className={`flex items-center justify-between p-1.5 rounded text-[10px] font-mono ${
                level.type === 'pivot' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800/20'
              }`}
            >
              <span className="font-bold uppercase tracking-tighter opacity-70">{level.label}</span>
              <span className={level.type === 'pivot' ? 'text-brand-green' : ''}>{level.value}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};

const MainChart = () => {
  return (
    <div className="flex-1 flex flex-col bg-slate-950 relative overflow-hidden">
      {/* Toolbars */}
      <div className="h-12 border-b border-brand-border flex items-center px-4 gap-4 bg-slate-900/30">
        <div className="flex items-center gap-2 border-r border-slate-800 pr-4">
          <div className="flex items-center gap-2 bg-slate-950 border border-brand-border px-2 py-1 rounded text-xs font-bold text-white">
            XAUUSD
            <ChevronDown className="w-3 h-3 text-slate-500" />
          </div>
        </div>

        <div className="flex items-center gap-1 border-r border-slate-800 pr-4">
          {['1m', '15m', '1h', '4h', '1D'].map((tf) => (
            <button 
              key={tf}
              className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded transition-all ${tf === '15m' ? 'bg-brand-green text-slate-950' : 'bg-slate-900 text-slate-400 hover:text-white'}`}
            >
              {tf}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 text-slate-500">
           <BarChart2 className="w-4 h-4 hover:text-white cursor-pointer" />
           <Activity className="w-4 h-4 hover:text-white cursor-pointer" />
           <span className="text-[10px] font-bold uppercase tracking-widest hover:text-white cursor-pointer">Indicators</span>
        </div>
      </div>

      {/* Real TradingView Chart */}
      <div className="flex-1 relative flex bg-slate-950 overflow-hidden">
         <TradingViewWidget />
      </div>

      {/* Positions Panel */}
      <div className="h-48 border-t border-brand-border bg-slate-900/50">
        <div className="flex border-b border-slate-800 text-[10px] uppercase font-bold tracking-widest text-slate-500">
          <button className="px-6 py-2 border-r border-slate-800 text-white bg-slate-800/30">Active Insight</button>
          <button className="px-6 py-2 border-r border-slate-800 hover:text-slate-300">Journal</button>
          <button className="px-6 py-2 hover:text-slate-300">Strategy Library</button>
        </div>
        <div className="p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between bg-rose-500/10 border border-brand-red/30 p-2 rounded text-[10px] text-brand-red font-bold uppercase tracking-widest">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3 h-3" />
              <span>Blackout Window: FOMC Member Williams Speaks</span>
            </div>
            <span>Active until 19:35 WIB</span>
          </div>
          <div className="bg-slate-950 border border-brand-border p-3 rounded-lg">
             <div className="text-yellow-500 text-[10px] font-black uppercase tracking-widest mb-1 flex items-center gap-2">
               <Clock className="w-3 h-3" /> Monitoring Phase
             </div>
             <p className="text-[11px] text-slate-400 italic font-mono leading-relaxed">
               TradingView chart integrated. Listening to Binance WebSocket for market pulse tracking. Ensure stable connection.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const SidebarRight = ({ calendar }: { calendar: CalendarEvent[] }) => {
  return (
    <aside className="w-80 border-l border-brand-border flex flex-col bg-slate-950 overflow-y-auto overflow-x-hidden">
      {/* Order Entry Placeholder Style */}
      <div className="p-4 border-b border-brand-border bg-slate-900/20">
         <div className="flex gap-2 mb-4">
            <button className="flex-1 py-2 bg-brand-green text-slate-950 text-[10px] font-black uppercase tracking-widest rounded shadow-lg shadow-brand-green/10">Buy / Long</button>
            <button className="flex-1 py-2 bg-slate-800 text-slate-400 text-[10px] font-black uppercase tracking-widest rounded">Sell / Short</button>
         </div>
         <div className="space-y-4">
            <OrderInput label="Entry Price" value="4,818.20" unit="USD" />
            <OrderInput label="Position Size" value="0.00" unit="LOT" />
            <div className="pt-2 flex justify-between text-[10px] font-bold uppercase tracking-widest text-slate-600">
               <span>Available Margin</span>
               <span className="text-white">$4,250.00</span>
            </div>
         </div>
      </div>

      {/* Market Context Refined */}
      <div className="p-4 space-y-6">
        <div>
          <div className="text-[10px] uppercase font-bold text-slate-500 mb-3 tracking-widest flex items-center gap-2">
            Market Context
            <div className="h-[1px] flex-1 bg-slate-800" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <RefinedWidget label="H1 Trend" value="Up" color="text-brand-green" />
            <RefinedWidget label="Session" value="London" color="text-white" />
            <RefinedWidget label="ATR (14)" value="0.143%" color="text-white" />
            <RefinedWidget label="Threshold" value="65" color="text-yellow-500" />
          </div>
        </div>

        <div>
           <div className="text-[10px] uppercase font-bold text-slate-500 mb-3 tracking-widest flex items-center gap-2">
            USA Economic Calendar
            <div className="h-[1px] flex-1 bg-slate-800" />
          </div>
          <div className="space-y-3">
             {calendar.length === 0 ? (
               <div className="text-[10px] text-slate-600 font-mono italic animate-pulse">Syncing USA Fed Frequencies...</div>
             ) : (
               calendar.map((ev, i) => (
                  <div key={i} className="flex gap-3 group">
                     <div className="flex flex-col items-center">
                        <div className={`w-1 h-full rounded-full transition-all ${ev.impact === 'high' ? 'bg-brand-red' : ev.impact === 'medium' ? 'bg-yellow-500' : 'bg-slate-800'}`} />
                     </div>
                     <div className="flex-1 pb-1">
                        <div className="flex justify-between items-start gap-2 h-4 overflow-hidden">
                          <span className="text-[10px] font-bold text-slate-300 truncate tracking-tight">{ev.event}</span>
                          <span className={`text-[8px] px-1 font-black leading-3 rounded ${ev.impact === 'high' ? 'bg-brand-red text-white' : ev.impact === 'medium' ? 'bg-yellow-500 text-slate-950' : 'bg-slate-800 text-slate-500'}`}>{ev.impact.toUpperCase()}</span>
                        </div>
                        <div className="text-[9px] font-mono text-slate-600 mt-0.5">{ev.currency} • {ev.time}</div>
                     </div>
                  </div>
               ))
             )}
          </div>
        </div>
      </div>
    </aside>
  );
};

const OrderInput = ({ label, value, unit }: { label: string, value: string, unit: string }) => (
  <div className="space-y-1">
    <label className="text-[9px] uppercase font-bold text-slate-500 tracking-tight">{label}</label>
    <div className="bg-slate-950 border border-slate-800 rounded flex items-center justify-between px-3 py-2">
      <span className="text-xs font-mono text-slate-100">{value}</span>
      <span className="text-[9px] font-bold text-slate-600">{unit}</span>
    </div>
  </div>
);

const RefinedWidget = ({ label, value, color }: { label: string, value: string, color: string }) => (
  <div className="bg-slate-900/40 border border-slate-800 p-2 rounded hover:border-slate-700 transition-colors">
    <div className="text-[8px] uppercase font-black text-slate-600 mb-0.5">{label}</div>
    <div className={`text-xs font-bold leading-tight ${color}`}>{value}</div>
  </div>
);

const ContextWidget = ({ label, value, color, sub }: { label: string, value: string, color: string, sub?: string }) => (
  <div className="bg-brand-card/50 border border-brand-border p-2 rounded-lg hover:ring-1 hover:ring-brand-border transition-all">
    <div className="text-[9px] text-brand-muted font-bold mb-1 uppercase truncate">{label}</div>
    <div className={`text-[13px] font-black tracking-tight ${color}`}>{value}</div>
    {sub && <div className="text-[8px] text-brand-muted mt-1 opacity-50">{sub}</div>}
  </div>
);

// --- Custom Icons ---
const PlusIcon = (props: any) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/>
  </svg>
);

const CandlestickIcon = (props: any) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M9 5v4"/><rect width="4" height="6" x="7" y="9" rx="1"/><path d="M9 15v4"/><path d="M17 3v2"/><rect width="4" height="8" x="15" y="5" rx="1"/><path d="M17 13v8"/>
  </svg>
);

// --- Strategy View Components ---

const StrategyView = ({ sentiment, prices }: { sentiment: MarketSentiment; prices: Record<string, string> }) => {
  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Top Header Analysis */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-black text-white tracking-tighter">MULTI-TIMEFRAME ANALYSIS</h1>
          <p className="text-slate-500 font-mono text-xs uppercase tracking-[0.2em]">Institutional Order Flow & Sentiment Integration</p>
        </div>

        {/* The 4H - 1H - 15M Logic Flow */}
        <div className="flex items-center justify-between gap-4 py-8 relative">
          <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-slate-800 -z-10" />
          
          <StrategyCard 
            tf="4H" 
            title="Macro Direction" 
            items={[
              { label: "DIRECTION", status: "BULLISH", color: "text-brand-green" },
              { label: "KEY LEVELS", status: "XAU @ 4813.0", color: "text-white" }
            ]}
          />

          <div className="text-slate-700 text-3xl font-bold">---</div>

          <StrategyCard 
            tf="1H" 
            title="Structure & Flow" 
            items={[
              { label: "TREND", status: "STABLE", color: "text-brand-green" },
              { label: "BREAKS", status: "MSS DETECTED", color: "text-yellow-500" },
              { label: "REVERSAL", status: "NONE", color: "text-slate-500" }
            ]}
          />

          <div className="text-slate-700 text-3xl font-bold">---</div>

          <StrategyCard 
            tf="15M" 
            title="Execution Zone" 
            items={[
              { label: "CONFIRMATION", status: "WAITING", color: "text-yellow-500" }
            ]}
          />
        </div>

        {/* Technical Sub-analysis (OB, FVG, Liquidity) */}
        <div className="grid grid-cols-3 gap-6">
          <TechnicalBox 
            label="OB (ORDER BLOCK)" 
            desc="H1 Demand Zone identified at 4805-4810. Waiting for mitigation."
            status="ACTIVE"
            color="border-brand-green/30 text-brand-green"
          />
          <TechnicalBox 
            label="FVG (FAIR VALUE GAP)" 
            desc="Imbalance detected on 15m TF above current price. Magnet target."
            status="DETECTED"
            color="border-yellow-500/30 text-yellow-500"
          />
          <TechnicalBox 
            label="LIQUIDITY" 
            desc="Sell-side liquidity resting below 4790 swing low."
            status="SWEEP PENDING"
            color="border-rose-500/30 text-rose-500"
          />
        </div>

        {/* Integration: Technical + Sentiment */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
            <div className="text-xs font-black uppercase tracking-widest text-slate-400">Decision Matrix (AI + Technical)</div>
            <div className="flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-brand-green animate-pulse" />
               <span className="text-[10px] font-bold text-brand-green">CONFLUENCE CALCULATED</span>
            </div>
          </div>
          <div className="p-8 grid md:grid-cols-2 gap-12">
            <div>
               <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Sentiment Confluence (X/Truth)</div>
               <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <div className={`text-4xl font-black ${sentiment.bullish > 50 ? 'text-brand-green' : 'text-brand-red'}`}>{sentiment.bullish}%</div>
                    <div className="text-[10px] font-mono text-slate-500 uppercase">Social Conviction Score</div>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-green transition-all duration-1000" style={{ width: `${sentiment.bullish}%` }} />
                  </div>
                  <p className="text-sm text-slate-400 italic font-mono leading-relaxed">
                    "{sentiment.summary}"
                  </p>
               </div>
            </div>

            <div className="flex flex-col justify-center">
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 text-center">Protocol Entry Decision</div>
              <div className="flex gap-4">
                <button className={`flex-1 group relative py-6 rounded-xl border-2 transition-all ${sentiment.bullish > 60 ? 'bg-brand-green/10 border-brand-green text-brand-green' : 'bg-slate-900 border-slate-800 text-slate-600'}`}>
                  <div className="text-xs font-black tracking-[0.3em] uppercase">INITIATE LONG</div>
                  <div className="text-[10px] mt-1 font-mono opacity-60">Prob: {(sentiment.bullish * 0.85).toFixed(1)}%</div>
                </button>
                <button className="flex-1 py-6 rounded-xl border-2 border-slate-800 bg-slate-900 text-slate-600 transition-all">
                  <div className="text-xs font-black tracking-[0.3em] uppercase">INITIATE SHORT</div>
                  <div className="text-[10px] mt-1 font-mono opacity-60">Prob: {(sentiment.bearish * 0.85).toFixed(1)}%</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StrategyCard = ({ tf, title, items }: { tf: string, title: string, items: { label: string, status: string, color: string }[] }) => (
  <div className="w-64 bg-slate-900/60 border border-slate-800 rounded-xl p-4 backdrop-blur-md">
    <div className="text-4xl font-black text-white mb-1">{tf}</div>
    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2 mb-4">{title}</div>
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i}>
          <div className="text-[8px] font-black text-slate-600 uppercase tracking-tighter mb-1">{item.label}</div>
          <div className={`text-xs font-bold leading-none ${item.color}`}>{item.status}</div>
        </div>
      ))}
    </div>
  </div>
);

const TechnicalBox = ({ label, desc, status, color }: { label: string, desc: string, status: string, color: string }) => (
  <div className={`bg-slate-900/30 border p-4 rounded-xl space-y-2 ${color.split(' ')[0]}`}>
    <div className="flex justify-between items-start">
      <div className="text-[10px] font-black uppercase tracking-widest">{label}</div>
      <div className={`text-[8px] font-black px-1.5 py-0.5 rounded border ${color}`}>{status}</div>
    </div>
    <p className="text-[11px] text-slate-500 font-mono leading-relaxed">{desc}</p>
  </div>
);

// --- Trading Advice View Components ---

const TradingAdviceView = ({ sentiment, prices }: { sentiment: MarketSentiment; prices: Record<string, string> }) => {
  const currentPriceRaw = prices['XAUUSDT'] ? parseFloat(prices['XAUUSDT'].replace(/,/g, '')) : 4813.50;
  const isBullish = sentiment.bullish > sentiment.bearish;
  
  // Calculate dynamic TP/SL
  const entry = currentPriceRaw;
  const sl = isBullish ? entry - 12.5 : entry + 12.5;
  const tp1 = isBullish ? entry + 25 : entry - 25;
  const tp2 = isBullish ? entry + 50 : entry - 50;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Page Header */}
        <div className="border-b border-slate-800 pb-6 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-black text-white tracking-widest flex items-center gap-4 uppercase">
              <Zap className="w-10 h-10 text-brand-green fill-brand-green" /> 
              Trading Advice Panel
            </h1>
            <p className="text-slate-500 font-mono text-xs uppercase tracking-[0.3em] mt-2">Powered by Social AI Effect Sentiment Engine</p>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-black text-slate-600 uppercase mb-1">Status</div>
            <div className="px-3 py-1 bg-brand-green/5 border border-brand-green/20 text-brand-green rounded-full text-[10px] font-bold">LIVE ANALYSIS ACTIVE</div>
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-8">
          {/* Social Sentiment Column */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 border-b border-slate-800 pb-3 flex items-center justify-between">
                <span>Social AI Effect Metrics</span>
                <span className="text-brand-green">X / Truth Social</span>
              </div>
              
              <div className="space-y-8">
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Bullish Conviction</span>
                    <span className="text-brand-green font-mono text-xl font-black">{sentiment.bullish}%</span>
                  </div>
                  <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-green shadow-[0_0_8px_rgba(16,185,129,0.5)]" style={{ width: `${sentiment.bullish}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Bearish Resistance</span>
                    <span className="text-brand-red font-mono text-xl font-black">{sentiment.bearish}%</span>
                  </div>
                  <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-red shadow-[0_0_8px_rgba(239,68,68,0.5)]" style={{ width: `${sentiment.bearish}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Market Neutrality</span>
                    <span className="text-orange-400 font-mono text-xl font-black">{sentiment.neutral}%</span>
                  </div>
                  <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.5)]" style={{ width: `${sentiment.neutral}%` }} />
                  </div>
                </div>
              </div>

              <div className="mt-8 p-4 bg-slate-950 border border-slate-800 rounded-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-1 opacity-10 group-hover:opacity-100 transition-opacity">
                  <Info className="w-3 h-3 text-brand-green" />
                </div>
                <div className="text-[10px] font-black text-brand-green uppercase mb-2">AI Summary Output</div>
                <p className="text-[11px] text-slate-400 leading-relaxed italic font-mono">
                  "{sentiment.summary}"
                </p>
              </div>
            </div>
          </div>

          {/* Entry Suggestion Column */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-slate-900/60 border border-brand-green/20 rounded-2xl p-8 relative overflow-hidden backdrop-blur-xl">
               <div className="absolute top-0 right-0 w-32 h-32 bg-brand-green/5 blur-3xl -z-10" />
               
               <div className="flex items-center justify-between mb-8">
                 <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full animate-pulse ${isBullish ? 'bg-brand-green' : 'bg-brand-red'}`} />
                    <h2 className="text-2xl font-black text-white tracking-widest uppercase">
                       {isBullish ? 'Institutional LONG Proposal' : 'Institutional SHORT Proposal'}
                    </h2>
                 </div>
                 <div className="text-[10px] font-mono text-slate-500 uppercase">Model: ICT/SMC Integrated</div>
               </div>

               <div className="grid md:grid-cols-3 gap-8">
                  <EntryBox label="Entry Level" value={entry.toFixed(2)} sub="Execution Zone" color="text-white" />
                  <EntryBox label="Stop Loss" value={sl.toFixed(2)} sub="Invalidation Point" color="text-brand-red" />
                  <div className="space-y-4">
                    <EntryBox label="Take Profit 1" value={tp1.toFixed(2)} sub="Partial TP (50%)" color="text-brand-green" />
                    <EntryBox label="Take Profit 2" value={tp2.toFixed(2)} sub="Moonbag Target" color="text-brand-green" />
                  </div>
               </div>

               <div className="mt-12 grid md:grid-cols-2 gap-6 pt-8 border-t border-slate-800">
                  <div className="space-y-3">
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Strategy Application</div>
                    <div className="flex flex-wrap gap-2">
                       <StrategyTag label="MSS DETECTED" active />
                       <StrategyTag label="FVG MITIGATION" active />
                       <StrategyTag label="LD SWEEP" />
                    </div>
                  </div>
                  <div className="flex items-center justify-end">
                    <button className="px-8 py-4 bg-brand-green text-slate-950 font-black text-xs uppercase tracking-[0.2em] rounded-xl hover:scale-105 active:scale-95 transition-all shadow-xl shadow-brand-green/10">
                      COPY ENTRY PLAN
                    </button>
                  </div>
               </div>
            </div>

            {/* Disclaimer */}
            <div className="p-4 border border-slate-800 rounded-xl bg-slate-900/20 flex gap-4 items-start">
               <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5 shrink-0" />
               <div>
                  <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Risk Management Protocol</div>
                  <p className="text-[10px] text-slate-500 font-mono leading-relaxed">
                    Trading suggestion is derived from current social effect sentiment + SMC technical confluence. Always use proper lot sizing. SL is mandatory to prevent account depletion on news spikes.
                  </p>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const EntryBox = ({ label, value, sub, color }: { label: string, value: string, sub: string, color: string }) => (
  <div className="bg-slate-950/50 border border-slate-800 p-5 rounded-2xl">
    <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">{label}</div>
    <div className={`text-3xl font-black font-mono ${color}`}>{value}</div>
    <div className="text-[9px] font-mono text-slate-600 mt-2 uppercase">{sub}</div>
  </div>
);

const StrategyTag = ({ label, active }: { label: string, active?: boolean }) => (
  <span className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest border ${active ? 'bg-brand-green/10 border-brand-green text-brand-green' : 'bg-slate-900 border-slate-800 text-slate-700'}`}>
    {label}
  </span>
);

// --- Institutional View Components ---

const InstitutionalView = () => {
  const [setups, setSetups] = useState<InstitutionalSetup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const data = await fetchInstitutionalSetups();
      setSetups(data);
      setIsLoading(false);
    };
    load();
  }, []);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 p-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-8">
           <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
                 <Search className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-white tracking-widest uppercase italic">Institutional Bloomberg Terminal</h1>
                <p className="text-slate-500 font-mono text-[10px] uppercase tracking-[0.4em]">High-Conviction Smart Money Flow & Macro Thesis</p>
              </div>
           </div>
           <div className="bg-brand-green/10 border border-brand-green/30 px-4 py-2 rounded flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-brand-green animate-pulse" />
              <span className="text-[10px] font-black text-brand-green uppercase tracking-widest">Global Macro Feed Live</span>
           </div>
        </div>

        {isLoading ? (
          <div className="h-96 flex flex-col items-center justify-center space-y-4">
             <div className="w-8 h-8 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
             <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest animate-pulse">Accessing Bloomberg Data Cloud...</div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {setups.map((setup, i) => (
              <div key={i} className="bg-slate-900/40 border border-slate-800 rounded-3xl p-8 hover:border-slate-700 transition-all group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/2 opacity-0 group-hover:opacity-100 blur-3xl transition-opacity" />
                
                <div className="flex items-center justify-between mb-6">
                  <div className="text-4xl font-black text-white italic tracking-tighter">{setup.ticker}</div>
                  <div className={`px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest ${
                    setup.bias === 'LONG' ? 'bg-brand-green/10 text-brand-green border border-brand-green/20' : 
                    setup.bias === 'SHORT' ? 'bg-brand-red/10 text-brand-red border border-brand-red/20' : 
                    'bg-slate-800 text-slate-400'
                  }`}>
                    {setup.bias} BIAS
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                       <Activity className="w-3 h-3" /> Institutional Flow
                    </div>
                    <p className="text-[13px] text-slate-300 leading-relaxed font-medium">
                      {setup.institutionalFlow}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 italic">Key Levels</div>
                      <div className="flex flex-wrap gap-2">
                        {setup.keyLevels.map((lvl, k) => (
                          <span key={k} className="bg-slate-950 border border-slate-800 px-2 py-1 rounded font-mono text-[10px] text-white">
                            {lvl}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-800/50">
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                       <Zap className="w-3 h-3 text-yellow-500 fill-yellow-500" /> Macro Catalyst
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono italic leading-relaxed">
                      {setup.catalyst}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bloomberg-style footer info */}
        <div className="flex flex-wrap gap-12 pt-8 border-t border-slate-800">
           <TerminalStat label="Terminal ID" value="BBG-729-AIS" />
           <TerminalStat label="Data Stream" value="Level II Realtime" />
           <TerminalStat label="Latency" value="0.08ms" />
           <TerminalStat label="Source" value="Institutional Consensus" />
        </div>
      </div>
    </div>
  );
};

const TerminalStat = ({ label, value }: { label: string, value: string }) => (
  <div className="flex flex-col">
    <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{label}</div>
    <div className="text-[11px] font-mono text-slate-400">{value}</div>
  </div>
);

// --- Main App with Hooks ---

export default function App() {
  const [activeView, setActiveView] = useState<'terminal' | 'strategy' | 'backtest' | 'advice' | 'institutional'>('terminal');
  const [calendar, setCalendar] = useState<CalendarEvent[]>([]);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [sentiment, setSentiment] = useState<MarketSentiment>({
    bullish: 78,
    bearish: 18,
    neutral: 4,
    summary: "Scanning social frequencies..."
  });
  const [isRefreshingSentiment, setIsRefreshingSentiment] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const fetchAIInsights = async () => {
    setIsRefreshingSentiment(true);
    // Fetch both in parallel
    const [sentData, calData] = await Promise.all([
      analyzeSocialSentiment('Gold XAUUSD'),
      fetchUSEconomicCalendar()
    ]);
    setSentiment(sentData);
    setCalendar(calData);
    setIsRefreshingSentiment(false);
  };

  useEffect(() => {
    fetchAIInsights();
    // Refresh every 5 minutes
    const interval = setInterval(fetchAIInsights, 300000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const streams = SYMBOLS_CONFIG.map(s => `${s.symbol.toLowerCase()}@ticker`).join('/');
    const url = `wss://stream.binance.com:9443/ws/${streams}`;
    
    const connect = () => {
      const ws = new WebSocket(url);
      
      ws.onopen = () => {
        setIsConnected(true);
        console.log('Connected to Binance WebSocket');
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.s && data.c) {
          setPrices(prev => ({
            ...prev,
            [data.s]: parseFloat(data.c).toLocaleString(undefined, { 
              minimumFractionDigits: data.s.includes('USDT') ? 2 : 5 
            })
          }));
        }
      };
      
      ws.onclose = () => {
        setIsConnected(false);
        setTimeout(connect, 5000); // Reconnect
      };

      wsRef.current = ws;
    };

    connect();
    return () => wsRef.current?.close();
  }, []);

  return (
    <div className="flex flex-col h-screen overflow-hidden font-sans bg-slate-950">
      <Header activeView={activeView} setActiveView={setActiveView} />
      <ScannerBar status={isConnected ? "WebSocket Connected" : "Connecting..."} />
      {activeView === 'terminal' ? (
        <main className="flex-1 flex overflow-hidden">
          <SidebarLeft 
            prices={prices} 
            sentiment={sentiment} 
            onRefreshSentiment={fetchAIInsights}
            isRefreshing={isRefreshingSentiment}
          />
          <MainChart />
          <SidebarRight calendar={calendar} />
        </main>
      ) : activeView === 'strategy' ? (
        <StrategyView sentiment={sentiment} prices={prices} />
      ) : activeView === 'advice' ? (
        <TradingAdviceView sentiment={sentiment} prices={prices} />
      ) : activeView === 'institutional' ? (
        <InstitutionalView />
      ) : (
        <BacktestView />
      )}
      
      <footer className="h-6 border-t border-slate-800 flex items-center justify-between px-3 text-[9px] uppercase tracking-tighter text-slate-500 bg-slate-950">
        <div className="flex space-x-4">
           <span className="flex items-center"><span className="w-1.5 h-1.5 bg-brand-green rounded-full mr-1"></span> Live Data Pipeline Active</span>
           <span>Binance Latency: ~12ms</span>
        </div>
        <div className="flex space-x-4">
           <span className="flex items-center gap-1 hover:text-white cursor-pointer"><Settings className="w-2.5 h-2.5" /> Market Status: Open</span>
           <span className="flex items-center gap-1 hover:text-white cursor-pointer"><Info className="w-2.5 h-2.5" /> Terminal v1.4.5-stable</span>
        </div>
      </footer>
    </div>
  );
}
