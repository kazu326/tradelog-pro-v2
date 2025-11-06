/**
 * 分析ページ機能
 */
import { getTrades } from '../core/storage.js';
import { calculateStats, calculateDrawdown } from '../core/analytics.js';

/**
 * 分析ページを初期化
 */
export async function initAnalytics(container) {
  console.log('📊 分析ページを初期化中...');
  
  // ローディング表示
  container.innerHTML = '<div style="text-align: center; padding: 40px;">読み込み中...</div>';
  
  try {
    // トレードデータ取得
    const trades = await getTrades(1000); // 十分な数を取得
    
    if (!trades || trades.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px;">
          <h2>📊 分析</h2>
          <p>トレードデータがありません</p>
          <p style="color: var(--color-text-secondary); margin-top: 20px;">
            トレードを記録すると、ここに統計情報が表示されます。
          </p>
        </div>
      `;
      return;
    }
    
    // 統計計算
    const stats = calculateStats(trades);
    const drawdown = calculateDrawdown(trades);
    
    // UIを構築
    container.innerHTML = buildAnalyticsUI(stats, drawdown);
    
  } catch (error) {
    console.error('分析ページの初期化エラー:', error);
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--color-error);">
        <h2>エラーが発生しました</h2>
        <p>${error.message || 'データの読み込みに失敗しました'}</p>
      </div>
    `;
  }
}

/**
 * 分析UIを構築
 */
function buildAnalyticsUI(stats, drawdown) {
  return `
    <div class="analytics-page">
      <h2 style="margin-bottom: 24px;">📊 分析</h2>
      
      <!-- 概要カード（4つ横並び） -->
      <div class="summary-cards">
        ${createSummaryCard('総損益', formatCurrency(stats.totalPnl), stats.totalPnl >= 0 ? 'positive' : 'negative')}
        ${createSummaryCard('勝率', `${stats.winRate.toFixed(1)}%`, stats.winRate >= 50 ? 'positive' : 'neutral')}
        ${createSummaryCard('プロフィットファクター', stats.profitFactor.toFixed(2), stats.profitFactor >= 1.5 ? 'positive' : stats.profitFactor >= 1.0 ? 'neutral' : 'negative')}
        ${createSummaryCard('最大DD', `${drawdown.max.toFixed(1)}%`, drawdown.max <= 20 ? 'positive' : drawdown.max <= 50 ? 'neutral' : 'negative')}
      </div>
      
      <!-- 今後追加するセクション -->
      <div style="margin-top: 40px; padding: 20px; background: var(--color-surface); border-radius: 8px; text-align: center; color: var(--color-text-secondary);">
        <p>📈 月間損益グラフ、📊 通貨ペア別分析、📋 詳細統計などは今後実装予定です</p>
      </div>
    </div>
  `;
}

/**
 * 概要カードを作成
 */
function createSummaryCard(title, value, status = 'neutral') {
  const statusClass = `summary-card--${status}`;
  const statusIcon = getStatusIcon(status);
  
  return `
    <div class="summary-card ${statusClass}">
      <div class="summary-card__header">
        <span class="summary-card__title">${title}</span>
        <span class="summary-card__icon">${statusIcon}</span>
      </div>
      <div class="summary-card__value">${value}</div>
    </div>
  `;
}

/**
 * ステータスに応じたアイコンを取得
 */
function getStatusIcon(status) {
  switch (status) {
    case 'positive':
      return '✅';
    case 'negative':
      return '⚠️';
    default:
      return '📊';
  }
}

/**
 * 通貨フォーマット
 */
function formatCurrency(value) {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${Math.round(value).toLocaleString()}円`;
}

