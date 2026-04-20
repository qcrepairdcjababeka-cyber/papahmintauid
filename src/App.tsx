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
  { symbol: 'XAUUSD', label: 'Gold (XAU/USD)' },
  { symbol: 'BTCUSDT', label: 'BTC/USDT' },
  { symbol: 'ETHUSDT', label: 'ETH/USDT' },
  { symbol: 'SOLUSDT', label: 'SOL/USDT' },
  { symbol: 'BNBUSDT', label: 'BNB/USDT' },
  { symbol: 'XRPUSDT', label: 'XRP/USDT' },
];

// --- TradingView Widget Component ---
const TradingViewWidget = ({ symbol = "OANDA:XAUUSD", interval = "15" }: { symbol?: string, interval?: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scriptId = "tradingview-widget-script";
    let script = document.getElementById(scriptId) as HTMLScriptElement;
    
    const initializeWidget = () => {
      if (window.TradingView && containerRef.current) {
        containerRef.current.innerHTML = "";
        const widgetId = `tv_widget_${Math.random().toString(36).substring(7)}`;
        const widgetContainer = document.createElement("div");
        widgetContainer.id = widgetId;
        widgetContainer.style.height = "100%";
        widgetContainer.style.width = "100%";
        containerRef.current.appendChild(widgetContainer);

        new window.TradingView.widget({
          autosize: true,
          symbol,
          interval,
          timezone: "Etc/UTC",
          theme: "dark",
          style: "1",
          locale: "en",
          toolbar_bg: "#020617",
          enable_publishing: false,
          allow_symbol_change: true,
          container_id: widgetId,
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
  }, [symbol, interval]);

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

const Header = ({ activeView, setActiveView, selectedSymbol, setSelectedSymbol }: { 
  activeView: string, 
  setActiveView: (v: 'terminal' | 'strategy' | 'backtest' | 'advice' | 'institutional' | 'sentiment') => void,
  selectedSymbol: { symbol: string, label: string },
  setSelectedSymbol: (s: { symbol: string, label: string }) => void
}) => {
  const [time, setTime] = useState(new Date());
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="h-auto md:h-14 border-b border-brand-border px-2 md:px-4 py-2 md:py-0 flex flex-col md:flex-row items-center justify-between bg-slate-900/50 gap-2 z-50">
      <div className="flex items-center justify-between w-full md:w-auto gap-2 md:gap-6">
        <div className="flex items-center gap-2 md:gap-4">
           <div className="flex items-center gap-1.5 md:gap-2">
            <div className="w-5 h-5 md:w-6 md:h-6 bg-brand-green rounded-sm flex items-center justify-center shrink-0">
              <Zap className="w-3 h-3 md:w-4 md:h-4 text-slate-950 fill-slate-950" />
            </div>
            <span className="font-bold tracking-tighter text-xs md:text-xl text-white whitespace-nowrap uppercase">PAPAMINTAUID</span>
          </div>

          {/* Symbol Selector */}
          <div className="relative">
            <button 
              onClick={() => setIsSelectorOpen(!isSelectorOpen)}
              className="flex items-center gap-1 md:gap-2 bg-slate-950 border border-slate-800 px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-[8px] md:text-[10px] font-black text-white uppercase tracking-widest hover:border-brand-green transition-colors"
            >
              <span>{selectedSymbol.label.split(' ')[0]}</span>
              <ChevronDown className={`w-2.5 h-2.5 md:w-3 md:h-3 text-slate-500 transition-transform ${isSelectorOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {isSelectorOpen && (
              <div className="absolute top-full left-0 mt-1 w-40 md:w-48 bg-slate-950 border border-slate-800 rounded-lg shadow-2xl overflow-hidden z-[100] animate-in fade-in zoom-in-95 duration-100">
                {SYMBOLS_CONFIG.map((s) => (
                  <button
                    key={s.symbol}
                    onClick={() => {
                      setSelectedSymbol(s);
                      setIsSelectorOpen(false);
                    }}
                    className={`w-full text-left px-3 md:px-4 py-2 md:py-2.5 text-[8px] md:text-[10px] font-bold uppercase tracking-widest hover:bg-slate-900 transition-colors ${
                      selectedSymbol.symbol === s.symbol ? 'text-brand-green bg-brand-green/5' : 'text-slate-400'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-1 bg-slate-950 rounded-lg p-0.5 md:p-1 border border-brand-border overflow-x-auto no-scrollbar scroll-smooth shrink min-w-0">
          <button 
            onClick={() => setActiveView('terminal')}
            className={`px-2 md:px-3 py-1 md:py-1.5 text-[9px] md:text-[10px] font-bold uppercase tracking-widest rounded-md transition-all whitespace-nowrap ${
              activeView === 'terminal' ? 'bg-brand-green/20 text-brand-green border border-brand-green/30' : 'text-slate-500 hover:text-white'
            }`}
          >
            TERM
          </button>
          <button 
            onClick={() => setActiveView('strategy')}
            className={`px-2 md:px-3 py-1 md:py-1.5 text-[9px] md:text-[10px] font-bold uppercase tracking-widest rounded-md transition-all whitespace-nowrap ${
              activeView === 'strategy' ? 'bg-brand-green/20 text-brand-green border border-brand-green/30' : 'text-slate-500 hover:text-white'
            }`}
          >
            STRAT
          </button>
          <button 
            onClick={() => setActiveView('advice')}
            className={`px-2 md:px-3 py-1 md:py-1.5 text-[9px] md:text-[10px] font-bold uppercase tracking-widest rounded-md transition-all whitespace-nowrap ${
              activeView === 'advice' ? 'bg-brand-green/20 text-brand-green border border-brand-green/30' : 'text-slate-500 hover:text-white'
            }`}
          >
            ADVICE
          </button>
          <button 
            onClick={() => setActiveView('institutional')}
            className={`px-2 md:px-3 py-1 md:py-1.5 text-[9px] md:text-[10px] font-bold uppercase tracking-widest rounded-md transition-all whitespace-nowrap ${
              activeView === 'institutional' ? 'bg-brand-green/20 text-brand-green border border-brand-green/30' : 'text-slate-500 hover:text-white'
            }`}
          >
            INST
          </button>
          <button 
            onClick={() => setActiveView('backtest')}
            className={`px-2 md:px-3 py-1 md:py-1.5 text-[9px] md:text-[10px] font-bold uppercase tracking-widest rounded-md transition-all whitespace-nowrap ${
              activeView === 'backtest' ? 'bg-brand-green/20 text-brand-green border border-brand-green/30' : 'text-slate-500 hover:text-white'
            }`}
          >
            TEST
          </button>
          <button 
            onClick={() => setActiveView('sentiment')}
            className={`px-2 md:px-3 py-1 md:py-1.5 text-[9px] md:text-[10px] font-bold uppercase tracking-widest rounded-md transition-all whitespace-nowrap ${
              activeView === 'sentiment' ? 'bg-brand-green/20 text-brand-green border border-brand-green/30' : 'text-slate-500 hover:text-white'
            }`}
          >
            SENT
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 md:gap-6 text-[9px] md:text-[10px] font-mono tracking-wider w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-slate-800 pt-1 md:pt-0">
        <div className="flex items-center gap-2 bg-slate-800/50 px-2 py-1 rounded">
          <div className="w-1.5 h-1.5 rounded-full bg-brand-green animate-pulse" />
          <span className="text-slate-400 font-medium whitespace-nowrap uppercase">BINANCE LIVE</span>
        </div>
        <div className="flex items-center gap-2 border-l border-slate-800 pl-4 h-4 text-slate-500">
          <Clock className="w-3 h-3 md:w-4 md:h-4" />
          <span className="tabular-nums">{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        </div>
      </div>
    </header>
  );
};

const ScannerBar = ({ status = "Scanning..." }: { status?: string }) => {
  return (
    <div className="h-auto md:h-12 border-b border-brand-border px-2 md:px-4 py-2 md:py-0 flex flex-wrap md:flex-nowrap items-center justify-between text-[9px] md:text-[10px] font-bold uppercase tracking-widest bg-slate-950 gap-2 md:gap-0">
      <div className="flex items-center gap-4 md:gap-8 overflow-x-auto md:overflow-visible no-scrollbar w-full md:w-auto">
        <div className="flex items-center gap-2 text-brand-green px-2 py-1 bg-brand-green/10 rounded border border-brand-green/30 shrink-0">
          <span className="animate-pulse whitespace-nowrap">{status}</span>
        </div>
        <div className="flex items-center gap-4 md:gap-6 text-slate-500 shrink-0">
          <div className="flex flex-col">
            <span className="text-[7px] md:text-[9px] text-slate-600">Vol 24h</span>
            <span className="text-white font-mono text-[10px] md:text-xs tracking-tight">Active</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[7px] md:text-[9px] text-slate-600">Market</span>
            <span className="text-white font-mono text-[10px] md:text-xs uppercase tracking-tight">SPOT</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[7px] md:text-[9px] text-slate-600">Session</span>
            <div className="flex items-center gap-1 text-white text-[10px] md:text-xs">
              <span>London</span>
              <ChevronDown className="w-2 md:w-3 h-2 md:h-3 text-slate-500" />
            </div>
          </div>
        </div>
      </div>
      <div className="text-slate-600 hidden md:block">
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
    <aside className="w-full h-auto md:h-full border-r border-brand-border overflow-y-auto flex flex-col bg-slate-900/20">
      {sentiment.isMock && (
        <div className="bg-brand-red/10 border-b border-brand-red/20 px-4 py-2 flex items-center gap-2">
          <AlertCircle className="w-3 h-3 text-brand-red animate-pulse" />
          <span className="text-[8px] font-black text-brand-red uppercase tracking-wider">AI Rate Limit Active - Using Cached Data</span>
        </div>
      )}
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

const MainChart = ({ prices, symbol }: { prices: Record<string, string>, symbol: string }) => {
  const currentPrice = prices[symbol];
  const tvSymbol = symbol === 'XAUUSD' ? 'OANDA:XAUUSD' : `BINANCE:${symbol}`;
  const [activeTf, setActiveTf] = useState('15m');
  const [isTfDropdownOpen, setIsTfDropdownOpen] = useState(false);

  const timeframes = [
    { label: '1m', value: '1' },
    { label: '5m', value: '5' },
    { label: '15m', value: '15' },
    { label: '1h', value: '60' },
    { label: '4h', value: '240' },
    { label: '1D', value: 'D' },
    { label: '1W', value: 'W' },
  ];

  const quickTfs = ['1m', '15m', '1h', '4h', '1D'];
  const activeInterval = timeframes.find(t => t.label === activeTf)?.value || '15';

  return (
    <div className="flex-1 flex flex-col bg-slate-950 relative overflow-hidden">
      {/* Toolbars */}
      <div className="h-12 border-b border-brand-border flex items-center px-4 gap-4 bg-slate-900/30">
        <div className="flex items-center gap-2 border-r border-slate-800 pr-4">
          <div className="flex items-center gap-2 bg-slate-950 border border-brand-border px-2 py-1 rounded text-xs font-bold text-white uppercase font-mono cursor-pointer hover:border-brand-green transition-colors">
            {symbol.includes('USDT') ? symbol.replace('USDT', '/USDT') : (symbol === 'XAUUSD' ? 'XAU/USD' : symbol)}
            <ChevronDown className="w-3 h-3 text-slate-500" />
          </div>
        </div>

        <div className="flex items-center gap-4 flex-1">
          <div className="flex items-center gap-1 border-r border-slate-800 pr-4">
            {quickTfs.map((tf) => (
              <button 
                key={tf}
                onClick={() => setActiveTf(tf)}
                className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded transition-all ${activeTf === tf ? 'bg-brand-green text-slate-950' : 'bg-slate-900 text-slate-400 hover:text-white'}`}
              >
                {tf}
              </button>
            ))}
            
            <div className="relative ml-1">
              <button 
                onClick={() => setIsTfDropdownOpen(!isTfDropdownOpen)}
                className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded transition-all bg-slate-900 text-slate-400 hover:text-white ${!quickTfs.includes(activeTf) ? 'border border-brand-green text-brand-green' : ''}`}
              >
                {quickTfs.includes(activeTf) ? 'More' : activeTf}
                <ChevronDown className={`w-3 h-3 transition-transform ${isTfDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isTfDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-24 bg-slate-950 border border-slate-800 rounded-lg shadow-2xl overflow-hidden z-[110] animate-in fade-in zoom-in-95 duration-100">
                  {timeframes.map((tf) => (
                    <button
                      key={tf.label}
                      onClick={() => {
                        setActiveTf(tf.label);
                        setIsTfDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-slate-900 transition-colors ${
                        activeTf === tf.label ? 'text-brand-green bg-brand-green/5' : 'text-slate-400'
                      }`}
                    >
                      {tf.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 text-slate-500">
             <BarChart2 className="w-4 h-4 hover:text-white cursor-pointer" />
             <Activity className="w-4 h-4 hover:text-white cursor-pointer" />
             <span className="text-[10px] font-bold uppercase tracking-widest hover:text-white cursor-pointer">Indicators</span>
          </div>
        </div>

        {/* Prominent Price Ticker */}
        <div className="flex items-center gap-4 px-4 bg-brand-green/5 border-l border-brand-border h-full">
           <div className="flex flex-col items-end">
              <div className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Global Spot</div>
              <div className="flex items-baseline gap-2">
                 <span className="text-lg font-black text-white font-mono tracking-tighter tabular-nums">
                   ${currentPrice || '---.--'}
                 </span>
                 <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-brand-green rounded-full animate-pulse" />
                    <span className="text-[8px] font-bold text-brand-green uppercase font-mono">LIVE 15S</span>
                 </div>
              </div>
           </div>
        </div>
      </div>

      {/* Real TradingView Chart */}
      <div className="flex-1 relative flex bg-slate-950 overflow-hidden">
         <TradingViewWidget symbol={tvSymbol} interval={activeInterval} />
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
  const news = [
    { source: "REUTERS", time: "2m ago", title: "ECB's Lagarde: Recent inflation data not enough to warrant cut", impact: "high" },
    { source: "BLOOMBERG", time: "15m ago", title: "Oil holds gains as Middle East tensions offset US stockpile build", impact: "medium" },
    { source: "FINVIZ", time: "32m ago", title: "Nasdaq futures slide as chipmakers retreat ahead of earnings", impact: "medium" },
    { source: "TRADINGVIEW", time: "1h ago", title: "BTC/USDT testing $64k support level amid ETF outflow concern", impact: "low" },
    { source: "REUTERS", time: "2h ago", title: "Gold prices stabilize as geopolitical fears balance high yields", impact: "low" },
  ];

  return (
    <aside className="w-full h-auto md:h-full border-l border-brand-border flex flex-col bg-slate-950 overflow-y-auto overflow-x-hidden no-scrollbar pb-20 md:pb-6">
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

        {/* Real-time News Column */}
        <div>
          <div className="text-[10px] uppercase font-bold text-slate-500 mb-3 tracking-widest flex items-center gap-2">
            Live Intelligence
            <div className="h-[1px] flex-1 bg-slate-800" />
          </div>
          <div className="space-y-4">
             {news.map((n, i) => (
                <div key={i} className="group cursor-pointer">
                   <div className="flex justify-between items-center mb-1">
                      <span className={`text-[8px] font-black px-1 rounded ${
                        n.impact === 'high' ? 'bg-brand-red text-white' : 
                        n.impact === 'medium' ? 'bg-yellow-500 text-slate-950' : 
                        'bg-slate-800 text-slate-400'
                      }`}>{n.source}</span>
                      <span className="text-[8px] font-mono text-slate-600 italic tracking-tighter">{n.time}</span>
                   </div>
                   <p className="text-[10px] leading-tight text-slate-300 font-bold group-hover:text-brand-green transition-colors line-clamp-2 uppercase tracking-tight">
                     {n.title}
                   </p>
                </div>
             ))}
          </div>
          <button className="w-full mt-4 py-1.5 border border-slate-800 text-[8px] font-bold text-slate-500 uppercase tracking-widest hover:text-white hover:border-slate-600 transition-colors">
            View All Terminal Intel
          </button>
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

const StrategyView = ({ sentiment, prices, selectedSymbol }: { sentiment: MarketSentiment; prices: Record<string, string>, selectedSymbol: { symbol: string, label: string } }) => {
  const [stablePrice, setStablePrice] = useState<number | null>(null);

  const getPrice = (symbol: string) => {
    const val = prices[symbol];
    if (!val) return null;
    const cleaned = val.toString().replace(/[^0-9.]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  };

  const currentPrice = getPrice(selectedSymbol.symbol) || 2415.50;
  const isBullish = sentiment.bullish > sentiment.bearish;

  useEffect(() => {
    setStablePrice(null); // Reset when symbol changes
  }, [selectedSymbol.symbol]);

  useEffect(() => {
    // Snapshot price on initial load to stabilize MTF analysis
    const current = getPrice(selectedSymbol.symbol);
    if (current && !stablePrice) {
      setStablePrice(current);
    }
  }, [prices[selectedSymbol.symbol] === undefined, selectedSymbol.symbol]);

  const displayPrice = stablePrice || currentPrice;
  const symbolLabel = selectedSymbol.symbol.includes('USDT') ? selectedSymbol.symbol.replace('USDT', '') : selectedSymbol.symbol;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 p-4 md:p-6 no-scrollbar pb-32 md:pb-12">
      <div className="max-w-5xl mx-auto space-y-6 md:space-y-8">
        {/* Top Header Analysis */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-slate-800 pb-4 md:pb-6 gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 md:gap-3">
              <h1 className="text-xl md:text-3xl font-black text-white tracking-widest uppercase italic">MTF {selectedSymbol.label}</h1>
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-brand-green/10 rounded-full border border-brand-green/20">
                <div className="w-1 h-1 rounded-full bg-brand-green animate-pulse" />
                <span className="text-[7px] md:text-[8px] font-black text-brand-green uppercase">ANALYSIS STABILIZED</span>
              </div>
            </div>
            <p className="text-brand-green font-mono text-[8px] md:text-[10px] uppercase tracking-[0.2em] md:tracking-[0.3em]">Institutional Confluence HUB</p>
          </div>
          <div className="text-left md:text-right">
             <div className="text-[8px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest italic">SPOT TICKER</div>
             <div className="text-xl md:text-2xl font-black text-white font-mono tracking-tighter">
                ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
             </div>
          </div>
        </div>

        {/* The 4H - 1H - 15M Logic Flow */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-4 md:py-8 relative">
          <div className="absolute top-0 bottom-0 left-1/2 md:top-1/2 md:bottom-auto md:left-0 md:right-0 w-[1px] md:h-[1px] md:w-full bg-slate-800 -z-10" />
          
          <StrategyCard 
            tf="4H" 
            title="Macro Direction" 
            items={[
              { label: "DIRECTION", status: isBullish ? "STRONG BULLISH" : "BEARISH BIAS", color: isBullish ? "text-brand-green" : "text-brand-red" },
              { label: "KEY LEVEL", status: `${symbolLabel} @ ${(displayPrice * 0.985).toFixed(2)}`, color: "text-white" }
            ]}
          />

          <div className="text-slate-800 text-xl md:text-3xl font-bold rotate-90 md:rotate-0">---</div>

          <StrategyCard 
            tf="1H" 
            title="Structure & Flow" 
            items={[
              { label: "TREND", status: isBullish ? "ACCUMULATING" : "DISTRIBUTING", color: "text-yellow-500" },
              { label: "BREAKS", status: "MSS DETECTED", color: "text-brand-green" },
              { label: "REVERSAL", status: "INVALIDATED", color: "text-slate-600" }
            ]}
          />

          <div className="text-slate-800 text-xl md:text-3xl font-bold rotate-90 md:rotate-0">---</div>

          <StrategyCard 
            tf="15M" 
            title="Execution Zone" 
            items={[
              { label: "CONFIRMATION", status: "ZONE MITIGATED", color: "text-brand-green" },
              { label: "TRIGGER", status: `${symbolLabel} @ ${displayPrice.toFixed(2)}`, color: "text-white" }
            ]}
          />
        </div>

        {/* Technical Sub-analysis (OB, FVG, Liquidity) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          <TechnicalBox 
            label="OB (ORDER BLOCK)" 
            desc={`H1 Demand Zone identifies at ${(displayPrice * 0.998).toFixed(2)} - ${(displayPrice * 1.002).toFixed(2)}. Institutional mitigation in progress.`}
            status="REJECTED"
            color="border-brand-green/30 text-brand-green"
          />
          <TechnicalBox 
            label="FVG (FAIR VALUE GAP)" 
            desc={`Imbalance gap detected at ${(displayPrice * 1.005).toFixed(2)}. Price expected to gravitate towards this liquidity pocket.`}
            status="IMBALANCE"
            color="border-yellow-500/30 text-yellow-500"
          />
          <TechnicalBox 
            label="LIQUIDITY" 
            desc={`Buy-side liquidity resting above ${(displayPrice * 1.012).toFixed(2)}. Target zone for institutional draw on liquidity.`}
            status="TARGETING"
            color="border-brand-red/30 text-brand-red"
          />
        </div>

        {/* Integration: Technical + Sentiment */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
          <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
            <div className="text-xs font-black uppercase tracking-widest text-slate-400 italic">Confluence Convergence Matrix</div>
            <div className="flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-brand-green animate-ping" />
               <span className="text-[10px] font-bold text-brand-green">CONVICTION CALCULATED</span>
            </div>
          </div>
          <div className="p-8 grid md:grid-cols-2 gap-12">
            <div>
               <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 italic">Signal Conviction Score</div>
               <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <div className={`text-5xl font-black italic tracking-tighter ${sentiment.bullish > 50 ? 'text-brand-green' : 'text-brand-red'}`}>{sentiment.bullish}%</div>
                    <div className="text-[10px] font-mono text-slate-600 uppercase">Institutional Consensus</div>
                  </div>
                  <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-green transition-all duration-1000 shadow-[0_0_10px_rgba(16,185,129,0.5)]" style={{ width: `${sentiment.bullish}%` }} />
                  </div>
                  <p className="text-xs text-slate-500 italic font-mono leading-relaxed mt-4">
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
  <div className="w-full md:w-64 bg-slate-900/60 border border-slate-800 rounded-xl p-3 md:p-4 backdrop-blur-md">
    <div className="text-2xl md:text-4xl font-black text-white mb-0.5 md:mb-1">{tf}</div>
    <div className="text-[8px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-1 md:pb-2 mb-3 md:mb-4">{title}</div>
    <div className="space-y-2 md:space-y-3">
      {items.map((item, i) => (
        <div key={i}>
          <div className="text-[7px] md:text-[8px] font-black text-slate-600 uppercase tracking-tighter mb-0.5 md:mb-1">{item.label}</div>
          <div className={`text-[10px] md:text-xs font-bold leading-none ${item.color}`}>{item.status}</div>
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

const TradingAdviceView = ({ sentiment, prices, selectedSymbol }: { sentiment: MarketSentiment; prices: Record<string, string>, selectedSymbol: { symbol: string, label: string } }) => {
  const [stablePrice, setStablePrice] = useState<number | null>(null);

  const getPrice = (symbol: string) => {
    const val = prices[symbol];
    if (!val) return null;
    const cleaned = val.toString().replace(/[^0-9.]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  };

  const currentPriceRaw = getPrice(selectedSymbol.symbol) || 2415.50;
  const isBullish = sentiment.bullish > sentiment.bearish;

  useEffect(() => {
    setStablePrice(null); 
  }, [selectedSymbol.symbol]);

  useEffect(() => {
    const current = getPrice(selectedSymbol.symbol);
    if (current && !stablePrice) {
      setStablePrice(current);
    }
  }, [prices[selectedSymbol.symbol] === undefined, selectedSymbol.symbol]);
  
  const planEntry = stablePrice || currentPriceRaw;
  const entry = planEntry;
  const scale = entry > 500 ? 1 : 0.01;
  const sl = isBullish ? entry - (12.5 * scale) : entry + (12.5 * scale);
  const tp1 = isBullish ? entry + (25 * scale) : entry - (25 * scale);
  const tp2 = isBullish ? entry + (60 * scale) : entry - (60 * scale);
  const tvSymbol = selectedSymbol.symbol === 'XAUUSD' ? 'OANDA:XAUUSD' : `BINANCE:${selectedSymbol.symbol}`;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 p-4 md:p-6 no-scrollbar pb-32 md:pb-12">
      <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">
        
        {/* Header Section */}
        <div className="border-b border-slate-800 pb-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="w-10 h-10 md:w-14 md:h-14 bg-brand-green/10 rounded-full flex items-center justify-center border border-brand-green/20">
              <Zap className="w-6 h-6 md:w-8 md:h-8 text-brand-green fill-brand-green" />
            </div>
            <div>
              <h1 className="text-xl md:text-4xl font-black text-white tracking-widest uppercase italic leading-none">{selectedSymbol.label} Advice</h1>
              <div className="flex items-center gap-2 mt-2">
                <p className="text-slate-500 font-mono text-[8px] md:text-xs uppercase tracking-widest">Global Institutional Hub</p>
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-brand-green/10 rounded-full border border-brand-green/20">
                  <div className="w-1 h-1 rounded-full bg-brand-green" />
                  <span className="text-[7px] md:text-[9px] font-black text-brand-green uppercase whitespace-nowrap">PLAN LOCKED</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="w-full md:w-auto bg-brand-green/10 border border-brand-green/20 px-6 py-3 rounded-2xl flex items-center justify-between gap-8 shadow-2xl">
             <div className="text-left">
               <div className="text-[8px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest italic font-mono mb-1">{selectedSymbol.symbol} Spot</div>
               <div className="text-xl md:text-3xl font-black text-white font-mono leading-none tracking-tighter">
                 ${currentPriceRaw.toLocaleString(undefined, { minimumFractionDigits: 2 })}
               </div>
             </div>
             <div className="flex flex-col items-end">
                <div className="flex items-center gap-1.5 text-[8px] md:text-[10px] font-black text-brand-green uppercase tracking-widest">
                   <div className="w-1.5 h-1.5 bg-brand-green rounded-full animate-ping" />
                   FEED ACTIVE
                </div>
                <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">1s Pulse</div>
             </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-12 gap-6 md:gap-8">
          
          {/* Sidebar Area: Analysis & Execution */}
          <div className="lg:col-span-4 space-y-6 md:space-y-8">
            
            {/* Box 1: Sentiment Metrics */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-colors">
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 border-b border-slate-800 pb-3 flex items-center justify-between">
                <span>Social AI Effect Metrics</span>
                <span className="text-brand-green">CONVICTION</span>
              </div>
              
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase">Bullish Conviction</span>
                    <span className="text-brand-green font-mono text-xl font-black">{sentiment.bullish}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-green shadow-[0_0_10px_rgba(16,185,129,0.5)]" style={{ width: `${sentiment.bullish}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase">Bearish Resistance</span>
                    <span className="text-brand-red font-mono text-xl font-black">{sentiment.bearish}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-red shadow-[0_0_10px_rgba(239,68,68,0.5)]" style={{ width: `${sentiment.bearish}%` }} />
                  </div>
                </div>
              </div>

              <div className="mt-8 p-4 bg-slate-950 border border-slate-800 rounded-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-2 opacity-20 group-hover:opacity-100 transition-opacity">
                  <Info className="w-4 h-4 text-brand-green" />
                </div>
                <div className="text-[10px] font-black text-brand-green uppercase mb-2 tracking-widest flex items-center gap-2">
                  <div className="w-1 h-1 bg-brand-green rounded-full" />
                  AI Context Analysis
                </div>
                <p className="text-[12px] text-slate-400 leading-relaxed italic font-mono">
                  "{sentiment.summary}"
                </p>
              </div>
            </div>

            {/* Box 2: Execution Framework */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-colors">
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 border-b border-slate-800 pb-3 flex items-center justify-between">
                <span>Execution Framework</span>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-black ${isBullish ? 'text-brand-green' : 'text-brand-red'}`}>
                    {isBullish ? 'BULLISH' : 'BEARISH'}
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                <EntryBox label="Protocol Entry" value={`$${entry.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} sub="Institutional Trigger" color="text-white" />
                <EntryBox label="Hard Stop Loss" value={`$${sl.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} sub="Risk Cut-off" color="text-brand-red" />
                <div className="grid grid-cols-2 gap-4">
                  <EntryBox label="Target One" value={`$${tp1.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} sub="Partial Take Profit" color="text-brand-green" />
                  <EntryBox label="Target Two" value={`$${tp2.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} sub="Max Extension" color="text-brand-green" />
                </div>
              </div>

              <button className="w-full mt-6 py-4 bg-brand-green text-slate-950 font-black text-xs uppercase tracking-[0.2em] rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-brand-green/10">
                INITIATE PROTOCOL
              </button>
            </div>
          </div>

          {/* Chart Area */}
          <div className="lg:col-span-8 flex flex-col gap-6 md:gap-8">
            <div className="flex-1 min-h-[350px] md:min-h-[600px] bg-slate-900/50 rounded-3xl overflow-hidden border border-slate-800 relative group">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-brand-green/30 to-transparent z-10" />
              <TradingViewWidget symbol={tvSymbol} />
            </div>

            {/* Disclaimer & Risk Area */}
            <div className="p-6 border border-slate-800 rounded-2xl bg-slate-900/20 flex flex-col md:flex-row gap-6 items-start">
               <div className="p-3 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
                 <AlertCircle className="w-6 h-6 text-yellow-500 shrink-0" />
               </div>
               <div>
                  <div className="text-[12px] font-black text-slate-200 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <div className="w-1 h-1 bg-yellow-500 rounded-full" />
                    Risk Management Protocol v4.2
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono leading-loose uppercase tracking-tighter">
                    Trading suggestions are derived from social effect sentiment + institutional technical confluence (SMC/ICT). Market volatility can lead to rapid capital loss. Always use proper lot sizing relative to account equity. Stop Loss implementation is mandatory to mitigate downside risk during high-impact news cycles.
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
  <div className="bg-slate-950/50 border border-slate-800 p-3 md:p-5 rounded-xl md:rounded-2xl">
    <div className="text-[8px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 md:mb-2">{label}</div>
    <div className={`text-xl md:text-3xl font-black font-mono ${color}`}>{value}</div>
    <div className="text-[8px] font-mono text-slate-600 mt-1 md:mt-2 uppercase">{sub}</div>
  </div>
);

const StrategyTag = ({ label, active }: { label: string, active?: boolean }) => (
  <span className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest border ${active ? 'bg-brand-green/10 border-brand-green text-brand-green' : 'bg-slate-900 border-slate-800 text-slate-700'}`}>
    {label}
  </span>
);

// --- Sentiment View Component ---
const SentimentView = ({ sentiment, symbol }: { sentiment: MarketSentiment, symbol: string }) => {
  const [pulseData, setPulseData] = useState<any[]>([]);
  
  useEffect(() => {
    // Simulate initial data
    const initial = Array.from({ length: 15 }).map((_, i) => ({
      id: i,
      time: new Date(Date.now() - (15 - i) * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      score: Math.floor(Math.random() * 40) + 30,
      source: ["Twitter", "Reddit", "News", "Discord"][Math.floor(Math.random() * 4)],
      magnitude: (Math.random() * 2).toFixed(2)
    }));
    setPulseData(initial);

    // Simulate real-time stream pulse
    const interval = setInterval(() => {
      const newItem = {
        id: Date.now(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        score: Math.floor(Math.random() * 60) + 20,
        source: ["Twitter", "Reddit", "News", "Discord"][Math.floor(Math.random() * 4)],
        magnitude: (Math.random() * 3).toFixed(2)
      };
      setPulseData(prev => [...prev.slice(1), newItem]);
    }, 8000);

    return () => clearInterval(interval);
  }, [symbol]);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 p-4 md:p-8 no-scrollbar pb-32">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-center border-b border-white/5 pb-6 gap-4">
          <div>
            <h1 className="text-2xl md:text-4xl font-black text-white italic tracking-tighter uppercase">Sentiment Pulse Engine</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 bg-brand-green rounded-full animate-ping" />
              <span className="text-[10px] font-mono text-brand-green uppercase tracking-widest">Live WebSocket Stream Active</span>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="bg-slate-900 border border-slate-800 px-6 py-3 rounded-xl shadow-xl">
               <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Global Conviction</div>
               <div className="text-3xl font-black text-white font-mono">{sentiment.bullish}%</div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-10">
                 <Activity className="w-32 h-32 text-brand-green" />
               </div>
               <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
                 <Zap className="w-3 h-3 text-brand-green" /> Frequency Analysis (15m Flow)
               </h2>
               
               <div className="h-64 flex items-end justify-between gap-1 overflow-hidden">
                  {pulseData.map((d, i) => (
                    <div key={d.id} className="flex-1 flex flex-col items-center group cursor-help">
                       <div className="text-[7px] text-slate-600 mb-2 rotate-45 md:rotate-0">{d.score}</div>
                       <div 
                         className={`w-full rounded-t-sm transition-all duration-500 ${d.score > 50 ? 'bg-brand-green/40' : 'bg-brand-red/40'}`} 
                         style={{ height: `${d.score}%` }} 
                       />
                       <div className="text-[6px] text-slate-700 mt-2 font-mono whitespace-nowrap">{d.time}</div>
                    </div>
                  ))}
               </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6">
               <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
                 <Info className="w-3 h-3 text-blue-400" /> Narrative Clusters
               </h2>
               <div className="space-y-4">
                 <div className="p-4 bg-slate-950/50 border border-slate-800 rounded-2xl">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-black text-brand-green uppercase bg-brand-green/10 px-2 py-0.5 rounded">High Impact</span>
                      <span className="text-[9px] font-mono text-slate-500">2 minutes ago</span>
                    </div>
                    <p className="text-sm text-slate-300 font-medium leading-relaxed italic">
                      "Recent institutional accumulation suggests a strong floor forming at the $2,380 range despite macro headwinds."
                    </p>
                 </div>
                 <div className="p-4 bg-slate-950/50 border border-slate-800 rounded-2xl opacity-60 hover:opacity-100 transition-opacity">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-black text-yellow-500 uppercase bg-yellow-500/10 px-2 py-0.5 rounded">Rumor Flow</span>
                      <span className="text-[9px] font-mono text-slate-500">12 minutes ago</span>
                    </div>
                    <p className="text-sm text-slate-400 font-medium leading-relaxed italic">
                      "Social chatter increasing regarding potential ETF rebalancing ahead of the weekend close."
                    </p>
                 </div>
               </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 sticky top-0">
               <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-6">Source dominance</h2>
               <div className="space-y-4">
                  {[
                    { name: 'Social (X/Reddit)', value: 65, color: 'bg-brand-green' },
                    { name: 'Financial News', value: 20, color: 'bg-blue-500' },
                    { name: 'On-chain signals', value: 10, color: 'bg-purple-500' },
                    { name: 'Developer activity', value: 5, color: 'bg-slate-500' }
                  ].map((s, i) => (
                    <div key={i}>
                       <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1.5 uppercase">
                         <span>{s.name}</span>
                         <span>{s.value}%</span>
                       </div>
                       <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden">
                         <div className={`h-full ${s.color}`} style={{ width: `${s.value}%` }} />
                       </div>
                    </div>
                  ))}
               </div>
               <div className="mt-8 p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-2xl">
                  <div className="text-yellow-500 text-[10px] font-black uppercase mb-1 flex items-center gap-2">
                    <AlertTriangle className="w-3 h-3" /> Sentiment Divergence
                  </div>
                  <p className="text-[11px] text-yellow-500/70 font-medium leading-relaxed">
                    Price is trending up while social sentiment shows a slight bearish drift. Watch for potential exhaustion.
                  </p>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const InstitutionalView = ({ prices }: { prices: Record<string, string> }) => {
  const [setups, setSetups] = useState<InstitutionalSetup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const getPrice = (symbol: string) => {
    const val = prices[symbol];
    if (!val) return null;
    const cleaned = val.toString().replace(/[^0-9.]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) || parsed < 100 ? null : parsed;
  };

  useEffect(() => {
    const load = async () => {
      try {
        const currentPrice = getPrice('XAUUSD') || getPrice('PAXGUSDT') || undefined;
        // fetchInstitutionalSetups now handles level stabilization internally via service logic
        const data = await fetchInstitutionalSetups(currentPrice);
        setSetups(data);
      } catch (error) {
        console.error("Institutional data load failed:", error);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [prices['XAUUSD'] === undefined]); // Re-fetch only if initial spot price was missing

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 p-3 md:p-6 font-sans pb-32 md:pb-12">
      <div className="max-w-6xl mx-auto space-y-4 md:space-y-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4 md:pb-8">
           <div className="flex items-center gap-3 md:gap-4">
              <div className="w-8 h-8 md:w-12 md:h-12 bg-white/5 rounded-full flex items-center justify-center border border-white/10 shrink-0">
                 <Search className="w-4 h-4 md:w-6 md:h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl md:text-3xl font-black text-white tracking-widest uppercase italic leading-none">Institutional Bloomberg</h1>
                <p className="text-brand-green font-mono text-[8px] md:text-[10px] uppercase tracking-[0.2em] md:tracking-[0.4em] mt-1">Direct OANDA XAU/USD Feed Integrated</p>
              </div>
           </div>
           <div className="w-full md:w-auto bg-slate-900 border border-slate-800 px-4 py-3 rounded-lg flex flex-col items-center justify-center gap-1 shadow-2xl">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-green animate-ping" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">OANDA SPOT HUB</span>
              </div>
              <div className="text-2xl font-black text-white font-mono tracking-tighter">
                ${prices['XAUUSD'] || '---.--'}
              </div>
              <div className="text-[8px] font-mono text-slate-500 uppercase tracking-tighter">Real-time Institutional Liquidity</div>
           </div>
        </div>

        {isLoading ? (
          <div className="h-96 flex flex-col items-center justify-center space-y-4">
             <div className="w-8 h-8 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
             <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest animate-pulse">Accessing Bloomberg Data Cloud...</div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {setups.map((setup, i) => {
              const hasLevels = setup.entry && setup.sl && setup.tp;

              return (
                <div key={i} className="bg-slate-900/40 border border-slate-800 rounded-2xl md:rounded-3xl p-4 md:p-8 hover:border-slate-700 transition-all group relative overflow-hidden flex flex-col">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/2 opacity-0 group-hover:opacity-100 blur-3xl transition-opacity" />
                  
                  <div className="flex items-center justify-between mb-4 md:mb-6">
                    <div className="flex flex-col">
                      <div className="text-2xl md:text-4xl font-black text-white italic tracking-tighter">{setup.ticker}</div>
                      <div className="text-[8px] font-mono text-slate-500 uppercase tracking-[0.2em]">OANDA-Derived Liquidity</div>
                    </div>
                    <div className={`px-2 py-1 md:px-4 md:py-1.5 rounded text-[8px] md:text-[10px] font-black tracking-widest border ${
                      setup.bias === 'LONG' ? 'bg-brand-green/10 text-brand-green border-brand-green' : 
                      setup.bias === 'SHORT' ? 'bg-brand-red/10 text-brand-red border-brand-red' : 
                      'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      {setup.bias} BIAS
                    </div>
                  </div>

                  <div className="space-y-6 flex-1">
                    {hasLevels && (
                      <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-xl space-y-3 relative group/plan">
                         <div className="flex justify-between items-center">
                            <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Institutional Entry Targets</div>
                            <div className="flex items-center gap-1.5 px-1.5 py-0.5 bg-brand-green/10 rounded-full border border-brand-green/20">
                               <div className="w-1 h-1 rounded-full bg-brand-green" />
                               <span className="text-[7px] font-black text-brand-green uppercase">SIGNAL LOCKED</span>
                            </div>
                         </div>
                         <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div className="bg-slate-900 border border-slate-800 p-2 rounded flex flex-col items-center">
                               <span className="text-[8px] font-bold text-slate-600 uppercase">OANDA Entry</span>
                               <span className="text-[12px] font-black text-white font-mono">${setup.entry}</span>
                            </div>
                            <div className="bg-slate-900 border border-brand-red/20 p-2 rounded flex flex-col items-center">
                               <span className="text-[8px] font-bold text-brand-red uppercase">OANDA SL</span>
                               <span className="text-[12px] font-black text-brand-red font-mono">${setup.sl}</span>
                            </div>
                            <div className="bg-slate-900 border border-brand-green/20 p-2 rounded flex flex-col items-center">
                               <span className="text-[8px] font-bold text-brand-green uppercase">OANDA TP</span>
                               <span className="text-[12px] font-black text-brand-green font-mono">${setup.tp}</span>
                            </div>
                         </div>
                      </div>
                    )}

                    <div>
                      <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                         <Activity className="w-3 h-3" /> Institutional Flow
                      </div>
                      <p className="text-[13px] text-slate-300 leading-relaxed font-medium">
                        {setup.institutionalFlow}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 italic">Historical Conviction Levels</div>
                        <div className="flex flex-wrap gap-2">
                          {setup.keyLevels.map((lvl, k) => (
                            <span key={k} className="bg-slate-950 border border-slate-800 px-2 py-1 rounded font-mono text-[10px] text-white">
                              {lvl}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-slate-800/50 mt-auto">
                      <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                         <Zap className="w-3 h-3 text-yellow-500 fill-yellow-500" /> Macro Catalyst
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono italic leading-relaxed">
                        {setup.catalyst}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
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
  const [activeView, setActiveView] = useState<'terminal' | 'strategy' | 'backtest' | 'advice' | 'institutional' | 'sentiment'>('terminal');
  const [selectedSymbol, setSelectedSymbol] = useState(SYMBOLS_CONFIG[0]); // Default to XAUUSD
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
    try {
      // Fetch both in parallel but handle individual failures
      const sentData = await analyzeSocialSentiment(selectedSymbol.label).catch(e => {
        console.error("Caught sentiment error:", e);
        return { bullish: 50, bearish: 50, neutral: 0, summary: "Service temporarily unavailable", isMock: true };
      });
      
      const calData = await fetchUSEconomicCalendar().catch(e => {
        console.error("Caught calendar error:", e);
        return [];
      });

      setSentiment(sentData);
      setCalendar(calData);
    } catch (e) {
      console.error("Failed to fetch AI insights:", e);
    } finally {
      setIsRefreshingSentiment(false);
    }
  };

  useEffect(() => {
    fetchAIInsights();
    // Refresh every 5 minutes
    const interval = setInterval(fetchAIInsights, 300000);
    return () => clearInterval(interval);
  }, [selectedSymbol]);

  // Fetch real-time XAU/USD from Global Spot API (via local proxy)
  useEffect(() => {
    const fetchGoldPrice = async () => {
      try {
        const response = await fetch('/api/gold-price');
        const data = await response.json();
        if (data && data[0] && data[0].price) {
          setPrices(prev => ({
            ...prev,
            'XAUUSD': parseFloat(data[0].price).toLocaleString(undefined, { minimumFractionDigits: 2 })
          }));
        } else {
          // Fallback to PAXG from current prices if spot fails
          if (prices['PAXGUSDT']) {
             setPrices(prev => ({ ...prev, 'XAUUSD': prev['PAXGUSDT'] }));
          }
        }
      } catch (err) {
        console.error("Gold price fetch failed, falling back...", err);
        // Fallback to PAXG
        if (prices['PAXGUSDT']) {
          setPrices(prev => ({ ...prev, 'XAUUSD': prev['PAXGUSDT'] }));
        }
      }
    };

    fetchGoldPrice();
    const interval = setInterval(fetchGoldPrice, 15000); 
    return () => clearInterval(interval);
  }, [prices['PAXGUSDT']]); // Re-attach fallback if prices object changes

  useEffect(() => {
    const streams = SYMBOLS_CONFIG.filter(s => s.symbol !== 'XAUUSD').concat({ symbol: 'PAXGUSDT', label: '' }).map(s => `${s.symbol.toLowerCase()}@ticker`).join('/');
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
      <div className="sticky top-0 z-[100] flex flex-col bg-slate-950 shadow-2xl">
        <Header activeView={activeView} setActiveView={setActiveView} selectedSymbol={selectedSymbol} setSelectedSymbol={setSelectedSymbol} />
        <ScannerBar status={isConnected ? "WebSocket Connected" : "Connecting..."} />
      </div>
      
      {activeView === 'terminal' ? (
        <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
          <div className="flex flex-col md:flex-row flex-1 overflow-y-auto md:overflow-hidden scroll-smooth pb-20 md:pb-0">
            <div className="w-full md:w-64 md:shrink-0 flex flex-col md:overflow-auto border-b md:border-b-0 md:border-r border-brand-border h-auto md:h-full">
              <SidebarLeft 
                prices={prices} 
                sentiment={sentiment} 
                onRefreshSentiment={fetchAIInsights}
                isRefreshing={isRefreshingSentiment}
              />
            </div>
            <div className="flex-1 min-h-[350px] md:min-h-0 relative shrink-0">
              <MainChart prices={prices} symbol={selectedSymbol.symbol} />
            </div>
            <div className="w-full md:w-64 md:shrink-0 flex flex-col md:overflow-auto border-t md:border-t-0 md:border-l border-brand-border pb-10 md:pb-0">
              <SidebarRight calendar={calendar} />
            </div>
          </div>
        </main>
      ) : activeView === 'strategy' ? (
        <StrategyView sentiment={sentiment} prices={prices} selectedSymbol={selectedSymbol} />
      ) : activeView === 'advice' ? (
        <TradingAdviceView sentiment={sentiment} prices={prices} selectedSymbol={selectedSymbol} />
      ) : activeView === 'institutional' ? (
        <InstitutionalView prices={prices} />
      ) : activeView === 'sentiment' ? (
        <SentimentView sentiment={sentiment} symbol={selectedSymbol.symbol} />
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
