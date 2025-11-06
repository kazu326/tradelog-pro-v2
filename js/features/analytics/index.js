/**
 * 分析ページ - メインエントリーポイント
 * タブ管理・状態管理
 */
import { getTrades } from '../../core/storage.js';
import { calculateStats, calculateDrawdown } from '../../core/analytics.js';
import { renderMonthlyCumulativePnlChart } from './charts.js';
import { showToast } from '../../ui/toast.js';

// 初期化済みセクションを追跡
const initedSections = new Set();
// チャートインスタンスを保持
const chartInstances = new Map();

/**
 * 分析ページを初期化
 */
export async function initAnalytics(container) {
  console.log('📊 分析ページを初期化中...');
  
  // ローディング表示
  container.innerHTML = '<div style="text-align: center; padding: 40px;">読み込み中...</div>';
  
  try {
    // トレードデータ取得
    const trades = await getTrades(1000);
    
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
    container.innerHTML = buildAnalyticsUI(stats, drawdown, trades);
    
    // タブとアコーディオンのイベントリスナーを設定
    setupTabs();
    setupAccordions(trades);

    // 初期タブが graphs の場合は、初回描画を即時実行
    const savedTab = localStorage.getItem('analytics:tab') || 'overview';
    if (savedTab === 'graphs') {
      initGraphsLazy(trades);
    }
    
  } catch (error) {
    console.error('分析ページの初期化エラー:', error);
    showToast('分析データの読み込みに失敗しました', 'error');
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
function buildAnalyticsUI(stats, drawdown, trades) {
  // 保存されたタブを取得
  const savedTab = localStorage.getItem('analytics:tab') || 'overview';
  
  return `
    <div class="analytics-page">
      <h2 style="margin-bottom: 24px;">📊 分析</h2>
      
      <!-- タブ -->
      <div class="analytics-tabs">
        <button class="analytics-tab-btn ${savedTab === 'overview' ? 'active' : ''}" 
                data-tab="overview" 
                aria-selected="${savedTab === 'overview'}">
          概要
        </button>
        <button class="analytics-tab-btn ${savedTab === 'detail' ? 'active' : ''}" 
                data-tab="detail" 
                aria-selected="${savedTab === 'detail'}">
          詳細
        </button>
        <button class="analytics-tab-btn ${savedTab === 'graphs' ? 'active' : ''}" 
                data-tab="graphs" 
                aria-selected="${savedTab === 'graphs'}">
          グラフ
        </button>
      </div>
      
      <!-- タブコンテンツ -->
      <div class="analytics-tab-content">
        <!-- 概要タブ -->
        <div id="analytics-overview" class="analytics-tab-pane ${savedTab === 'overview' ? 'active' : ''}">
          ${buildOverviewTab(stats, drawdown)}
        </div>
        
        <!-- 詳細タブ -->
        <div id="analytics-detail" class="analytics-tab-pane ${savedTab === 'detail' ? 'active' : ''}">
          ${buildDetailTab()}
        </div>
        
        <!-- グラフタブ -->
        <div id="analytics-graphs" class="analytics-tab-pane ${savedTab === 'graphs' ? 'active' : ''}">
          ${buildGraphsTab()}
        </div>
      </div>
    </div>
  `;
}

/**
 * 概要タブを構築
 */
function buildOverviewTab(stats, drawdown) {
  return `
    <div class="overview-section">
      <!-- 概要カード（4つ横並び） -->
      <div class="summary-cards">
        ${createSummaryCard('総損益', formatCurrency(stats.totalPnl), stats.totalPnl >= 0 ? 'positive' : 'negative')}
        ${createSummaryCard('勝率', `${stats.winRate.toFixed(1)}%`, stats.winRate >= 50 ? 'positive' : 'neutral')}
        ${createSummaryCard('プロフィットファクター', stats.profitFactor.toFixed(2), stats.profitFactor >= 1.5 ? 'positive' : stats.profitFactor >= 1.0 ? 'neutral' : 'negative')}
        ${createSummaryCard('最大DD', `${drawdown.max.toFixed(1)}%`, drawdown.max <= 20 ? 'positive' : drawdown.max <= 50 ? 'neutral' : 'negative')}
      </div>
    </div>
  `;
}

/**
 * 詳細タブを構築
 */
function buildDetailTab() {
  // 保存されたアコーディオンの状態を取得
  const pairStatsOpen = localStorage.getItem('analytics:section:pair-stats') === '1';
  const timeStatsOpen = localStorage.getItem('analytics:section:time-stats') === '1';
  const dayStatsOpen = localStorage.getItem('analytics:section:day-stats') === '1';
  const lotStatsOpen = localStorage.getItem('analytics:section:lot-stats') === '1';
  const streakStatsOpen = localStorage.getItem('analytics:section:streak-stats') === '1';
  const riskScoreOpen = localStorage.getItem('analytics:section:risk-score') === '1';
  
  // 初期は「通貨ペア別」のみ開く
  const defaultOpen = !pairStatsOpen && !timeStatsOpen && !dayStatsOpen && !lotStatsOpen && !streakStatsOpen && !riskScoreOpen;
  
  return `
    <div class="detail-section">
      <!-- 通貨ペア別統計 -->
      <div class="accordion ${defaultOpen || pairStatsOpen ? 'accordion--open' : ''}" 
           id="pair-stats" 
           data-section="pair-stats">
        <button class="accordion__toggle" 
                data-acc-toggle 
                aria-expanded="${defaultOpen || pairStatsOpen}"
                aria-controls="pair-stats-content">
          <span class="accordion__title">📊 通貨ペア別統計</span>
          <span class="accordion__icon">▼</span>
        </button>
        <div class="accordion__content" id="pair-stats-content">
          <div class="accordion__body">
            <div class="loading-spinner" style="text-align: center; padding: 40px;">
              読み込み中...
            </div>
          </div>
        </div>
      </div>
      
      <!-- 時間帯別統計 -->
      <div class="accordion ${timeStatsOpen ? 'accordion--open' : ''}" 
           id="time-stats" 
           data-section="time-stats">
        <button class="accordion__toggle" 
                data-acc-toggle 
                aria-expanded="${timeStatsOpen}"
                aria-controls="time-stats-content">
          <span class="accordion__title">⏰ 時間帯別統計</span>
          <span class="accordion__icon">▼</span>
        </button>
        <div class="accordion__content" id="time-stats-content">
          <div class="accordion__body">
            <div class="loading-spinner" style="text-align: center; padding: 40px;">
              読み込み中...
            </div>
          </div>
        </div>
      </div>
      
      <!-- 曜日別統計 -->
      <div class="accordion ${dayStatsOpen ? 'accordion--open' : ''}" 
           id="day-stats" 
           data-section="day-stats">
        <button class="accordion__toggle" 
                data-acc-toggle 
                aria-expanded="${dayStatsOpen}"
                aria-controls="day-stats-content">
          <span class="accordion__title">📅 曜日別統計</span>
          <span class="accordion__icon">▼</span>
        </button>
        <div class="accordion__content" id="day-stats-content">
          <div class="accordion__body">
            <div class="loading-spinner" style="text-align: center; padding: 40px;">
              読み込み中...
            </div>
          </div>
        </div>
      </div>
      
      <!-- ロット別統計 -->
      <div class="accordion ${lotStatsOpen ? 'accordion--open' : ''}" 
           id="lot-stats" 
           data-section="lot-stats">
        <button class="accordion__toggle" 
                data-acc-toggle 
                aria-expanded="${lotStatsOpen}"
                aria-controls="lot-stats-content">
          <span class="accordion__title">💰 ロット別統計</span>
          <span class="accordion__icon">▼</span>
        </button>
        <div class="accordion__content" id="lot-stats-content">
          <div class="accordion__body">
            <div class="loading-spinner" style="text-align: center; padding: 40px;">
              読み込み中...
            </div>
          </div>
        </div>
      </div>
      
      <!-- 連勝・連敗統計 -->
      <div class="accordion ${streakStatsOpen ? 'accordion--open' : ''}" 
           id="streak-stats" 
           data-section="streak-stats">
        <button class="accordion__toggle" 
                data-acc-toggle 
                aria-expanded="${streakStatsOpen}"
                aria-controls="streak-stats-content">
          <span class="accordion__title">🔥 連勝・連敗統計</span>
          <span class="accordion__icon">▼</span>
        </button>
        <div class="accordion__content" id="streak-stats-content">
          <div class="accordion__body">
            <div class="loading-spinner" style="text-align: center; padding: 40px;">
              読み込み中...
            </div>
          </div>
        </div>
      </div>
      
      <!-- リスク管理スコア -->
      <div class="accordion ${riskScoreOpen ? 'accordion--open' : ''}" 
           id="risk-score" 
           data-section="risk-score">
        <button class="accordion__toggle" 
                data-acc-toggle 
                aria-expanded="${riskScoreOpen}"
                aria-controls="risk-score-content">
          <span class="accordion__title">🎯 リスク管理スコア</span>
          <span class="accordion__icon">▼</span>
        </button>
        <div class="accordion__content" id="risk-score-content">
          <div class="accordion__body">
            <div class="loading-spinner" style="text-align: center; padding: 40px;">
              読み込み中...
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * グラフタブを構築
 */
function buildGraphsTab() {
  return `
    <div class="graphs-section">
      <h3 style="margin-bottom: 12px;">📈 月間損益（累積）</h3>
      <div class="chart-card">
        <div class="chart-container">
          <canvas id="monthly-pnl-canvas" aria-label="月間損益グラフ" role="img"></canvas>
        </div>
      </div>
    </div>
  `;
}

/**
 * タブ切替を設定
 */
function setupTabs() {
  const tabButtons = document.querySelectorAll('.analytics-tab-btn');
  const tabPanes = document.querySelectorAll('.analytics-tab-pane');
  
  tabButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tab = e.currentTarget.dataset.tab;
      switchTab(tab);
      localStorage.setItem('analytics:tab', tab);
    });
  });
}

/**
 * タブを切替
 */
let graphsInitialized = false;

function switchTab(tab) {
  // ボタンの状態を更新
  document.querySelectorAll('.analytics-tab-btn').forEach(btn => {
    const isActive = btn.dataset.tab === tab;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', isActive);
  });
  
  // ペインの表示を切替
  document.querySelectorAll('.analytics-tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === `analytics-${tab}`);
  });
  
  // グラフタブの場合はチャートを破棄
  if (tab !== 'graphs') {
    destroyAllCharts();
  } else {
    // 初回のみグラフ初期化（遅延ロード）
    if (!graphsInitialized) {
      initGraphsLazy();
    }
  }
}

function initGraphsLazy(tradesCache) {
  const run = async () => {
    const trades = tradesCache || await getTrades(1000);
    await renderMonthlyCumulativePnlChart({
      canvasId: 'monthly-pnl-canvas',
      trades,
      chartId: 'monthly-pnl'
    });
    graphsInitialized = true;
  };
  // UIスレッドブロックを避けて非同期に実行
  setTimeout(run, 0);
}

/**
 * アコーディオンを設定
 */
function setupAccordions(trades) {
  // 通貨ペア別統計
  bindAccordion('pair-stats', async () => {
    const { initPairStats } = await import('./sections/pairs.js');
    await initPairStats(trades);
  });
  
  // 時間帯別統計
  bindAccordion('time-stats', async () => {
    const { initTimeStats } = await import('./sections/time.js');
    await initTimeStats(trades);
  });
  
  // 曜日別統計
  bindAccordion('day-stats', async () => {
    const { initDayStats } = await import('./sections/day.js');
    await initDayStats(trades);
  });
  
  // ロット別統計
  bindAccordion('lot-stats', async () => {
    const { initLotStats } = await import('./sections/lot.js');
    await initLotStats(trades);
  });
  
  // 連勝・連敗統計
  bindAccordion('streak-stats', async () => {
    const { initStreakStats } = await import('./sections/streak.js');
    await initStreakStats(trades);
  });
  
  // リスク管理スコア
  bindAccordion('risk-score', async () => {
    const { initRiskScore } = await import('./sections/risk.js');
    await initRiskScore(trades);
  });
  
  // 初期状態で開いているアコーディオンを初期化
  document.querySelectorAll('.accordion.accordion--open').forEach(accordion => {
    const sectionId = accordion.id;
    if (!initedSections.has(sectionId)) {
      // 少し遅延させて初期化（UIスレッドブロック回避）
      setTimeout(() => {
        const toggle = accordion.querySelector('[data-acc-toggle]');
        if (toggle) {
          toggle.click();
        }
      }, 100);
    }
  });
}

/**
 * アコーディオンをバインド（遅延ロード対応）
 */
function bindAccordion(sectionId, initFn) {
  const root = document.getElementById(sectionId);
  if (!root) return;
  
  const btn = root.querySelector('[data-acc-toggle]');
  if (!btn) return;
  
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    const isOpen = root.classList.toggle('accordion--open');
    btn.setAttribute('aria-expanded', isOpen);
    
    // 状態を保存
    localStorage.setItem(`analytics:section:${sectionId}`, isOpen ? '1' : '0');
    
    // 開いた時のみ初期化（一度だけ）
    if (isOpen && !initedSections.has(sectionId)) {
      try {
        const content = root.querySelector('.accordion__body');
        if (content) {
          // ローディング表示
          content.innerHTML = '<div class="loading-spinner" style="text-align: center; padding: 40px;">読み込み中...</div>';
          
          // 重い処理は非同期で実行
          await new Promise(resolve => setTimeout(resolve, 0)); // UIスレッドブロック回避
          await initFn();
          
          initedSections.add(sectionId);
        }
      } catch (error) {
        console.error(`セクション ${sectionId} の初期化エラー:`, error);
        showToast('データの読み込みに失敗しました', 'error');
        const content = root.querySelector('.accordion__body');
        if (content) {
          content.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--color-error);">エラーが発生しました</div>`;
        }
      }
    }
  });
  
  // キーボード操作対応
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      btn.click();
    }
  });
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

/**
 * チャートを破棄
 */
export function destroyChart(chartId) {
  const chart = chartInstances.get(chartId);
  if (chart && typeof chart.destroy === 'function') {
    chart.destroy();
    chartInstances.delete(chartId);
  }
}

/**
 * 全てのチャートを破棄
 */
function destroyAllCharts() {
  chartInstances.forEach((chart, id) => {
    if (chart && typeof chart.destroy === 'function') {
      chart.destroy();
    }
  });
  chartInstances.clear();
}

/**
 * チャートインスタンスを保存
 */
export function saveChartInstance(chartId, chart) {
  chartInstances.set(chartId, chart);
}

