import React, { useState, useEffect } from 'react';
import { Zap, Shield, Target, TrendingUp, TrendingDown, Clock, Info, AlertTriangle, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';

interface AVPStrategyViewProps {
  prices: Record<string, string>;
  selectedSymbol: { symbol: string, label: string };
}

export const AVPStrategyView: React.FC<AVPStrategyViewProps> = ({ prices, selectedSymbol }) => {
  const [direction, setDirection] = useState<'long' | 'short'>('long');
  const [atr, setAtr] = useState<number>(0.5);
  const [anchorPrice, setAnchorPrice] = useState<string>('');
  
  const getPrice = (symbol: string) => {
    const val = prices[symbol];
    if (!val) return null;
    const parsed = parseFloat(val);
    return isNaN(parsed) ? null : parsed;
  };

  const currentPrice = getPrice(selectedSymbol.symbol) || 0;

  // Simulate AVP levels relative to current price
  // Usually POC is in the center, VAH above, VAL below
  const poc = direction === 'long' 
    ? (currentPrice * 0.998) // Entry area
    : (currentPrice * 1.002);

  const val = poc * 0.995;
  const vah = poc * 1.005;

  const sl = direction === 'long'
    ? val - (currentPrice * (atr / 100))
    : vah + (currentPrice * (atr / 100));

  const tp1 = direction === 'long' ? vah : val;
  
  const symbolLabel = selectedSymbol.symbol.includes('USDT') 
    ? selectedSymbol.symbol.replace('USDT', '') 
    : selectedSymbol.symbol;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 p-4 md:p-8 no-scrollbar pb-32">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Strategy Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-8 gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-green/20 rounded-xl flex items-center justify-center border border-brand-green/30">
                <Activity className="w-6 h-6 text-brand-green" />
              </div>
              <h1 className="text-2xl md:text-4xl font-black text-white italic tracking-tighter uppercase">Anchored Volume Profile</h1>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Protocol Version 2.4 (AVP-EXT)</span>
              <div className="h-4 w-[1px] bg-slate-800" />
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-brand-green/10 rounded-full border border-brand-green/20">
                <div className="w-1 h-1 rounded-full bg-brand-green animate-pulse" />
                <span className="text-[8px] md:text-[9px] font-black text-brand-green uppercase">Engine Synced</span>
              </div>
            </div>
          </div>

          <div className="flex gap-4 w-full md:w-auto">
            <button 
              onClick={() => setDirection('long')}
              className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                direction === 'long' 
                  ? 'bg-brand-green text-slate-950 shadow-lg shadow-brand-green/20' 
                  : 'bg-slate-900 border border-slate-800 text-slate-500 hover:text-white'
              }`}
            >
              Long Setup
            </button>
            <button 
              onClick={() => setDirection('short')}
              className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                direction === 'short' 
                  ? 'bg-brand-red text-white shadow-lg shadow-brand-red/20 border-brand-red/50' 
                  : 'bg-slate-900 border border-slate-800 text-slate-500 hover:text-white'
              }`}
            >
              Short Setup
            </button>
          </div>
        </div>

        {/* Setup Parameters */}
        <div className="grid lg:grid-cols-3 gap-6">
          
          <div className="lg:col-span-1 space-y-6">
             <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6">
               <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                 <Zap className="w-3 h-3 text-brand-green" /> Setup Parameters
               </h2>
               
               <div className="space-y-4">
                 <div>
                   <label className="text-[9px] font-black text-slate-600 uppercase mb-2 block">Anchor Point (Awal Gerakan)</label>
                   <input 
                     type="text" 
                     value={anchorPrice} 
                     onChange={(e) => setAnchorPrice(e.target.value)}
                     placeholder="e.g. 2650.45"
                     className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white placeholder:text-slate-800 focus:ring-1 focus:ring-brand-green outline-none font-mono"
                   />
                 </div>
                 
                 <div>
                   <label className="text-[9px] font-black text-slate-600 uppercase mb-2 block">ATR Multiplier (Stop Loss Buffer)</label>
                   <div className="flex items-center gap-4">
                     <input 
                       type="range" 
                       min="0.1" 
                       max="2.0" 
                       step="0.1" 
                       value={atr}
                       onChange={(e) => setAtr(parseFloat(e.target.value))}
                       className="flex-1 accent-brand-green"
                     />
                     <span className="text-xs font-black text-white font-mono w-10 text-right">{atr}x</span>
                   </div>
                 </div>

                 <div className="pt-4 border-t border-slate-800 space-y-3">
                    <div className="flex justify-between items-center text-[10px] font-bold uppercase">
                      <span className="text-slate-500">Market Status</span>
                      <span className={direction === 'long' ? 'text-brand-green' : 'text-brand-red'}>
                        {direction === 'long' ? 'Buy Side Liquidity Seek' : 'Sell Side Liquidity Seek'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-bold uppercase">
                      <span className="text-slate-500">Volatility Scan</span>
                      <span className="text-slate-300">Med-High (ATR Aligned)</span>
                    </div>
                 </div>
               </div>
             </div>

             <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                 <Shield className="w-24 h-24 text-brand-green" />
               </div>
               <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">Execution Check</h2>
               <div className="space-y-4">
                  <StepCheck active={true} text="Awal pergerakan ditandai (Anchored)" />
                  <StepCheck 
                    active={direction === 'long' ? currentPrice > poc : currentPrice < poc} 
                    text={`Tunggu POC muncul di ${direction === 'long' ? 'bawah' : 'atas'}`} 
                  />
                  <StepCheck active={false} text="Entry di area POC (Price Mitigation)" />
                  <StepCheck active={false} text={`Target 1: VaH ${direction === 'long' ? 'Breakout' : 'Breakdown'}`} />
               </div>
             </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            
            {/* Visual Level Map */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
               <div className="absolute inset-0 bg-gradient-to-br from-brand-green/5 via-transparent to-brand-red/5" />
               <div className="relative z-10">
                 <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-8 text-center italic">Institutional Volume Liquidity Map (M15 / H1)</div>
                 
                 <div className="space-y-12 py-8 relative">
                    {/* Vertical Line Connecting Levels */}
                    <div className="absolute left-[23px] top-4 bottom-4 w-[1px] bg-slate-800" />
                    
                    <LevelRow 
                      label={direction === 'long' ? "Value Area High (VAH)" : "Value Area Low (VAL)"}
                      value={direction === 'long' ? vah : val}
                      symbol={symbolLabel}
                      type="target"
                      desc={direction === 'long' ? "Resistance / Target 1" : "Support / Target 1"}
                    />

                    <LevelRow 
                      label="Point of Control (POC)"
                      value={poc}
                      symbol={symbolLabel}
                      type="entry"
                      desc="Area of High Liquidity / Primary Entry"
                    />

                    <LevelRow 
                      label={direction === 'long' ? "Value Area Low (VAL)" : "Value Area High (VAH)"}
                      value={direction === 'long' ? val : vah}
                      symbol={symbolLabel}
                      type="support"
                      desc={direction === 'long' ? "Secondary Support / SL Context" : "Secondary Resistance / SL Context"}
                    />

                    <LevelRow 
                      label="Invalidation Point (SL)"
                      value={sl}
                      symbol={symbolLabel}
                      type="sl"
                      desc={`VAL ${direction === 'long' ? '-' : '+'} ATR Buffer Applied`}
                    />
                 </div>
               </div>
            </div>

            {/* Strategy Logic Guide */}
            <div className="grid sm:grid-cols-2 gap-6">
               <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6">
                 <div className="text-[10px] font-black text-brand-green uppercase tracking-widest mb-4">Phase: TP-1 Protocol</div>
                 <p className="text-[11px] text-slate-400 font-mono leading-relaxed">
                   Jadikan {direction === 'long' ? 'VAH' : 'VAL'} sebagai target awal. Jika terjadi {direction === 'long' ? 'breakout' : 'breakdown'} structural, tahan posisi untuk target institusional berikutnya.
                 </p>
               </div>
               <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6">
                 <div className="text-[10px] font-black text-yellow-500 uppercase tracking-widest mb-4">Phase: Trailing Protocol</div>
                 <p className="text-[11px] text-slate-400 font-mono leading-relaxed">
                   Hold hingga: kembali ke awal gerakan, muncul POC baru {direction === 'long' ? 'di atas' : 'di bawah'}, atau harga masuk kembali ke dalam Value Area.
                 </p>
               </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};

const StepCheck = ({ active, text }: { active: boolean, text: string }) => (
  <div className="flex items-center gap-3">
    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${active ? 'bg-brand-green/20 border-brand-green text-brand-green' : 'bg-slate-950 border-slate-800'}`}>
      {active && <Zap className="w-2.5 h-2.5 fill-brand-green" />}
    </div>
    <span className={`text-[10px] font-black uppercase tracking-tight ${active ? 'text-slate-200' : 'text-slate-600'}`}>{text}</span>
  </div>
);

const LevelRow = ({ label, value, symbol, type, desc }: { label: string, value: number, symbol: string, type: 'entry' | 'target' | 'sl' | 'support', desc: string }) => {
  const getColors = () => {
    switch (type) {
      case 'target': return 'bg-brand-green border-brand-green text-slate-950';
      case 'entry': return 'bg-slate-900 border-yellow-500 text-yellow-500';
      case 'sl': return 'bg-brand-red border-brand-red text-white';
      default: return 'bg-slate-950 border-slate-800 text-slate-400';
    }
  };

  return (
    <div className="flex items-center gap-6 group">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center border-2 shrink-0 transition-all group-hover:scale-110 ${getColors()}`}>
        {type === 'target' && <ArrowUpRight className="w-6 h-6" />}
        {type === 'entry' && <Target className="w-6 h-6" />}
        {type === 'sl' && <Shield className="w-6 h-6" />}
        {type === 'support' && <ArrowDownRight className="w-6 h-6" />}
      </div>
      <div className="flex-1 flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-white/5 pb-2">
         <div>
            <div className={`text-[10px] font-black uppercase tracking-widest ${type === 'entry' ? 'text-yellow-500' : type === 'target' ? 'text-brand-green' : type === 'sl' ? 'text-brand-red' : 'text-slate-500'}`}>
              {label}
            </div>
            <div className="text-[9px] font-mono text-slate-600 uppercase tracking-tighter">{desc}</div>
         </div>
         <div className="text-right">
            <div className="text-xl font-black text-white font-mono tracking-tighter tabular-nums">
              ${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] font-mono text-slate-600">{symbol} EX-FLOW</div>
         </div>
      </div>
    </div>
  );
};
