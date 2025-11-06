/**
 * 時間帯別統計セクション
 */
export async function initTimeStats(trades) {
  const container = document.querySelector('#time-stats .accordion__body');
  if (!container) return;
  
  try {
    const timeStats = calculateTimeStats(trades);
    
    if (timeStats.length === 0) {
      container.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--color-text-secondary);">データがありません</p>';
      return;
    }
    
    container.innerHTML = `
      <div class="time-stats-list">
        ${timeStats.map(stat => `
          <div class="time-stat-item">
            <div class="time-stat-label">${stat.timeRange}</div>
            <div class="time-stat-details">
              <span class="time-stat-count">${stat.tradeCount}件</span>
              <span class="time-stat-pnl ${stat.totalPnl >= 0 ? 'positive' : 'negative'}">
                ${stat.totalPnl >= 0 ? '+' : ''}${Math.round(stat.totalPnl).toLocaleString()}円
              </span>
              <span class="time-stat-winrate">勝率: ${stat.winRate.toFixed(1)}%</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (error) {
    console.error('時間帯別統計の初期化エラー:', error);
    container.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--color-error);">エラーが発生しました</p>';
  }
}

function calculateTimeStats(trades) {
  const timeRanges = {
    '朝 (6-12時)': { trades: [], totalPnl: 0, wins: 0 },
    '午後 (12-18時)': { trades: [], totalPnl: 0, wins: 0 },
    '夜 (18-24時)': { trades: [], totalPnl: 0, wins: 0 },
    '深夜 (0-6時)': { trades: [], totalPnl: 0, wins: 0 }
  };
  
  trades.forEach(trade => {
    const date = new Date(trade.created_at);
    const hour = date.getHours();
    
    let timeRange;
    if (hour >= 6 && hour < 12) {
      timeRange = '朝 (6-12時)';
    } else if (hour >= 12 && hour < 18) {
      timeRange = '午後 (12-18時)';
    } else if (hour >= 18 && hour < 24) {
      timeRange = '夜 (18-24時)';
    } else {
      timeRange = '深夜 (0-6時)';
    }
    
    timeRanges[timeRange].trades.push(trade);
    timeRanges[timeRange].totalPnl += trade.pnl;
    if (trade.pnl > 0) {
      timeRanges[timeRange].wins++;
    }
  });
  
  return Object.entries(timeRanges)
    .map(([timeRange, data]) => ({
      timeRange,
      tradeCount: data.trades.length,
      totalPnl: data.totalPnl,
      winRate: data.trades.length > 0 
        ? (data.wins / data.trades.length) * 100 
        : 0
    }))
    .filter(stat => stat.tradeCount > 0)
    .sort((a, b) => b.totalPnl - a.totalPnl);
}

