/**
 * Chart.js ラッパー（動的インポート + 破棄管理）
 */

import { saveChartInstance, destroyChart } from './index.js';

let ChartModule = null;

async function getChartModule() {
  if (!ChartModule) {
    // Chart.js を動的読み込み
    const mod = await import('https://cdn.jsdelivr.net/npm/chart.js');
    ChartModule = mod;
  }
  return ChartModule;
}

/**
 * 月間損益（累積）ラインチャートを描画
 */
export async function renderMonthlyCumulativePnlChart({
  canvasId,
  trades,
  chartId
}) {
  const { Chart } = await getChartModule();

  // 既存チャートを破棄
  destroyChart(chartId);

  // 月別合計 → 累積へ変換
  const monthlyMap = new Map(); // key: YYYY-MM, value: sum pnl
  const sorted = [...trades].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  sorted.forEach(t => {
    const d = new Date(t.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyMap.set(key, (monthlyMap.get(key) || 0) + (t.pnl || 0));
  });

  const labels = Array.from(monthlyMap.keys());
  const monthlyVals = Array.from(monthlyMap.values());
  const cumulative = [];
  monthlyVals.reduce((acc, v, i) => {
    const next = acc + v;
    cumulative[i] = next;
    return next;
  }, 0);

  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  const chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: '累積損益',
          data: cumulative,
          tension: 0.25,
          borderColor: '#21808d',
          backgroundColor: 'rgba(33, 128, 141, 0.15)',
          fill: true,
          pointRadius: 2,
          pointHoverRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.parsed.y.toLocaleString()} 円`
          }
        }
      },
      scales: {
        y: {
          ticks: {
            callback: (v) => `${Number(v).toLocaleString()} 円`
          }
        }
      }
    }
  });

  saveChartInstance(chartId, chart);
}


