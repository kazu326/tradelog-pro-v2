/**
 * 通貨ペア別統計セクション
 */
import { getStatsByPair } from '../../../core/analytics.js';

export async function initPairStats(trades) {
  const container = document.querySelector('#pair-stats .accordion__body');
  if (!container) return;
  
  try {
    const pairStats = getStatsByPair(trades);
    
    if (pairStats.length === 0) {
      container.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--color-text-secondary);">データがありません</p>';
      return;
    }
    
    container.innerHTML = `
      <div class="pair-stats-grid">
        ${pairStats.map(stat => `
          <div class="pair-stat-card">
            <div class="pair-stat-header">
              <span class="pair-stat-pair">${stat.pair}</span>
              <span class="pair-stat-count">${stat.tradeCount}件</span>
            </div>
            <div class="pair-stat-value ${stat.totalPnl >= 0 ? 'positive' : 'negative'}">
              ${stat.totalPnl >= 0 ? '+' : ''}${Math.round(stat.totalPnl).toLocaleString()}円
            </div>
            <div class="pair-stat-winrate">勝率: ${stat.winRate.toFixed(1)}%</div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (error) {
    console.error('通貨ペア別統計の初期化エラー:', error);
    container.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--color-error);">エラーが発生しました</p>';
  }
}

