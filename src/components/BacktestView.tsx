import React, { useState } from 'react';
import { 
  BarChart, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area 
} from 'recharts';
import { 
  Play, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  Calendar, 
  DollarSign, 
  PieChart as PieIcon,
  ChevronRight,
  ArrowRight
} from 'lucide-react';
import { runBacktest, BacktestResult } from '../services/backtestService';

export const BacktestView = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<BacktestResult | null>(null);
  const [params, setParams] = useState({
    symbol: 'XAUUSD',
    initialBalance: 10000,
    days: 30,
    strategy: 'ICT_SILVER_BULLET'
  });

  const handleRun = async () => {
    setIsRunning(true);
    // Add small delay to simulate processing
    await new Promise(r => setTimeout(r, 1500));
    const result = await runBacktest(params.symbol, params.initialBalance, params.days);
    setResults(result);
    setIsRunning(false);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tighter">STRATEGY BACKTESTER</h1>
            <p className="text-slate-500 font-mono text-[10px] uppercase tracking-widest mt-1">Simulate historical performance with institutional variables</p>
          </div>
          <button 
            onClick={handleRun}
            disabled={isRunning}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-black text-xs uppercase tracking-widest transition-all ${
              isRunning ? 'bg-slate-800 text-slate-500' : 'bg-brand-green text-slate-950 hover:shadow-lg hover:shadow-brand-green/20'
            }`}
          >
            {isRunning ? (
              <div className="w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
            ) : <Play className="w-4 h-4 fill-current" />}
            {isRunning ? 'Simulating...' : 'Run Backtest'}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Params */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 space-y-4">
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Configuration</div>
              
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-600 uppercase">Asset Pair</label>
                <select 
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-green"
                  value={params.symbol}
                  onChange={e => setParams({...params, symbol: e.target.value})}
                >
                  <option value="XAUUSD">XAU / USD</option>
                  <option value="BTCUSDT">BTC / USDT</option>
                  <option value="ETHUSDT">ETH / USDT</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-600 uppercase">Initial Capital</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 text-xs">$</span>
                  <input 
                    type="number"
                    className="w-full bg-slate-950 border border-slate-800 rounded pl-7 pr-3 py-2 text-xs text-white focus:outline-none focus:border-brand-green"
                    value={params.initialBalance}
                    onChange={e => setParams({...params, initialBalance: parseInt(e.target.value)})}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-600 uppercase">Time Horizon (Days)</label>
                <input 
                  type="range" min="7" max="180" step="7"
                  className="w-full accent-brand-green"
                  value={params.days}
                  onChange={e => setParams({...params, days: parseInt(e.target.value)})}
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-500">
                  <span>7d</span>
                  <span>{params.days}d</span>
                  <span>180d</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-600 uppercase">Select Strategy</label>
                <div className="space-y-2">
                  {['ICT_SILVER_BULLET', 'EMA_CROSSOVER', 'FIB_RETRACEMENT'].map(s => (
                    <button 
                      key={s}
                      onClick={() => setParams({...params, strategy: s})}
                      className={`w-full text-left px-3 py-2 rounded text-[10px] font-bold transition-all ${
                        params.strategy === s ? 'bg-brand-green/20 text-brand-green border border-brand-green/30' : 'bg-slate-950 text-slate-500 border border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {s.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-slate-900/40 border border-brand-red/10 p-4 rounded-xl">
               <div className="flex items-center gap-2 text-brand-red text-[10px] font-black uppercase tracking-widest mb-2">
                 <AlertCircle className="w-3 h-3" /> Risk Warning
               </div>
               <p className="text-[10px] text-slate-500 leading-relaxed font-mono">
                 Past performance does not guarantee future results. Backtesting uses simulated variables and may not account for real-world slippage or spreads.
               </p>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3 space-y-6">
            {!results && !isRunning && (
              <div className="h-[500px] border-2 border-dashed border-slate-900 rounded-2xl flex flex-col items-center justify-center text-center p-8">
                <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mb-4">
                  <Play className="w-6 h-6 text-slate-700" />
                </div>
                <h3 className="text-white font-bold mb-2">Ready to Simulate</h3>
                <p className="text-slate-500 text-xs max-w-xs">Configure your strategy parameters on the left and run the backtest to see performance analytics.</p>
              </div>
            )}

            {isRunning && (
               <div className="h-[500px] bg-slate-900/20 border border-slate-800 rounded-2xl flex flex-col items-center justify-center">
                  <div className="w-64 h-1 bg-slate-800 rounded-full overflow-hidden mb-4">
                    <div className="h-full bg-brand-green animate-[progress_1.5s_ease-in-out_infinite]" style={{ width: '40%' }} />
                  </div>
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest animate-pulse">Processing Historical Blocks...</div>
               </div>
            )}

            {results && !isRunning && (
              <>
                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <MetricCard label="Net Profit" value={`$${results.stats.netProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} color="text-brand-green" icon={<TrendingUp className="w-3 h-3" />} />
                  <MetricCard label="Win Rate" value={`${results.stats.winRate.toFixed(1)}%`} color="text-white" icon={<PieIcon className="w-3 h-3" />} />
                  <MetricCard label="Profit Factor" value={results.stats.profitFactor.toFixed(2)} color="text-yellow-500" icon={<TrendingUp className="w-3 h-3" />} />
                  <MetricCard label="Max Drawdown" value={`${results.stats.maxDrawdown.toFixed(1)}%`} color="text-brand-red" icon={<TrendingDown className="w-3 h-3" />} />
                </div>

                {/* Equity Curve Chart */}
                <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-8">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Equity Growth Curve</div>
                    <div className="flex items-center gap-4 text-[10px] font-mono">
                       <span className="text-slate-600">Start: <span className="text-white">${results.stats.initialBalance.toLocaleString()}</span></span>
                       <span className="text-slate-600">Final: <span className="text-white">${results.stats.finalBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></span>
                    </div>
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={results.equityCurve}>
                        <defs>
                          <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="100%">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis 
                          dataKey="date" 
                          stroke="#475569" 
                          fontSize={9} 
                          tickLine={false} 
                          axisLine={false}
                          tickFormatter={(val) => val.split('-').slice(1).join('/')}
                        />
                        <YAxis 
                          stroke="#475569" 
                          fontSize={9} 
                          tickLine={false} 
                          axisLine={false}
                          domain={['auto', 'auto']}
                          tickFormatter={(val) => `$${val/1000}k`}
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '10px' }}
                          itemStyle={{ color: '#10b981' }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="balance" 
                          stroke="#10b981" 
                          strokeWidth={2}
                          fillOpacity={1} 
                          fill="url(#colorBalance)" 
                          animationDuration={1500}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Trade History */}
                <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trade Journal ({results.trades.length} Executions)</div>
                    <button className="text-[9px] font-black text-brand-green uppercase tracking-widest hover:underline">Export CSV</button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="text-[9px] font-black text-slate-500 uppercase tracking-tighter bg-slate-900/60">
                          <th className="px-6 py-3">ID</th>
                          <th className="px-6 py-3">Type</th>
                          <th className="px-6 py-3">Entry</th>
                          <th className="px-6 py-3">Exit</th>
                          <th className="px-6 py-3">Net Profit</th>
                          <th className="px-6 py-3">Result</th>
                        </tr>
                      </thead>
                      <tbody className="text-[10px] font-mono divide-y divide-slate-800/50">
                        {results.trades.map((trade) => (
                          <tr key={trade.id} className="hover:bg-slate-800/20 transition-colors">
                            <td className="px-6 py-3 text-slate-600">#{trade.id}</td>
                            <td className="px-6 py-3">
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-black ${trade.type === 'LONG' ? 'bg-brand-green/10 text-brand-green' : 'bg-brand-red/10 text-brand-red'}`}>
                                {trade.type}
                              </span>
                            </td>
                            <td className="px-6 py-3 text-slate-300">${trade.entryPrice.toFixed(2)}</td>
                            <td className="px-6 py-3 text-slate-300">${trade.exitPrice.toFixed(2)}</td>
                            <td className={`px-6 py-3 font-bold ${trade.pnl >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>
                              {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </td>
                            <td className="px-6 py-3">
                               <div className={`flex items-center gap-1 ${trade.pnl >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>
                                 {trade.pnl >= 0 ? <TrendingUp className="w-2 h-2" /> : <TrendingDown className="w-2 h-2" />}
                                 {trade.pnlPercent.toFixed(2)}%
                               </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const MetricCard = ({ label, value, color, icon }: { label: string, value: string, color: string, icon: React.ReactNode }) => (
  <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-xl">
    <div className="flex items-center gap-2 text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">
      {icon}
      {label}
    </div>
    <div className={`text-xl font-black ${color}`}>{value}</div>
  </div>
);
