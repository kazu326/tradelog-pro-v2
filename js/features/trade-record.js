/**
 * トレード記録機能
 */
import { saveTrade, getTrades, deleteTrade } from '../core/storage.js';
import { calculateStats } from '../core/analytics.js';
import { showToast } from '../ui/toast.js';
import { getDerivedSettings, onSettingsChange } from '../core/settings.js';
import { normalizePairSymbol as normalizePair } from '../core/types.js';

let allTrades = [];
let derivedSettings = getDerivedSettings();
let usdRateInputManual = false;

/**
 * トレード記録タブを初期化
 */
export async function initTradeRecord(container) {
  container.innerHTML = `
    <div class="trade-record-container">
      <h2>トレード記録</h2>
      
      <!-- 統計サマリー -->
      <div class="stats-summary">
        <div class="stat-card">
          <div class="stat-label">合計トレード</div>
          <div class="stat-value" id="total-trades">0</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">勝率</div>
          <div class="stat-value" id="win-rate">0%</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">合計損益</div>
          <div class="stat-value" id="total-pnl">0円</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">プロフィットファクター</div>
          <div class="stat-value" id="profit-factor">0.00</div>
        </div>
      </div>

      <!-- トレード記録フォーム -->
      <div class="trade-form-container">
        <h3>新規トレード記録</h3>
        <form id="trade-form" class="trade-form">
          <div class="form-row">
            <div class="form-group">
              <label>通貨ペア <span class="required">*</span></label>
              <select name="pair" id="pair-select" required>
                <option value="">選択してください</option>
                <option value="USD/JPY">USD/JPY</option>
                <option value="EUR/JPY">EUR/JPY</option>
                <option value="GBP/JPY">GBP/JPY</option>
                <option value="AUD/JPY">AUD/JPY</option>
                <option value="EUR/USD">EUR/USD</option>
                <option value="GBP/USD">GBP/USD</option>
                <option value="XAU/USD">XAU/USD（GOLD）</option>
                <option value="GOLD/USD">GOLD/USD</option>
                <option value="XAUUSD">XAUUSD</option>
              </select>
            </div>

            <div class="form-group">
              <label>方向 <span class="required">*</span></label>
              <div class="direction-buttons">
                <button type="button" class="direction-btn" data-direction="買い">
                  📈 買い
                </button>
                <button type="button" class="direction-btn" data-direction="売り">
                  📉 売り
                </button>
              </div>
              <input type="hidden" name="direction" id="direction-input" required />
            </div>

            <div class="form-group">
              <label>ロットサイズ <span class="required">*</span></label>
              <div class="input-with-quick">
                <input type="number" name="lot_size" id="lot-size" step="0.01" required />
                <div class="quick-buttons">
                  <button type="button" class="quick-btn" data-value="0.1">0.1</button>
                  <button type="button" class="quick-btn" data-value="1">1.0</button>
                  <button type="button" class="quick-btn" data-value="5">5.0</button>
                </div>
              </div>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>取引日</label>
              <input type="date" id="trade-date-input" />
              <small class="help-text">レート取得時に使用します（保存時の時刻は自動記録）</small>
            </div>
            <div class="form-group">
              <label>USD/JPY レート</label>
              <div class="input-with-action">
                <input type="number" id="usd-jpy-rate-input" step="0.0001" min="1" />
                <button type="button" id="fetch-usdjpy-rate-btn" class="btn-secondary">レート取得</button>
              </div>
              <small class="help-text">指定日の終値を自動取得できます</small>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>エントリー価格 <span class="required">*</span></label>
              <input type="number" name="entry_price" id="entry-price" step="0.001" required />
            </div>

            <div class="form-group">
              <label>決済価格 <span class="required">*</span></label>
              <input type="number" name="exit_price" id="exit-price" step="0.001" required />
            </div>

            <div class="form-group">
              <label>Pips <span class="auto-label">自動計算</span></label>
              <input type="number" name="pips" id="pips" step="0.1" readonly style="background: var(--color-secondary);" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>損益（円） <span class="auto-label">自動計算</span></label>
              <input type="number" name="pnl" id="pnl" step="0.01" readonly style="background: var(--color-secondary);" />
            </div>

            <div class="form-group">
              <label>メモ</label>
              <textarea name="notes" rows="2" placeholder="トレードメモ（任意）"></textarea>
            </div>
          </div>

          <!-- リアルタイム計算結果 -->
          <div id="calculation-preview" class="calculation-preview" style="display: none;">
            <div class="preview-item">
              <span class="preview-label">Pips:</span>
              <span class="preview-value" id="preview-pips">-</span>
            </div>
            <div class="preview-item">
              <span class="preview-label">損益:</span>
              <span class="preview-value" id="preview-pnl">-</span>
            </div>
            <div class="preview-item">
              <span class="preview-label">勝率への影響:</span>
              <span class="preview-value" id="preview-impact">-</span>
            </div>
          </div>

          <button type="submit" class="btn-primary btn-submit">
            📝 記録する
          </button>
        </form>
      </div>

      <!-- トレード一覧 -->
      <div class="trades-list-container">
        <h3>トレード履歴</h3>
        <div id="trades-list" class="trades-list">
          読み込み中...
        </div>
      </div>
    </div>
  `;

  // フォーム送信
  document.getElementById('trade-form').addEventListener('submit', handleTradeSubmit);

  // 設定変更の購読（ロット/ピップ計算に反映）
  onSettingsChange((_, nextDerived) => {
    derivedSettings = nextDerived;
    if (!usdRateInputManual) {
      applyDefaultUsdJpyRate();
    }
    calculateTradeValues(); // 値を再計算
  });

  // 自動計算の初期化
  setupAutoCalculation();
  setupQuickButtons();
  setupDirectionButtons();
  setupRateHelpers();

  // トレード一覧を読み込み
  await loadTrades();
}

/**
 * トレード送信処理
 */
async function handleTradeSubmit(e) {
  e.preventDefault();

  const formData = new FormData(e.target);
  const tradeData = {
    pair: normalizePair(formData.get('pair')),
    direction: formData.get('direction'),
    lot_size: parseFloat(formData.get('lot_size')),
    entry_price: parseFloat(formData.get('entry_price')),
    exit_price: parseFloat(formData.get('exit_price')),
    pnl: parseFloat(formData.get('pnl')),
    pips: parseFloat(formData.get('pips')),
    notes: formData.get('notes') || ''
  };

  try {
    await saveTrade(tradeData);
    showToast('トレードを記録しました！', 'success');
    e.target.reset();
    await loadTrades();
  } catch (error) {
    showToast('エラーが発生しました', 'error');
    console.error(error);
  }
}

/**
 * トレード一覧を読み込み
 */
async function loadTrades() {
  try {
    allTrades = await getTrades();
    renderTrades();
    updateStats();
  } catch (error) {
    console.error('Error loading trades:', error);
    document.getElementById('trades-list').innerHTML = 
      '<p>エラーが発生しました</p>';
  }
}

/**
 * トレード一覧を表示
 */
function renderTrades() {
  const container = document.getElementById('trades-list');

  if (allTrades.length === 0) {
    container.innerHTML = '<p>まだトレード記録がありません</p>';
    return;
  }

  container.innerHTML = allTrades.map(trade => `
    <div class="trade-card ${trade.pnl > 0 ? 'profit' : 'loss'}">
      <div class="trade-header">
        <span class="trade-pair">${trade.pair}</span>
        <span class="trade-direction ${trade.direction === '買い' ? 'buy' : 'sell'}">
          ${trade.direction}
        </span>
        <span class="trade-pnl">${trade.pnl > 0 ? '+' : ''}${trade.pnl.toLocaleString()}円</span>
      </div>
      <div class="trade-details">
        <span>ロット: ${trade.lot_size}</span>
        <span>エントリー: ${trade.entry_price}</span>
        <span>決済: ${trade.exit_price}</span>
        <span>Pips: ${trade.pips}</span>
      </div>
      ${trade.notes ? `<div class="trade-notes">${trade.notes}</div>` : ''}
      <div class="trade-footer">
        <span class="trade-date">${new Date(trade.created_at).toLocaleString('ja-JP')}</span>
        <button class="btn-delete" onclick="window.deleteTradeHandler('${trade.id}')">削除</button>
      </div>
    </div>
  `).join('');
}

/**
 * 統計を更新
 */
function updateStats() {
  const stats = calculateStats(allTrades);

  document.getElementById('total-trades').textContent = stats.totalTrades;
  document.getElementById('win-rate').textContent = stats.winRate.toFixed(1) + '%';
  document.getElementById('total-pnl').textContent = stats.totalPnl.toLocaleString() + '円';
  document.getElementById('profit-factor').textContent = stats.profitFactor.toFixed(2);
}

/**
 * トレード削除（グローバル関数）
 */
window.deleteTradeHandler = async function(tradeId) {
  if (!confirm('このトレードを削除しますか？')) return;

  try {
    await deleteTrade(tradeId);
    showToast('トレードを削除しました', 'success');
    await loadTrades();
  } catch (error) {
    showToast('エラーが発生しました', 'error');
    console.error(error);
  }
};

/**
 * 自動計算セットアップ
 */
function setupAutoCalculation() {
  const pairSelect = document.getElementById('pair-select');
  const entryPrice = document.getElementById('entry-price');
  const exitPrice = document.getElementById('exit-price');
  const lotSize = document.getElementById('lot-size');

  // 入力変更時に計算
  [pairSelect, entryPrice, exitPrice, lotSize].forEach(input => {
    if (input) {
      input.addEventListener('input', calculateTradeValues);
    }
  });
}

/**
 * トレード値を計算
 */
function calculateTradeValues() {
  const pair = document.getElementById('pair-select')?.value;
  const entry = parseFloat(document.getElementById('entry-price')?.value);
  const exit = parseFloat(document.getElementById('exit-price')?.value);
  const lot = parseFloat(document.getElementById('lot-size')?.value);
  const direction = document.getElementById('direction-input')?.value;
  const usdRateInput = document.getElementById('usd-jpy-rate-input');

  if (!pair || !entry || !exit || !lot || !direction) {
    return;
  }

  const normalizedPair = normalizePair(pair);

  // Pips計算
  let pips = 0;
  let pipMultiplier = 100;
  let pipValuePerLot = 1000;
  let usdJpyRateUsed = parseFloat(usdRateInput?.value || '');
  if (!usdJpyRateUsed || Number.isNaN(usdJpyRateUsed)) {
    usdJpyRateUsed = derivedSettings.settings.usdJpyRate;
  }

  if (normalizedPair.endsWith('/JPY')) {
    pipMultiplier = derivedSettings.fxJpy.pipMultiplier;
    pipValuePerLot = derivedSettings.fxJpy.pipValuePerLot;
  } else if (normalizedPair === 'XAU/USD') {
    pipMultiplier = derivedSettings.gold.pipMultiplier;
    pipValuePerLot = derivedSettings.settings.goldLotSize * derivedSettings.settings.goldPipSize * usdJpyRateUsed;
  } else {
    pipMultiplier = derivedSettings.fxUsd.pipMultiplier;
    pipValuePerLot = derivedSettings.settings.fxLotSize * derivedSettings.settings.fxPipSizeUsd * usdJpyRateUsed;
  }

  if (direction === '買い') {
    pips = (exit - entry) * pipMultiplier;
  } else {
    pips = (entry - exit) * pipMultiplier;
  }

  // 損益計算
  const pnl = pips * lot * pipValuePerLot;

  // フォームに反映
  const pipsInput = document.getElementById('pips');
  const pnlInput = document.getElementById('pnl');
  
  if (pipsInput) pipsInput.value = pips.toFixed(1);
  if (pnlInput) pnlInput.value = pnl.toFixed(0);

  // プレビュー表示
  updateCalculationPreview(pips, pnl, pipMultiplier, pipValuePerLot, usdJpyRateUsed, normalizedPair);
}

/**
 * 計算プレビュー更新
 */
function updateCalculationPreview(pips, pnl, pipMultiplier, pipValuePerLot, usdJpyRate, pair) {
  const preview = document.getElementById('calculation-preview');
  if (!preview) return;
  
  preview.style.display = 'flex';

  const previewPips = document.getElementById('preview-pips');
  const previewPnl = document.getElementById('preview-pnl');
  const previewImpact = document.getElementById('preview-impact');

  if (previewPips) previewPips.textContent = pips.toFixed(1);
  if (previewPnl) {
    previewPnl.textContent = (pnl > 0 ? '+' : '') + pnl.toLocaleString() + '円';
    previewPnl.style.color = pnl > 0 ? 'var(--color-success)' : 'var(--color-error)';
  }

  const previewMeta = preview.querySelector('.preview-meta');
  const rateText = pair === 'XAU/USD' || (!pair.endsWith('/JPY') && pair.includes('/USD'))
    ? ` USDJPY: ${usdJpyRate.toFixed(3)}`
    : '';
  if (!previewMeta) {
    const meta = document.createElement('div');
    meta.className = 'preview-meta';
    meta.style.fontSize = '12px';
    meta.style.color = 'var(--color-text-secondary)';
    meta.style.marginTop = '4px';
    meta.textContent = `1ロットあたり1pips = 約${Math.round(pipValuePerLot).toLocaleString()}円 (${pipMultiplier.toFixed(0)}倍計算${rateText})`;
    preview.appendChild(meta);
  } else {
    previewMeta.textContent = `1ロットあたり1pips = 約${Math.round(pipValuePerLot).toLocaleString()}円 (${pipMultiplier.toFixed(0)}倍計算${rateText})`;
  }

  // 勝率への影響
  const currentWinRate = allTrades.length > 0 
    ? (allTrades.filter(t => t.pnl > 0).length / allTrades.length) * 100 
    : 0;
  const newWins = allTrades.filter(t => t.pnl > 0).length + (pnl > 0 ? 1 : 0);
  const newTotal = allTrades.length + 1;
  const newWinRate = (newWins / newTotal) * 100;
  const impact = newWinRate - currentWinRate;

  if (previewImpact) {
    previewImpact.textContent = (impact > 0 ? '+' : '') + impact.toFixed(1) + '%';
  }
}

/**
 * クイックボタンセットアップ
 */
function setupQuickButtons() {
  document.querySelectorAll('.quick-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const value = e.currentTarget?.dataset?.value;
      const lotInput = document.getElementById('lot-size');
      if (lotInput && value) {
        lotInput.value = value;
        calculateTradeValues();
      }
    });
  });
}

/**
 * 方向ボタンセットアップ
 */
function setupDirectionButtons() {
  document.querySelectorAll('.direction-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.direction-btn').forEach(b => {
        b.classList.remove('active');
      });
      
      const target = e.currentTarget;
      if (!target) return;
      target.classList.add('active');
      
      const directionInput = document.getElementById('direction-input');
      if (directionInput) {
        directionInput.value = target.dataset.direction;
        calculateTradeValues();
      }
    });
  });
}

function setupRateHelpers() {
  const usdRateInput = document.getElementById('usd-jpy-rate-input');
  const tradeDateInput = document.getElementById('trade-date-input');
  const fetchBtn = document.getElementById('fetch-usdjpy-rate-btn');

  const today = new Date();
  const tzOffset = today.getTimezoneOffset() * 60000;
  const dateValue = new Date(today.getTime() - tzOffset).toISOString().slice(0, 10);
  if (tradeDateInput && !tradeDateInput.value) {
    tradeDateInput.value = dateValue;
  }

  applyDefaultUsdJpyRate();

  if (usdRateInput) {
    usdRateInput.addEventListener('input', () => {
      usdRateInputManual = true;
      calculateTradeValues();
    });
  }

  if (fetchBtn) {
    fetchBtn.addEventListener('click', async () => {
      if (!tradeDateInput || !tradeDateInput.value) {
        showToast('取引日を入力してください。', 'warning');
        return;
      }
      fetchBtn.disabled = true;
      fetchBtn.textContent = '取得中...';
      try {
        const rate = await fetchUsdJpyRate(tradeDateInput.value);
        if (!rate) throw new Error('レートが取得できませんでした');
        if (usdRateInput) {
          usdRateInput.value = Number(rate).toFixed(3);
        }
        usdRateInputManual = true;
        showToast(`USD/JPY ${Number(rate).toFixed(3)} を反映しました`, 'success');
        calculateTradeValues();
      } catch (error) {
        console.error('USDJPY rate fetch error:', error);
        showToast('レート取得に失敗しました。', 'error');
      } finally {
        fetchBtn.disabled = false;
        fetchBtn.textContent = 'レート取得';
      }
    });
  }
}

async function fetchUsdJpyRate(date) {
  const endpoint = date
    ? `https://api.exchangerate.host/${date}?base=USD&symbols=JPY`
    : 'https://api.exchangerate.host/latest?base=USD&symbols=JPY';
  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const data = await response.json();
  return data?.rates?.JPY;
}

function applyDefaultUsdJpyRate() {
  const usdRateInput = document.getElementById('usd-jpy-rate-input');
  if (usdRateInput) {
    const value = Number(derivedSettings.settings.usdJpyRate || 0);
    if (!Number.isNaN(value) && value > 0) {
      usdRateInput.value = value.toFixed(3);
    } else {
      usdRateInput.value = '';
    }
  }
}
