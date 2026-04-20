import { format, subDays, addDays, isBefore } from 'date-fns';

export interface BacktestResult {
  trades: Trade[];
  stats: BacktestStats;
  equityCurve: EquityPoint[];
}

export interface Trade {
  id: string;
  type: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  entryDate: string;
  exitDate: string;
  pnl: number;
  pnlPercent: number;
}

export interface BacktestStats {
  initialBalance: number;
  finalBalance: number;
  netProfit: number;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  totalTrades: number;
}

export interface EquityPoint {
  date: string;
  balance: number;
}

export async function runBacktest(
  symbol: string,
  initialBalance: number,
  days: number = 30
): Promise<BacktestResult> {
  // Simulate fetching historical OHLCV data
  // In a real app, this would be an API call to Binance /api/v3/klines
  const data = generateMockHistoricalData(days);
  
  const trades: Trade[] = [];
  let balance = initialBalance;
  const equityCurve: EquityPoint[] = [{ date: format(subDays(new Date(), days), 'yyyy-MM-dd'), balance }];
  
  let currentPosition: { type: 'LONG' | 'SHORT'; price: number; date: string } | null = null;
  
  // Simple Strategy Example: SMA Crossover (Simulated here)
  // Let's just create some randomized but somewhat realistic trades for the demo
  for (let i = 1; i < data.length; i++) {
    const point = data[i];
    
    // Simple logic to open/close positions randomly but with a slight bias
    if (!currentPosition && Math.random() > 0.9) {
      currentPosition = {
        type: Math.random() > 0.4 ? 'LONG' : 'SHORT',
        price: point.price,
        date: point.date
      };
    } else if (currentPosition && Math.random() > 0.8) {
      const exitPrice = point.price;
      const priceDiff = currentPosition.type === 'LONG' ? exitPrice - currentPosition.price : currentPosition.price - exitPrice;
      const pnlPercent = (priceDiff / currentPosition.price) * 100;
      const pnl = (balance * (pnlPercent / 100)) * 5; // Simulating 5x leverage
      
      balance += pnl;
      
      trades.push({
        id: Math.random().toString(36).substr(2, 9),
        type: currentPosition.type,
        entryPrice: currentPosition.price,
        exitPrice: exitPrice,
        entryDate: currentPosition.date,
        exitDate: point.date,
        pnl,
        pnlPercent
      });
      
      equityCurve.push({
        date: point.date,
        balance
      });
      
      currentPosition = null;
    }
  }

  // Calculate Stats
  const wins = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl <= 0);
  const winRate = (wins.length / trades.length) * 100;
  
  const grossProfit = wins.reduce((sum, t) => sum + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));
  const profitFactor = grossLoss === 0 ? grossProfit : grossProfit / grossLoss;
  
  // Max Drawdown calculation
  let maxBalance = initialBalance;
  let maxDd = 0;
  equityCurve.forEach(p => {
    if (p.balance > maxBalance) maxBalance = p.balance;
    const dd = ((maxBalance - p.balance) / maxBalance) * 100;
    if (dd > maxDd) maxDd = dd;
  });

  return {
    trades,
    equityCurve,
    stats: {
      initialBalance,
      finalBalance: balance,
      netProfit: balance - initialBalance,
      winRate,
      profitFactor,
      maxDrawdown: maxDd,
      totalTrades: trades.length
    }
  };
}

function generateMockHistoricalData(days: number) {
  const data = [];
  const startPrice = 4800;
  let currentPrice = startPrice;
  const startDate = subDays(new Date(), days);
  
  for (let i = 0; i <= days; i++) {
    const volatility = currentPrice * 0.01;
    currentPrice += (Math.random() - 0.5) * volatility;
    data.push({
      date: format(addDays(startDate, i), 'yyyy-MM-dd'),
      price: currentPrice
    });
  }
  return data;
}
