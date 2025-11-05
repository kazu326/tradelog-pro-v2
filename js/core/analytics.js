/**
 * 統計計算
 */

/**
 * トレード統計を計算
 */
export function calculateStats(trades) {
  if (!trades || trades.length === 0) {
    return {
      totalTrades: 0,
      winRate: 0,
      totalPnl: 0,
      wins: 0,
      losses: 0,
      profitFactor: 0,
      averageWin: 0,
      averageLoss: 0,
      largestWin: 0,
      largestLoss: 0
    };
  }

  const wins = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl < 0);
  
  const totalWins = wins.reduce((sum, t) => sum + t.pnl, 0);
  const totalLosses = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));
  
  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : 0;
  
  return {
    totalTrades: trades.length,
    winRate: trades.length > 0 ? (wins.length / trades.length) * 100 : 0,
    totalPnl: trades.reduce((sum, t) => sum + t.pnl, 0),
    wins: wins.length,
    losses: losses.length,
    profitFactor: profitFactor,
    averageWin: wins.length > 0 ? totalWins / wins.length : 0,
    averageLoss: losses.length > 0 ? totalLosses / losses.length : 0,
    largestWin: wins.length > 0 ? Math.max(...wins.map(t => t.pnl)) : 0,
    largestLoss: losses.length > 0 ? Math.min(...losses.map(t => t.pnl)) : 0
  };
}

/**
 * ドローダウン計算
 */
export function calculateDrawdown(trades) {
  if (!trades || trades.length === 0) return { current: 0, max: 0, peak: 0 };

  // 日付順にソート
  const sortedTrades = [...trades].sort((a, b) => 
    new Date(a.created_at) - new Date(b.created_at)
  );

  let peak = 0;
  let maxDD = 0;
  let runningPnl = 0;

  sortedTrades.forEach(trade => {
    runningPnl += trade.pnl;
    
    if (runningPnl > peak) {
      peak = runningPnl;
    }
    
    const dd = peak > 0 ? ((peak - runningPnl) / peak) * 100 : 0;
    
    if (dd > maxDD) {
      maxDD = dd;
    }
  });

  const currentDD = peak > 0 ? ((peak - runningPnl) / peak) * 100 : 0;

  return {
    current: currentDD,
    max: maxDD,
    peak: peak
  };
}

/**
 * 通貨ペア別統計
 */
export function getStatsByPair(trades) {
  const pairStats = {};

  trades.forEach(trade => {
    if (!pairStats[trade.pair]) {
      pairStats[trade.pair] = {
        trades: [],
        totalPnl: 0,
        wins: 0,
        losses: 0
      };
    }

    pairStats[trade.pair].trades.push(trade);
    pairStats[trade.pair].totalPnl += trade.pnl;
    
    if (trade.pnl > 0) {
      pairStats[trade.pair].wins++;
    } else if (trade.pnl < 0) {
      pairStats[trade.pair].losses++;
    }
  });

  // 配列に変換してソート
  return Object.entries(pairStats)
    .map(([pair, stats]) => ({
      pair,
      totalPnl: stats.totalPnl,
      winRate: stats.trades.length > 0 
        ? (stats.wins / stats.trades.length) * 100 
        : 0,
      tradeCount: stats.trades.length
    }))
    .sort((a, b) => b.totalPnl - a.totalPnl);
}
