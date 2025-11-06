/**
 * ロット別統計セクション
 */
export async function initLotStats(trades) {
  const container = document.querySelector('#lot-stats .accordion__body');
  if (!container) return;
  
  try {
    const lotStats = calculateLotStats(trades);
    
    if (lotStats.length === 0) {
      container.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--color-text-secondary);">データがありません</p>';
      return;
    }
    
    container.innerHTML = `
      <div class="lot-stats-list">
        ${lotStats.map(stat => `
          <div class="lot-stat-item">
            <div class="lot-stat-label">${stat.lotRange}</div>
            <div class="lot-stat-details">
              <span class="lot-stat-count">${stat.tradeCount}件</span>
              <span class="lot-stat-pnl ${stat.totalPnl >= 0 ? 'positive' : 'negative'}">
                ${stat.totalPnl >= 0 ? '+' : ''}${Math.round(stat.totalPnl).toLocaleString()}円
              </span>
              <span class="lot-stat-winrate">勝率: ${stat.winRate.toFixed(1)}%</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (error) {
    console.error('ロット別統計の初期化エラー:', error);
    container.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--color-error);">エラーが発生しました</p>';
  }
}

function calculateLotStats(trades) {
  const lotRanges = [
    { label: '0.01-0.1', min: 0.01, max: 0.1 },
    { label: '0.1-0.5', min: 0.1, max: 0.5 },
    { label: '0.5-1.0', min: 0.5, max: 1.0 },
    { label: '1.0-2.0', min: 1.0, max: 2.0 },
    { label: '2.0以上', min: 2.0, max: Infinity }
  ];
  
  const stats = {};
  lotRanges.forEach(range => {
    stats[range.label] = { trades: [], totalPnl: 0, wins: 0 };
  });
  
  trades.forEach(trade => {
    const lot = trade.lot_size || 0;
    const range = lotRanges.find(r => lot >= r.min && lot < r.max);
    if (range) {
      stats[range.label].trades.push(trade);
      stats[range.label].totalPnl += trade.pnl;
      if (trade.pnl > 0) {
        stats[range.label].wins++;
      }
    }
  });
  
  return lotRanges
    .map(range => ({
      lotRange: range.label,
      tradeCount: stats[range.label].trades.length,
      totalPnl: stats[range.label].totalPnl,
      winRate: stats[range.label].trades.length > 0 
        ? (stats[range.label].wins / stats[range.label].trades.length) * 100 
        : 0
    }))
    .filter(stat => stat.tradeCount > 0)
    .sort((a, b) => b.totalPnl - a.totalPnl);
}

