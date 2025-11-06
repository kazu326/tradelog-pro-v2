/**
 * 連勝・連敗統計セクション
 */
export async function initStreakStats(trades) {
  const container = document.querySelector('#streak-stats .accordion__body');
  if (!container) return;
  
  try {
    const streaks = calculateStreaks(trades);
    
    container.innerHTML = `
      <div class="streak-stats">
        <div class="streak-card">
          <div class="streak-label">最大連勝</div>
          <div class="streak-value positive">${streaks.maxWinStreak}回</div>
        </div>
        <div class="streak-card">
          <div class="streak-label">最大連敗</div>
          <div class="streak-value negative">${streaks.maxLossStreak}回</div>
        </div>
        <div class="streak-card">
          <div class="streak-label">現在の連勝</div>
          <div class="streak-value ${streaks.currentStreak >= 0 ? 'positive' : 'negative'}">
            ${streaks.currentStreak >= 0 ? '+' : ''}${Math.abs(streaks.currentStreak)}回
          </div>
        </div>
      </div>
    `;
  } catch (error) {
    console.error('連勝・連敗統計の初期化エラー:', error);
    container.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--color-error);">エラーが発生しました</p>';
  }
}

function calculateStreaks(trades) {
  if (trades.length === 0) {
    return { maxWinStreak: 0, maxLossStreak: 0, currentStreak: 0 };
  }
  
  // 日付順にソート
  const sortedTrades = [...trades].sort((a, b) => 
    new Date(a.created_at) - new Date(b.created_at)
  );
  
  let maxWinStreak = 0;
  let maxLossStreak = 0;
  let currentWinStreak = 0;
  let currentLossStreak = 0;
  let currentStreak = 0;
  let isWinning = null;
  
  sortedTrades.forEach(trade => {
    const isWin = trade.pnl > 0;
    
    if (isWin) {
      currentWinStreak++;
      currentLossStreak = 0;
      maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
      
      if (isWinning === true || isWinning === null) {
        currentStreak++;
      } else {
        currentStreak = 1;
      }
      isWinning = true;
    } else if (trade.pnl < 0) {
      currentLossStreak++;
      currentWinStreak = 0;
      maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
      
      if (isWinning === false || isWinning === null) {
        currentStreak--;
      } else {
        currentStreak = -1;
      }
      isWinning = false;
    }
  });
  
  return {
    maxWinStreak,
    maxLossStreak,
    currentStreak
  };
}

