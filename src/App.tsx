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
  Info,
  Shield,
  Maximize2,
  Minimize2,
  ChevronUp,
  Cpu,
  X
} from 'lucide-react';

import { GoogleGenAI } from "@google/genai";
import { analyzeSocialSentiment, MarketSentiment, fetchUSEconomicCalendar, CalendarEvent, evaluateTrade, TradeEvaluation, fetchMarketNews, MarketNews } from './services/geminiService';
import { fetchCandles, detectFVGs, updateInverseFVGs, detectOrderBlocks, calculateLiquidityLevels, detectSignals, FVG, OrderBlock, Candle, LiquidityLevels, TradeSignal, Position } from './services/tradingService';

// --- Types ---
declare global {
  interface Window {
    TradingView: any;
  }
}

const getCurrentSession = () => {
  const h = new Date().getUTCHours();
  if (h >= 8 && h < 13) return "London";
  if (h >= 13 && h < 17) return "London/NY";
  if (h >= 17 && h < 22) return "New York";
  if (h >= 22 || h < 0) return "Sydney";
  if (h >= 0 && h < 8) return "Tokyo";
  return "London"; // Fallback
};

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
  { symbol: 'XAUUSD', label: 'Gold (Institutional)' },
  { symbol: 'BTCUSDT', label: 'BTC/USDT' },
  { symbol: 'ETHUSDT', label: 'ETH/USDT' },
  { symbol: 'SOLUSDT', label: 'SOL/USDT' },
  { symbol: 'BNBUSDT', label: 'BNB/USDT' },
  { symbol: 'XRPUSDT', label: 'XRP/USDT' },
];

const FALLBACK_PRICES: Record<string, string> = {
  'XAUUSD': '2650.00',
  'BTCUSDT': '78100.00',
  'ETHUSDT': '2450.00',
  'SOLUSDT': '185.00',
  'BNBUSDT': '540.00',
  'XRPUSDT': '0.72'
};

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
          width: "100%",
          height: "100%",
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

const PriceTicker = ({ price, prevPrice, className = "" }: { price: string, prevPrice?: string, className?: string }) => {
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  
  useEffect(() => {
    if (prevPrice && price !== prevPrice) {
      const isUp = parseFloat(price) > parseFloat(prevPrice);
      setFlash(isUp ? 'up' : 'down');
      const timer = setTimeout(() => setFlash(null), 300);
      return () => clearTimeout(timer);
    }
  }, [price, prevPrice]);

  const flashClass = flash === 'up' ? 'text-brand-green' : flash === 'down' ? 'text-brand-red' : '';
  
  return (
    <span className={`${className} transition-colors duration-200 ${flashClass}`}>
      {price}
    </span>
  );
};

const Header = ({ selectedSymbol, setSelectedSymbol }: { 
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
    <header className="h-auto md:h-9 border-b border-brand-border px-2 md:px-4 py-1 flex flex-col md:flex-row items-center justify-between bg-slate-900/50 gap-2 z-50">
      <div className="flex items-center justify-between w-full md:w-auto gap-2 md:gap-6">
        <div className="flex items-center gap-2 md:gap-4">
           <div className="flex items-center gap-1.5 md:gap-2">
            <div className="w-4 h-4 md:w-5 md:h-5 bg-brand-green rounded-sm flex items-center justify-center shrink-0">
              <Zap className="w-2.5 h-2.5 md:w-3 md:h-3 text-slate-950 fill-slate-950" />
            </div>
            <span className="font-bold tracking-tighter text-[10px] md:text-lg text-white whitespace-nowrap uppercase">PAPAMINTAUID</span>
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
          <div className="px-2 md:px-3 py-1 md:py-1.5 text-[9px] md:text-[10px] font-bold uppercase tracking-widest rounded-md transition-all whitespace-nowrap bg-brand-green/20 text-brand-green border border-brand-green/30">
            TERM
          </div>
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

const ScannerBar = ({ status = "Scanning...", provider, onProviderChange }: { 
  status?: string; 
  provider: 'binance' | 'coinbase';
  onProviderChange: (p: 'binance' | 'coinbase') => void;
}) => {
  return (
    <div className="h-auto md:h-8 border-b border-brand-border px-2 md:px-4 py-1 md:py-0 flex flex-wrap md:flex-nowrap items-center justify-between text-[8px] md:text-[9px] font-bold uppercase tracking-widest bg-slate-950 gap-2 md:gap-0">
      <div className="flex items-center gap-4 md:gap-8 overflow-x-auto md:overflow-visible no-scrollbar w-full md:w-auto">
        <div className="flex items-center gap-2 text-brand-green px-1.5 py-0.5 bg-brand-green/10 rounded border border-brand-green/20 shrink-0">
          <span className="animate-pulse whitespace-nowrap text-[8px] md:text-[9px]">{status}</span>
        </div>
        <div className="flex items-center gap-3 md:gap-5 text-slate-500 shrink-0">
          <div className="flex flex-col cursor-pointer group" onClick={() => onProviderChange(provider === 'binance' ? 'coinbase' : 'binance')}>
            <span className="text-[6px] md:text-[8px] text-slate-600 group-hover:text-brand-green transition-colors">Data Feed</span>
            <span className="text-white font-mono text-[9px] md:text-[10px] tracking-tight uppercase flex items-center gap-1 group-hover:text-brand-green transition-colors">
              {provider} <Crosshair className="w-2 h-2 opacity-20" />
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[6px] md:text-[8px] text-slate-600">Market</span>
            <span className="text-white font-mono text-[9px] md:text-[10px] uppercase tracking-tight">SPOT</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[6px] md:text-[8px] text-slate-600">Session</span>
            <div className="flex items-center gap-1 text-white text-[9px] md:text-[10px]">
              <span>{getCurrentSession()}</span>
              <ChevronDown className="w-2 md:w-3 h-2 md:h-3 text-slate-500" />
            </div>
          </div>
        </div>
      </div>
      <div className="text-slate-600 hidden md:block">
        Source: <span className="text-brand-green">OANDA XAU / {provider === 'binance' ? 'Binance' : 'Coinbase'} WS</span>
      </div>
    </div>
  );
};

const SidebarLeft = ({ prices, sentiment, onRefreshSentiment, isRefreshing, onSelectSymbol, selectedSymbol }: { 
  prices: Record<string, string>; 
  sentiment: MarketSentiment;
  onRefreshSentiment: () => void;
  isRefreshing: boolean;
  onSelectSymbol: (s: any) => void;
  selectedSymbol: any;
}) => {
  return (
    <aside className="w-full h-auto md:h-full border-r border-brand-border overflow-y-auto flex flex-col bg-slate-900/20">
      {sentiment.isMock && (
        <div className="bg-brand-red/10 border-b border-brand-red/20 px-4 py-2 flex items-center gap-2">
          <AlertCircle className="w-3 h-3 text-brand-red animate-pulse" />
          <span className="text-[8px] font-black text-brand-red uppercase tracking-wider">AI Rate Limit Active - Using Cached Data</span>
        </div>
      )}
      {/* Remove Search bar for simplicity */}
      
      {/* Market Tickers */}
      <div className="p-3 flex-1">
        <div className="px-1 py-2 text-[9px] uppercase font-black text-slate-600 tracking-widest flex items-center justify-between mb-1">
          <span>Pulse</span>
          <div className="w-1 h-1 bg-brand-green rounded-full animate-pulse" />
        </div>
        <div className="space-y-0.5">
          {SYMBOLS_CONFIG.map((conf) => {
            const currentPrice = prices[conf.symbol];
            const isActive = selectedSymbol.symbol === conf.symbol;
            const formattedPrice = currentPrice ? parseFloat(currentPrice).toLocaleString(undefined, { 
              minimumFractionDigits: conf.symbol.includes('USDT') || conf.symbol === 'XAUUSD' ? 2 : 5 
            }) : '---';
            
            return (
              <div 
                key={conf.symbol} 
                onClick={() => onSelectSymbol(conf)}
                className={`flex items-center justify-between p-2 rounded cursor-pointer transition-all ${
                  isActive ? 'bg-white/5 border-l-2 border-brand-green' : 'hover:bg-white/5 border-l-2 border-transparent'
                }`}
              >
                <div className="flex flex-col">
                  <span className={`text-[9px] font-bold uppercase tracking-tight ${isActive ? 'text-white' : 'text-slate-500'}`}>
                    {conf.symbol.replace('USDT', '')}
                  </span>
                </div>
                <div className={`text-[10px] font-mono tabular-nums ${isActive ? 'text-brand-green' : 'text-slate-400'}`}>
                  <PriceTicker price={formattedPrice} />
                </div>
              </div>
            );
          })}
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

const MainChart = ({ prices, symbol, dataProvider, isMaximized, onToggleMaximize }: { 
  prices: Record<string, string>, 
  symbol: string, 
  dataProvider: 'binance' | 'coinbase',
  isMaximized: boolean,
  onToggleMaximize: () => void
}) => {
  const currentPrice = prices[symbol];
  const [prevPrice, setPrevPrice] = useState<string | undefined>();
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  
  useEffect(() => {
    if (currentPrice) setPrevPrice(currentPrice);
  }, [currentPrice]);

  // Dynamic Symbol Selection: Align Chart with Data Provider
  const getTvSymbol = () => {
    if (symbol === 'XAUUSD') return 'OANDA:XAUUSD'; // Global Benchmark
    
    const prefix = dataProvider.toUpperCase();
    // Coinbase uses USD instead of USDT
    const cleanSymbol = dataProvider === 'coinbase' ? symbol.replace('USDT', 'USD') : symbol;
    return `${prefix}:${cleanSymbol}`;
  };

  const tvSymbol = getTvSymbol();
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
    <div className={`flex-1 flex flex-col bg-slate-950 relative ${isMaximized ? 'z-[100] h-screen w-screen fixed inset-0' : 'h-full'}`}>
      {/* Toolbars - Hidden completely when maximized for true full screen */}
      {!isMaximized && (
        <div className="h-8 md:h-9 border-b border-brand-border flex items-center px-2 md:px-4 gap-2 md:gap-4 bg-slate-900/30 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2 border-r border-slate-800 pr-2 md:pr-4 shrink-0">
            <div className="flex items-center gap-1.5 bg-slate-950 border border-brand-border px-1.5 md:px-2 py-0.5 rounded text-[9px] md:text-[10px] font-bold text-white uppercase font-mono cursor-pointer hover:border-brand-green transition-colors">
              {symbol.includes('USDT') ? symbol.replace('USDT', '') : (symbol === 'XAUUSD' ? 'GOLD' : symbol)}
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
            <div className="flex items-center gap-1 border-r border-slate-800 pr-2 md:pr-4 overflow-x-auto no-scrollbar shrink-0">
              {quickTfs.map((tf) => (
                <button 
                  key={tf}
                  onClick={() => setActiveTf(tf)}
                  className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded transition-all whitespace-nowrap ${activeTf === tf ? 'bg-brand-green text-slate-950' : 'bg-slate-900 text-slate-400 hover:text-white'}`}
                >
                  {tf}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 md:gap-4 text-slate-500 shrink-0">
               <span className="text-[9px] font-bold uppercase tracking-widest hover:text-white cursor-pointer mr-auto hidden md:block">Indicators</span>
               
               <button 
                 onClick={onToggleMaximize}
                 className="p-1 rounded hover:bg-slate-800 transition-colors text-slate-400 hover:text-white flex items-center gap-1.5"
                 title="Expand Chart"
               >
                 <Maximize2 className="w-3.5 h-3.5" />
                 <span className="text-[8px] font-black uppercase tracking-widest hidden md:block">EXPAND</span>
               </button>
            </div>
          </div>

          {/* Prominent Price Ticker */}
          <div className="flex items-center gap-2 md:gap-4 px-2 md:px-4 bg-brand-green/5 border-l border-brand-border h-full shrink-0">
             <div className="flex flex-col items-end">
                <div className="flex items-baseline gap-1 md:gap-2">
                   <div className="text-sm md:text-lg font-black text-white font-mono tracking-tighter tabular-nums transition-all duration-75">
                     <PriceTicker price={currentPrice || '---.--'} prevPrice={prevPrice} />
                   </div>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Floating Exit Button for Maximized Mode */}
      {isMaximized && (
        <button 
          onClick={onToggleMaximize}
          className="absolute top-4 right-4 z-[120] bg-brand-red/80 hover:bg-brand-red text-white p-2 rounded flex items-center gap-2 px-3 shadow-xl animate-in fade-in zoom-in duration-300"
        >
          <Minimize2 className="w-3.5 h-3.5" />
          <span className="text-[9px] font-black uppercase tracking-[0.2em]">CLOSE TERMINAL VIEW</span>
        </button>
      )}

      {/* Real TradingView Chart */}
      <div className="flex-grow min-h-0 relative bg-slate-950 h-full w-full">
         <TradingViewWidget symbol={tvSymbol} interval={activeInterval} />
         
         {/* Live Overlay in Cinema Mode */}
         {isMaximized && (
           <div className="absolute bottom-6 left-6 z-[110] bg-slate-950/80 backdrop-blur border border-slate-800 p-4 rounded-2xl flex flex-col gap-1 shadow-2xl pointer-events-none">
             <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{symbol} Real-time</div>
             <div className="text-2xl font-black text-white font-mono tracking-tighter">
               $<PriceTicker price={currentPrice || '---.--'} prevPrice={prevPrice} />
             </div>
             <div className="flex items-center gap-2 mt-1">
               <div className="w-2 h-2 bg-brand-green rounded-full animate-pulse" />
               <span className="text-[8px] font-bold text-brand-green uppercase tracking-widest">Institutional Socket Connected</span>
             </div>
           </div>
         )}
      </div>
    </div>
  );
};

const SidebarRight = ({ 
  calendar, fvgs, obs, levels, signals, symbol, interval, 
  isAutoTrading, setIsAutoTrading, positions, lastAudit, setPositions,
  accountBalance, totalProfit, news
}: { 
  calendar: CalendarEvent[],
  fvgs: FVG[],
  obs: OrderBlock[],
  levels: LiquidityLevels | null,
  signals: TradeSignal[],
  symbol: string,
  interval: string,
  isAutoTrading: boolean,
  setIsAutoTrading: (val: boolean) => void,
  positions: Position[],
  lastAudit: string,
  setPositions: React.Dispatch<React.SetStateAction<Position[]>>,
  accountBalance: number,
  totalProfit: number,
  news: MarketNews[]
}) => {
  const activePositions = positions.filter(p => p.status === 'OPEN');
  const finishedTrades = positions.filter(p => p.status === 'CLOSED').slice(0, 5);

  const closePosition = (id: string) => {
    setPositions(prev => prev.map(p => {
      if (p.id === id) return { ...p, status: 'CLOSED', result: 'MANUAL', closeTime: Date.now() };
      return p;
    }));
  };

  return (
    <aside className="w-full h-auto md:h-full border-l border-brand-border flex flex-col bg-slate-950 overflow-y-auto overflow-x-hidden no-scrollbar">
      {/* AI Bot & Portfolio Stats */}
      <div className="p-4 border-b border-brand-border bg-slate-900/10">
        <div className="grid grid-cols-2 gap-2 mb-4">
           <div className="p-2 border border-slate-800 rounded bg-slate-950">
              <div className="text-[7px] text-slate-500 uppercase font-black tracking-widest mb-1">AI Equity</div>
              <div className="text-xs font-mono font-bold text-white">${accountBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
           </div>
           <div className="p-2 border border-slate-800 rounded bg-slate-950">
              <div className="text-[7px] text-slate-500 uppercase font-black tracking-widest mb-1">Total PnL</div>
              <div className={`text-xs font-mono font-bold ${totalProfit >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>
                {totalProfit >= 0 ? '+' : '-'}${Math.abs(totalProfit).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </div>
           </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="text-[10px] uppercase font-black text-slate-400 tracking-widest flex items-center gap-2">
            <Cpu className={`w-3.5 h-3.5 ${isAutoTrading ? 'text-brand-green animate-pulse' : 'text-slate-600'}`} />
            Auto Bot
          </div>
          <button 
            onClick={() => setIsAutoTrading(!isAutoTrading)}
            className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${
              isAutoTrading 
              ? 'bg-brand-red/10 text-brand-red border border-brand-red/30' 
              : 'bg-brand-green/10 text-brand-green border border-brand-green/30'
            }`}
          >
            {isAutoTrading ? 'Deactivate' : 'Activate Bot'}
          </button>
        </div>

        {/* AI Audit Log */}
        {lastAudit && (
          <div className="mb-4 p-2 rounded bg-slate-950 border border-slate-800">
            <div className="text-[7px] text-slate-600 font-black uppercase mb-1">AI Auditor Logs</div>
            <div className="text-[9px] text-slate-400 font-mono leading-tight">{lastAudit}</div>
          </div>
        )}

        {/* Active Positions */}
        <div className="space-y-2">
          {activePositions.length === 0 ? (
            <div className="text-[8px] text-slate-600 font-mono italic text-center py-2">
              No Active Positions
            </div>
          ) : (
            activePositions.map(pos => (
              <div key={pos.id} className="p-3 rounded-lg border border-slate-800 bg-slate-900/40">
                <div className="flex justify-between items-center mb-2">
                  <span className={`text-[10px] font-black ${pos.type === 'LONG' ? 'text-brand-green' : 'text-brand-red'}`}>
                    {pos.symbol} {pos.type}
                  </span>
                  <div className="flex gap-2 items-center">
                    <span className={`text-[10px] font-mono font-bold ${pos.pnl >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>
                      {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toFixed(2)}
                    </span>
                    <button 
                      onClick={() => closePosition(pos.id)}
                      className="text-slate-600 hover:text-white transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                   <div className="flex flex-col">
                      <span className="text-[7px] text-slate-500 uppercase">Entry</span>
                      <span className="text-[9px] text-white font-mono">{pos.entry.toFixed(2)}</span>
                   </div>
                   <div className="flex flex-col text-right">
                      <span className="text-[7px] text-slate-500 uppercase">Dist to TP</span>
                      <span className="text-[9px] text-brand-green font-mono">
                        {Math.abs(pos.tp - pos.entry).toFixed(2)}
                      </span>
                   </div>
                </div>
                {/* Progress bar simulation for PnL */}
                <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                   <div 
                     className={`h-full transition-all duration-300 ${pos.pnl >= 0 ? 'bg-brand-green' : 'bg-brand-red'}`} 
                     style={{ width: `${Math.min(Math.abs(pos.pnlPercent) * 5, 100)}%` }} 
                   />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* History */}
      {finishedTrades.length > 0 && (
        <div className="p-4 border-b border-brand-border">
          <div className="text-[9px] uppercase font-black text-slate-600 mb-3 tracking-widest">Trade History</div>
          <div className="space-y-2">
            {finishedTrades.map(t => (
              <div key={t.id} className="flex justify-between items-center text-[9px] font-mono">
                <div className="flex items-center gap-2">
                   <span className={t.result === 'TP' ? 'text-brand-green' : 'text-brand-red'}>●</span>
                   <span className="text-slate-400">{t.symbol}</span>
                </div>
                <span className={t.pnl >= 0 ? 'text-brand-green' : 'text-brand-red'}>
                   {t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strategy High Probability Setups */}
      <div className="p-4 border-b border-brand-border bg-brand-green/[0.03]">
        <div className="text-[10px] uppercase font-black text-brand-green mb-4 tracking-[0.2em] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 fill-brand-green" />
            Prob Setups
          </div>
          <span className="text-[8px] opacity-60">ICT LQD</span>
        </div>

        <div className="space-y-3">
          {signals.length === 0 ? (
            <div className="text-[9px] text-slate-500 font-mono text-center py-4 border border-slate-900 rounded bg-slate-900/20 italic">
              Scanning Liquidity Sweeps...
            </div>
          ) : (
            signals.map((sig) => (
              <div key={`${sig.timestamp}-${sig.entry}`} className={`p-3 rounded-xl border animate-in fade-in slide-in-from-right duration-300 ${
                sig.type === 'BULLISH_BIAS' ? 'bg-brand-green/10 border-brand-green/30' : 
                sig.type === 'BEARISH_BIAS' ? 'bg-brand-red/10 border-brand-red/30' : 'bg-blue-500/10 border-blue-500/30'
              }`}>
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-[10px] font-black uppercase tracking-widest ${
                    sig.type === 'BULLISH_BIAS' ? 'text-brand-green' : 
                    sig.type === 'BEARISH_BIAS' ? 'text-brand-red' : 'text-blue-400'
                  }`}>
                    {sig.type.replace('_', ' ')}
                  </span>
                  <Activity className="w-3 h-3 text-slate-500" />
                </div>
                <p className="text-[9px] text-slate-300 leading-tight mb-3 uppercase tracking-tight font-medium">
                  {sig.description}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col">
                    <span className="text-[7px] text-slate-500">ENTRY</span>
                    <span className="text-[10px] font-bold text-white tabular-nums">{sig.entry.toFixed(2)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[7px] text-slate-500">STOP</span>
                    <span className="text-[10px] font-bold text-brand-red tabular-nums">{sig.sl.toFixed(2)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[7px] text-slate-500">TARGET</span>
                    <span className="text-[10px] font-bold text-brand-green tabular-nums">{sig.tp.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Liquidity Levels */}
      {levels && (
        <div className="p-4 border-b border-brand-border">
          <div className="text-[9px] uppercase font-black text-slate-500 mb-3 tracking-widest">Macro Liquidity</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 rounded bg-slate-900/40 border border-slate-800">
              <div className="text-[7px] text-slate-500">PDH</div>
              <div className="text-[10px] font-mono text-white">{levels.pdh.toFixed(2)}</div>
            </div>
            <div className="p-2 rounded bg-slate-900/40 border border-slate-800">
              <div className="text-[7px] text-slate-500">PDL</div>
              <div className="text-[10px] font-mono text-white">{levels.pdl.toFixed(2)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Gap Flow Panel */}
      <div className="p-4 border-b border-brand-border bg-brand-green/[0.02]">
        <div className="text-[10px] uppercase font-black text-brand-green mb-4 tracking-[0.2em] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-3 h-3 fill-brand-green" />
            Gap Flow M5
          </div>
          <span className="text-[8px] opacity-50">{interval}</span>
        </div>
        
        <div className="space-y-3 mb-4">
          {fvgs.length === 0 ? (
            <div className="text-[10px] text-slate-600 font-mono italic p-2 border border-slate-800 rounded bg-slate-900/40">
              Detecting Fair Value Gaps...
            </div>
          ) : (
            fvgs.slice(-3).reverse().map((f) => (
              <div key={`${f.top}-${f.bottom}-${f.type}-${f.isInverse}`} className={`p-2 rounded-lg border flex flex-col gap-1.5 transition-all hover:bg-white/5 ${
                f.isInverse 
                ? (f.type === 'bull' ? 'bg-brand-green/20 border-brand-green/30' : 'bg-brand-red/20 border-brand-red/30') 
                : (f.type === 'bull' ? 'bg-slate-900 border-slate-800' : 'bg-slate-900 border-slate-800')
              }`}>
                <div className="flex justify-between items-center">
                  <span className={`text-[10px] font-black uppercase tracking-widest ${
                    f.type === 'bull' ? 'text-brand-green' : 'text-brand-red'
                  }`}>
                    {f.isInverse ? 'Inverse ' : ''}{f.type === 'bull' ? 'Bullish' : 'Bearish'} FVG
                  </span>
                </div>
                <div className="flex justify-between text-[11px] font-mono text-white">
                   <div className="flex flex-col">
                      <span className="text-[7px] text-slate-500">BOT</span>
                      <span>{f.bottom.toFixed(2)}</span>
                   </div>
                   <div className="flex flex-col text-right">
                      <span className="text-[7px] text-slate-500">TOP</span>
                      <span>{f.top.toFixed(2)}</span>
                   </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Economic Calendar Section */}
      <div className="p-4 border-b border-brand-border">
         <div className="text-[10px] uppercase font-bold text-slate-500 mb-3 tracking-widest flex items-center gap-2">
          Economic Calendar
          <div className="h-[1px] flex-1 bg-slate-800" />
        </div>
        <div className="space-y-3">
           {calendar.length === 0 ? (
             <div className="text-[10px] text-slate-600 font-mono italic">Syncing USA Fed Frequencies...</div>
           ) : (
             calendar.slice(0, 5).map((ev) => (
                <div key={`${ev.event}-${ev.time}`} className="flex gap-3">
                   <div className={`w-1 h-auto rounded-full ${ev.impact === 'high' ? 'bg-brand-red' : ev.impact === 'medium' ? 'bg-yellow-500' : 'bg-slate-800'}`} />
                   <div className="flex-1">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-[10px] font-bold text-slate-300 truncate tracking-tight">{ev.event}</span>
                        <span className={`text-[8px] px-1 font-black rounded ${ev.impact === 'high' ? 'bg-brand-red text-white' : ev.impact === 'medium' ? 'bg-yellow-500 text-slate-950' : 'bg-slate-800 text-slate-500'}`}>{ev.impact.toUpperCase()}</span>
                      </div>
                      <div className="text-[9px] font-mono text-slate-600 mt-0.5">{ev.currency} • {ev.time}</div>
                   </div>
                </div>
             ))
           )}
        </div>
      </div>

      {/* Market News Section */}
      <div className="p-4 border-b border-brand-border">
        <div className="text-[10px] uppercase font-bold text-slate-500 mb-3 tracking-widest flex items-center gap-2">
          Market Intelligence
          <div className="h-[1px] flex-1 bg-slate-800" />
        </div>
        <div className="space-y-4">
          {news.length === 0 ? (
             <div className="text-[10px] text-slate-600 font-mono italic">Fetching global intel...</div>
          ) : (
            news.map((item) => (
              <div key={item.id} className="group cursor-pointer">
                <div className="flex justify-between items-center mb-1">
                  <span className={`text-[8px] font-black px-1 rounded ${
                    item.impact === 'high' ? 'bg-brand-red text-white' : 
                    item.impact === 'medium' ? 'bg-yellow-500 text-slate-950' : 
                    'bg-slate-800 text-slate-400'
                  }`}>{item.source}</span>
                  <span className="text-[8px] font-mono text-slate-600 italic tracking-tighter">{item.time}</span>
                </div>
                <p className="text-[10px] leading-tight text-slate-300 font-bold group-hover:text-brand-green transition-colors line-clamp-2 uppercase tracking-tight">
                  {item.title}
                </p>
                <p className="text-[8px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                  {item.summary}
                </p>
              </div>
            ))
          )}
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

const ContextItem = ({ label, value }: { label: string, value: string }) => (
  <div className="flex justify-between items-center py-1">
    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">{label}</span>
    <span className="text-[10px] font-black text-white italic">{value}</span>
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

// --- Main App with Hooks ---

export default function App() {
  const [selectedSymbol, setSelectedSymbol] = useState(SYMBOLS_CONFIG[0]); // Default to XAUUSD
  const [isChartMaximized, setIsChartMaximized] = useState(false);
  const [mobileTab, setMobileTab] = useState<'chart' | 'markets' | 'intel'>('chart');
  const [calendar, setCalendar] = useState<CalendarEvent[]>([]);
  const [prices, setPrices] = useState<Record<string, string>>(FALLBACK_PRICES);
  const [isConnected, setIsConnected] = useState(false);
  const [dataProvider, setDataProvider] = useState<'binance' | 'coinbase'>('binance');
  const [sentiment, setSentiment] = useState<MarketSentiment>({
    bullish: 78,
    bearish: 18,
    neutral: 4,
    summary: "Scanning social frequencies..."
  });
  const [isRefreshingSentiment, setIsRefreshingSentiment] = useState(false);
  const [fvgs, setFvgs] = useState<FVG[]>([]);
  const [obs, setObs] = useState<OrderBlock[]>([]);
  const [liquidity, setLiquidity] = useState<LiquidityLevels | null>(null);
  const [signals, setSignals] = useState<TradeSignal[]>([]);
  const [isAutoTrading, setIsAutoTrading] = useState(false);
  const [positions, setPositions] = useState<Position[]>([]);
  const [accountBalance, setAccountBalance] = useState(10000); // Starting capital $10k
  const [totalProfit, setTotalProfit] = useState(0);
  const [newsItems, setNewsItems] = useState<MarketNews[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const [lastAudit, setLastAudit] = useState<string>("");
  const isExecutingRef = useRef(false);

  // Position Monitor & Auto-Trader
  useEffect(() => {
    if (positions.length === 0 && !isAutoTrading) return;

    const interval = setInterval(() => {
      const currentPrice = prices[selectedSymbol.symbol] ? parseFloat(prices[selectedSymbol.symbol]) : null;
      if (!currentPrice) return;

      setPositions(prev => prev.map(pos => {
        if (pos.status === 'CLOSED') return pos;
        
        // Calculate current PnL
        const pnl = pos.type === 'LONG' 
          ? (currentPrice - pos.entry) * pos.size 
          : (pos.entry - currentPrice) * pos.size;
        const pnlPercent = (pnl / (pos.entry * pos.size)) * 100;

        // Check Exit Conditions
        let status = pos.status;
        let result = pos.result;
        let exitPrice = pos.exitPrice;
        let closeTime = pos.closeTime;

        if (pos.type === 'LONG') {
          if (currentPrice >= pos.tp) {
            status = 'CLOSED'; result = 'TP'; exitPrice = pos.tp; closeTime = Date.now();
          } else if (currentPrice <= pos.sl) {
            status = 'CLOSED'; result = 'SL'; exitPrice = pos.sl; closeTime = Date.now();
          }
        } else {
          if (currentPrice <= pos.tp) {
            status = 'CLOSED'; result = 'TP'; exitPrice = pos.tp; closeTime = Date.now();
          } else if (currentPrice >= pos.sl) {
            status = 'CLOSED'; result = 'SL'; exitPrice = pos.sl; closeTime = Date.now();
          }
        }

        if (status === 'CLOSED' && pos.status === 'OPEN') {
          setAccountBalance(prev => prev + pnl);
          setTotalProfit(prev => prev + pnl);
        }

        return { ...pos, pnl, pnlPercent, status, result, exitPrice, closeTime };
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [prices, selectedSymbol, isAutoTrading]);

  // Auto-Executor
  useEffect(() => {
    if (!isAutoTrading || signals.length === 0) return;

    const hasOpen = positions.some(p => p.symbol === selectedSymbol.symbol && p.status === 'OPEN');
    if (hasOpen) return;

    const latestSignal = signals[0];
    
    // Only process signals fresher than 5 minutes
    if (Date.now() - latestSignal.timestamp > 300000) return;

    const runExecution = async () => {
      if (isExecutingRef.current) return;
      isExecutingRef.current = true;
      
      setLastAudit("AI Auditor: Reviewing setup conviction...");
      try {
        const audit = await evaluateTrade(latestSignal, sentiment, calendar);
        
        if (audit.decision === 'EXECUTE') {
          setLastAudit(`AI Approved: ${audit.reason}`);
          const newPos: Position = {
            id: `pos-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            symbol: selectedSymbol.symbol,
            type: latestSignal.type === 'BULLISH_BIAS' ? 'LONG' : 'SHORT',
            entry: latestSignal.entry,
            sl: latestSignal.sl,
            tp: latestSignal.tp,
            size: selectedSymbol.symbol === 'XAUUSD' ? 0.1 : 0.005,
            status: 'OPEN',
            pnl: 0,
            pnlPercent: 0,
            openTime: Date.now()
          };
          setPositions(prev => [newPos, ...prev]);
        } else {
          setLastAudit(`AI Rejected: ${audit.reason}`);
        }
      } finally {
        isExecutingRef.current = false;
      }
    };

    runExecution();
  }, [signals, isAutoTrading, selectedSymbol, sentiment, calendar]);

  const fetchAIInsights = async () => {
    setIsRefreshingSentiment(true);
    try {
      // Fetch news, sentiment and calendar in parallel
      const [sentData, calData, marketNews] = await Promise.all([
        analyzeSocialSentiment(selectedSymbol.label).catch(e => {
          console.error("Caught sentiment error:", e);
          return { bullish: 50, bearish: 50, neutral: 0, summary: "Service temporarily unavailable", isMock: true };
        }),
        fetchUSEconomicCalendar().catch(e => {
          console.error("Caught calendar error:", e);
          return [];
        }),
        fetchMarketNews(selectedSymbol.symbol).catch(e => {
          console.error("Caught news error:", e);
          return [];
        })
      ]);

      setSentiment(sentData);
      setCalendar(calData);
      setNewsItems(marketNews);
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

  useEffect(() => {
    const runStrategy = async () => {
      // Use current price to anchor calculation if fetch fails
      const currentPriceVal = prices[selectedSymbol.symbol] ? parseFloat(prices[selectedSymbol.symbol]) : undefined;
      const candles = await fetchCandles(selectedSymbol.symbol, '5m', 100, currentPriceVal);
      
      if (candles.length > 0) {
        // Macro Levels
        const levels = calculateLiquidityLevels(candles);
        setLiquidity(levels);

        // FVGs
        let detectedFvgs = detectFVGs(candles);
        const latestCandle = candles[candles.length - 1];
        detectedFvgs = updateInverseFVGs(detectedFvgs, latestCandle);
        setFvgs(detectedFvgs);

        // Order Blocks
        const detectedObs = detectOrderBlocks(candles, 10);
        setObs(detectedObs);

        // Bias Strategy Signals
        const activeSignals = detectSignals(candles, levels, detectedFvgs, detectedObs);
        setSignals(activeSignals);
      }
    };

    runStrategy();
    const interval = setInterval(runStrategy, 30000); // Update every 30s
    return () => clearInterval(interval);
  }, [selectedSymbol, prices]);

  // Fetch real-time XAU and BTC from Global Spot/Exchanges (via local proxy)
  useEffect(() => {
    const fetchFreshPrices = async () => {
      try {
        // Fetch Gold
        const goldP = fetch('/api/gold-price').then(r => r.json()).catch(() => null);
        // Fetch BTC from Gemini
        const btcP = fetch('/api/btc-price').then(r => r.json()).catch(() => null);

        const [goldData, btcData] = await Promise.all([goldP, btcP]);

        setPrices(prev => {
          const newPrices = { ...prev };
          
          // FOR GOLD: Prioritize our OANDA-aligned API over Tether Gold (Bitfinex)
          if (goldData && goldData[0] && goldData[0].price) {
            newPrices['XAUUSD'] = goldData[0].price;
          }

          // FOR BTC: Update baseline price from poll
          if (btcData && btcData.price) {
            newPrices['BTCUSDT'] = btcData.price;
          }

          return newPrices;
        });
      } catch (err) {
        console.error("Initial price fetch failed:", err);
      }
    };

    fetchFreshPrices();
    const interval = setInterval(fetchFreshPrices, 3000); // Accelerated fallback to 3s
    return () => clearInterval(interval);
  }, []);

  // Main Data Pipeline
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connect = () => {
      setIsConnected(false);
      
      if (dataProvider === 'binance') {
        const streams = SYMBOLS_CONFIG.filter(s => s.symbol !== 'XAUUSD').map(s => `${s.symbol.toLowerCase()}@ticker`).join('/');
        const url = `wss://stream.binance.com:9443/ws/${streams}`;
        ws = new WebSocket(url);
        
        ws.onopen = () => {
          setIsConnected(true);
          console.log('Connected to Binance Real-time Ticker');
        };
        
        ws.onmessage = (event) => {
          const payload = JSON.parse(event.data);
          // Combined streams wrap the data in a "data" property
          const data = payload.data || payload;
          
          // Binance ticker format: s is symbol, c is close price
          if (data.s && data.c) {
            setPrices(prev => ({
              ...prev,
              [data.s]: data.c
            }));
          }
        };
      } else {
        // Coinbase implementation
        const url = `wss://ws-feed.exchange.coinbase.com`;
        ws = new WebSocket(url);

        const cbProducts = SYMBOLS_CONFIG
          .filter(s => s.symbol !== 'XAUUSD')
          .map(s => s.symbol.replace('USDT', '-USD'));

        ws.onopen = () => {
          console.log('Connected to Coinbase WebSocket');
          setIsConnected(true);
          ws?.send(JSON.stringify({
            type: "subscribe",
            product_ids: cbProducts,
            channels: ["ticker"]
          }));
        };

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.type === 'ticker' && data.price) {
            const originalSymbol = SYMBOLS_CONFIG.find(s => s.symbol.replace('USDT', '-USD') === data.product_id)?.symbol;
            if (originalSymbol) {
              setPrices(prev => ({
                ...prev,
                [originalSymbol]: data.price
              }));
            }
          }
        };
      }

      ws.onclose = () => {
        setIsConnected(false);
        console.log(`${dataProvider} WebSocket closed, reconnecting in 5s...`);
        reconnectTimeout = setTimeout(connect, 5000); // Reconnect
      };

      wsRef.current = ws;
    };
    
    connect();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [dataProvider]);

  return (
    <div className="flex flex-col h-screen overflow-hidden font-sans bg-slate-950">
      {!isChartMaximized && (
        <div className="sticky top-0 z-[100] flex flex-col bg-slate-950 shadow-2xl">
          <Header selectedSymbol={selectedSymbol} setSelectedSymbol={setSelectedSymbol} />
          <div className="hidden md:block">
            <ScannerBar 
              status={isConnected ? "WebSocket Active" : "Connecting..."} 
              provider={dataProvider}
              onProviderChange={setDataProvider}
            />
          </div>
        </div>
      )}
           <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        <div className={`flex flex-col md:flex-row flex-1 h-full overflow-hidden ${isChartMaximized ? 'fixed inset-0 z-[100]' : ''}`}>
          {!isChartMaximized && (
            <div className={`w-full md:w-60 md:shrink-0 flex flex-col md:overflow-auto border-b md:border-b-0 md:border-r border-brand-border h-auto md:h-full animate-in slide-in-from-left duration-300 ${mobileTab === 'markets' ? 'flex' : 'hidden md:flex'}`}>
              <SidebarLeft 
                prices={prices} 
                sentiment={sentiment} 
                onRefreshSentiment={fetchAIInsights}
                isRefreshing={isRefreshingSentiment}
                onSelectSymbol={(s) => {
                   setSelectedSymbol(s);
                   if (window.innerWidth < 768) setMobileTab('chart');
                }}
                selectedSymbol={selectedSymbol}
              />
            </div>
          )}
          <div className={`flex-1 relative shrink-0 h-full bg-slate-950 ${mobileTab === 'chart' || isChartMaximized ? 'flex' : 'hidden md:flex'}`}>
            <MainChart 
              prices={prices} 
              symbol={selectedSymbol.symbol} 
              dataProvider={dataProvider}
              isMaximized={isChartMaximized}
              onToggleMaximize={() => setIsChartMaximized(!isChartMaximized)}
            />
          </div>
          {!isChartMaximized && (
            <div className={`w-full md:w-60 md:shrink-0 flex flex-col md:overflow-auto border-t md:border-t-0 md:border-l border-brand-border pb-10 md:pb-0 animate-in slide-in-from-right duration-300 ${mobileTab === 'intel' ? 'flex' : 'hidden md:flex'}`}>
              <SidebarRight 
                calendar={calendar} 
                fvgs={fvgs}
                obs={obs}
                levels={liquidity}
                signals={signals}
                symbol={selectedSymbol.symbol}
                interval="5m"
                isAutoTrading={isAutoTrading}
                setIsAutoTrading={setIsAutoTrading}
                positions={positions}
                lastAudit={lastAudit}
                setPositions={setPositions}
                accountBalance={accountBalance}
                totalProfit={totalProfit}
                news={newsItems}
              />
            </div>
          )}
        </div>
      </main>      {/* Mobile Bottom Navigation */}
      {!isChartMaximized && (
        <div className="md:hidden h-14 bg-slate-950 border-t border-brand-border flex items-center justify-around px-2 z-50 shrink-0">
          <button 
            onClick={() => setMobileTab('markets')}
            className={`flex flex-col items-center gap-1 transition-colors flex-1 ${mobileTab === 'markets' ? 'text-brand-green' : 'text-slate-500'}`}
          >
            <BarChart2 className="w-5 h-5" />
            <span className="text-[9px] font-black uppercase tracking-widest">Markets</span>
          </button>
          <button 
            onClick={() => setMobileTab('chart')}
            className={`flex flex-col items-center gap-1 transition-colors flex-1 ${mobileTab === 'chart' ? 'text-brand-green' : 'text-slate-500'}`}
          >
            <Activity className="w-4 h-4" />
            <div className={`mt-0.5 px-2 py-0.5 rounded-full text-[8px] font-black ${mobileTab === 'chart' ? 'bg-brand-green text-slate-950' : 'bg-slate-800 text-slate-500'}`}>CHART</div>
          </button>
          <button 
            onClick={() => setMobileTab('intel')}
            className={`flex flex-col items-center gap-1 transition-colors flex-1 ${mobileTab === 'intel' ? 'text-brand-green' : 'text-slate-500'}`}
          >
            <Shield className="w-5 h-5" />
            <span className="text-[9px] font-black uppercase tracking-widest">Intel</span>
          </button>
        </div>
      )}

      {/* Hidden Footer on Mobile */}
      {!isChartMaximized && (
        <footer className="hidden md:flex h-6 border-t border-slate-800 items-center justify-between px-3 text-[9px] uppercase tracking-tighter text-slate-500 bg-slate-950 shrink-0">
          <div className="flex space-x-4">
             <span className="flex items-center"><span className="w-1.5 h-1.5 bg-brand-green rounded-full mr-1"></span> Feed Active</span>
             <span>{dataProvider} : ~12ms</span>
          </div>
          <div className="flex space-x-4">
             <span className="flex items-center gap-1"><Settings className="w-2.5 h-2.5" /> Market: Open</span>
             <span className="flex items-center gap-1">v1.4.5</span>
          </div>
        </footer>
      )}
    </div>
  );
}
