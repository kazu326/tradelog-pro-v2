/**
 * リスク管理スコアセクション
 */
import { calculateStats, calculateDrawdown } from '../../../core/analytics.js';

export async function initRiskScore(trades) {
  const container = document.querySelector('#risk-score .accordion__body');
  if (!container) return;
  
  try {
    const stats = calculateStats(trades);
    const drawdown = calculateDrawdown(trades);
    const riskScore = calculateRiskScore(stats, drawdown);
    
    container.innerHTML = `
      <div class="risk-score-container">
        <div class="risk-score-display">
          <div class="risk-score-value">${riskScore.score}/5</div>
          <div class="risk-score-label">${riskScore.label}</div>
        </div>
        <div class="risk-score-details">
          <div class="risk-item">
            <span class="risk-item-label">ドローダウン管理</span>
            <span class="risk-item-value ${riskScore.details.drawdown >= 3 ? 'good' : riskScore.details.drawdown >= 2 ? 'fair' : 'poor'}">
              ${riskScore.details.drawdown}/5
            </span>
          </div>
          <div class="risk-item">
            <span class="risk-item-label">リスクリワード比</span>
            <span class="risk-item-value ${riskScore.details.rrr >= 3 ? 'good' : riskScore.details.rrr >= 2 ? 'fair' : 'poor'}">
              ${riskScore.details.rrr}/5
            </span>
          </div>
          <div class="risk-item">
            <span class="risk-item-label">勝率</span>
            <span class="risk-item-value ${riskScore.details.winRate >= 3 ? 'good' : riskScore.details.winRate >= 2 ? 'fair' : 'poor'}">
              ${riskScore.details.winRate}/5
            </span>
          </div>
          <div class="risk-item">
            <span class="risk-item-label">プロフィットファクター</span>
            <span class="risk-item-value ${riskScore.details.pf >= 3 ? 'good' : riskScore.details.pf >= 2 ? 'fair' : 'poor'}">
              ${riskScore.details.pf}/5
            </span>
          </div>
        </div>
      </div>
    `;
  } catch (error) {
    console.error('リスク管理スコアの初期化エラー:', error);
    container.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--color-error);">エラーが発生しました</p>';
  }
}

function calculateRiskScore(stats, drawdown) {
  // 各項目を5段階で評価
  const details = {
    drawdown: scoreDrawdown(drawdown.max),
    rrr: scoreRRR(stats),
    winRate: scoreWinRate(stats.winRate),
    pf: scoreProfitFactor(stats.profitFactor)
  };
  
  // 総合スコア（平均）
  const totalScore = Math.round(
    (details.drawdown + details.rrr + details.winRate + details.pf) / 4
  );
  
  const labels = {
    5: '優秀',
    4: '良好',
    3: '普通',
    2: '要改善',
    1: '危険'
  };
  
  return {
    score: totalScore,
    label: labels[totalScore] || '評価不可',
    details
  };
}

function scoreDrawdown(dd) {
  if (dd <= 10) return 5;
  if (dd <= 20) return 4;
  if (dd <= 30) return 3;
  if (dd <= 50) return 2;
  return 1;
}

function scoreRRR(stats) {
  if (stats.averageLoss === 0) return 3;
  const rrr = Math.abs(stats.averageWin / stats.averageLoss);
  if (rrr >= 2.0) return 5;
  if (rrr >= 1.5) return 4;
  if (rrr >= 1.0) return 3;
  if (rrr >= 0.5) return 2;
  return 1;
}

function scoreWinRate(winRate) {
  if (winRate >= 60) return 5;
  if (winRate >= 50) return 4;
  if (winRate >= 40) return 3;
  if (winRate >= 30) return 2;
  return 1;
}

function scoreProfitFactor(pf) {
  if (pf >= 2.0) return 5;
  if (pf >= 1.5) return 4;
  if (pf >= 1.0) return 3;
  if (pf >= 0.5) return 2;
  return 1;
}

