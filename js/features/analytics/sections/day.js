/**
 * 曜日別統計セクション
 */
export async function initDayStats(trades) {
  const container = document.querySelector('#day-stats .accordion__body');
  if (!container) return;
  
  try {
    const dayStats = calculateDayStats(trades);
    
    if (dayStats.length === 0) {
      container.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--color-text-secondary);">データがありません</p>';
      return;
    }
    
    container.innerHTML = `
      <div class="day-stats-list">
        ${dayStats.map(stat => `
          <div class="day-stat-item">
            <div class="day-stat-label">${stat.dayName}</div>
            <div class="day-stat-details">
              <span class="day-stat-count">${stat.tradeCount}件</span>
              <span class="day-stat-pnl ${stat.totalPnl >= 0 ? 'positive' : 'negative'}">
                ${stat.totalPnl >= 0 ? '+' : ''}${Math.round(stat.totalPnl).toLocaleString()}円
              </span>
              <span class="day-stat-winrate">勝率: ${stat.winRate.toFixed(1)}%</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (error) {
    console.error('曜日別統計の初期化エラー:', error);
    container.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--color-error);">エラーが発生しました</p>';
  }
}

function calculateDayStats(trades) {
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  const dayStats = {};
  
  dayNames.forEach(day => {
    dayStats[day] = { trades: [], totalPnl: 0, wins: 0 };
  });
  
  trades.forEach(trade => {
    const date = new Date(trade.created_at);
    const dayIndex = date.getDay();
    const dayName = dayNames[dayIndex];
    
    dayStats[dayName].trades.push(trade);
    dayStats[dayName].totalPnl += trade.pnl;
    if (trade.pnl > 0) {
      dayStats[dayName].wins++;
    }
  });
  
  return dayNames
    .map(day => ({
      dayName: day,
      tradeCount: dayStats[day].trades.length,
      totalPnl: dayStats[day].totalPnl,
      winRate: dayStats[day].trades.length > 0 
        ? (dayStats[day].wins / dayStats[day].trades.length) * 100 
        : 0
    }))
    .filter(stat => stat.tradeCount > 0)
    .sort((a, b) => b.totalPnl - a.totalPnl);
}

