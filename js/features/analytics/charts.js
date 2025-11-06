/**
 * Chart.js ラッパー（動的インポート + 破棄管理）
 */

import { saveChartInstance, destroyChart } from './index.js';

let ChartCtor = null;

async function getChartModule() {
  // 既にグローバルにある場合
  if (window.Chart) {
    ChartCtor = window.Chart;
    return ChartCtor;
  }
  if (ChartCtor) return ChartCtor;

  // UMD版をスクリプトタグで動的読込（互換性が高い）
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Chart.js の読み込みに失敗しました'));
    document.head.appendChild(script);
  });
  ChartCtor = window.Chart;
  return ChartCtor;
}

/**
 * 月間損益（累積）ラインチャートを描画
 */
export async function renderMonthlyCumulativePnlChart({
  canvasId,
  trades,
  chartId
}) {
  const Chart = await getChartModule();

  // 既存チャートを破棄
  destroyChart(chartId);

  // 月別合計 → 累積へ変換
  const monthlyMap = new Map(); // key: YYYY-MM, value: sum pnl
  const sorted = [...trades].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const JST_OFFSET_MS = 9 * 60 * 60 * 1000; // UTC→JST (+9h)
  sorted.forEach(t => {
    // SupabaseのUTCタイムスタンプをJSTに補正して月を算出
    const d = new Date(new Date(t.created_at).getTime() + JST_OFFSET_MS);
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


