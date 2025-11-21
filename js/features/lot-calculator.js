/**
 * ロット計算機能 - リファクタリング版
 * 
 * カテゴリー選択 → 銘柄選択 → リアルタイム計算のフロー実装
 */

import { el } from '../utils/dom.js';
import { CATEGORIES, PAIRS, getPairById, getPairsByCategory, DEFAULT_PAIR_ID } from '../config/pairs-config.js';
import { rateService } from '../services/rate-service.js';
import { getDerivedSettings, getSettings, updateSettings, applyPreset, resetSettings, PRESET_LABELS, onSettingsChange } from '../core/settings.js';

// ========================================
// ステート管理
// ========================================
const state = {
  // コンテナ参照
  container: null,

  // 選択状態
  selectedCategory: null, // 'cross-yen' | 'gold' | 'stock' | 'crypto'
  selectedPairId: null, // 現在選択中の銘柄ID

  // 計算パラメータ
  balance: 1000000, // 口座残高（円）
  riskPercentage: 2.0, // リスク許容率（%）
  stopLossPips: 20, // 損切り幅（pips）
  accountType: 'overseas', // 'overseas' | 'domestic' | 'micro'

  // レート情報
  currentRate: null, // 現在のレート
  isLoadingRate: false, // レート取得中フラグ

  // 計算結果
  calculatedLot: null,
  riskAmount: null
};

// ========================================
// メイン初期化
// ========================================
export function initLotCalculator(container) {
  // コンテナが渡されなかった場合のフォールバック
  const target = container || document.getElementById('lot-calculator-container');
  if (!target) {
    console.error('Lot calculator container not found');
    return;
  }

  // グローバル変数にコンテナを保存（render関数から参照するため）
  state.container = target;

  // 初期レート取得
  updateRate();

  // UI描画
  render();
}

// ========================================
// レンダリング（UI全体構築）
// ========================================
function render() {
  const container = state.container;
  if (!container) {
    console.error('Container not initialized');
    return;
  }

  // コンテナをクリアして再構築
  container.innerHTML = '';
  container.appendChild(
    el('div', { className: 'lot-calculator' },
      // タイトル
      el('h2', { className: 'calculator-title' }, 'ロット計算'),

      // カテゴリー選択（大選択）
      renderCategorySelector(),
      
      // 銘柄選択（小選択）- カテゴリー選択後に表示
      state.selectedCategory ? renderPairSelector() : null,
      
      // 計算パラメータ入力
      state.selectedPairId ? renderCalculatorInputs() : null,
      
      // 計算結果表示
      state.calculatedLot !== null ? renderResults() : null
    )
  );
}

// ========================================
// カテゴリー選択UI（小さなボタン）
// ========================================
function renderCategorySelector() {
  return el('div', { className: 'category-selector' },
    el('h3', { className: 'section-title' }, '取引商品を選択'),
    
    // 小さなボタンのグループ
    el('div', { className: 'category-buttons' },
      ...CATEGORIES.map(category => 
        el('button', {
          className: `category-btn ${state.selectedCategory === category.id ? 'active' : ''}`,
          onClick: () => handleCategorySelect(category.id),
          type: 'button',
          dataset: { category: category.id }
        }, category.displayName) // アイコンなし、テキストのみ
      )
    ),
    
    // 選択時に表示されるカード（縁取りが変化）
    state.selectedCategory ? renderCategoryCard() : null
  );
}

// 新しい関数：選択されたカテゴリーのカードを表示
function renderCategoryCard() {
  const category = CATEGORIES.find(c => c.id === state.selectedCategory);
  if (!category) return null;

  return el('div', {
    className: 'category-card-container',
    dataset: { category: category.id }
  },
    el('div', {
      className: 'category-info-card',
      style: { borderColor: category.color }
    },
      el('div', { className: 'card-content' },
        el('h4', { className: 'card-title' }, category.displayName),
        el('p', { className: 'card-description' }, category.description)
      )
    )
  );
}

// ========================================
// 銘柄選択UI（小選択プルダウン）
// ========================================
function renderPairSelector() {
  const pairs = getPairsByCategory(state.selectedCategory);

  return el('div', { className: 'pair-selector' },
    el('h3', { className: 'section-title' }, '銘柄を選択'),
    el('div', { style: { display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' } },
      el('select', {
        className: 'pair-select',
        value: state.selectedPairId || '',
        onChange: (e) => handlePairSelect(e.target.value)
      },
        ...pairs.map(pair =>
          el('option', { value: pair.id }, `${pair.icon} ${pair.displayName}`)
        )
      ),

      // 現在レート表示
      renderCurrentRate()
    )
  );
}

function renderCurrentRate() {
  if (!state.selectedPairId) return null;
  const pair = getPairById(state.selectedPairId);
  if (!pair) return null;

  return el('div', { className: 'current-rate' },
    el('span', { className: 'rate-label' }, '現在レート:'),
    state.isLoadingRate
      ? el('span', { className: 'rate-loading' }, '読込中...')
      : state.currentRate
        ? el('span', { className: 'rate-value' }, state.currentRate.toFixed(pair.decimal))
        : el('div', { className: 'rate-error-container', style: { display: 'flex', alignItems: 'center', gap: '10px' } },
            el('span', { className: 'rate-error' }, '取得失敗'),
            el('button', {
              className: 'manual-rate-btn',
              style: {
                padding: '5px 10px',
                fontSize: '12px',
                background: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              },
              onClick: () => promptManualRate()
            }, '手動入力')
          )
  );
}

// 手動レート入力関数
function promptManualRate() {
  const pair = getPairById(state.selectedPairId);
  const input = prompt(`${pair.displayName}の現在レートを入力してください:`);

  if (input && !isNaN(parseFloat(input))) {
    state.currentRate = parseFloat(input);
    render();
  }
}

// ========================================
// 計算パラメータ入力UI
// ========================================
function renderCalculatorInputs() {
  return el('div', { className: 'calculator-inputs' },
    el('h3', { className: 'section-title' }, '計算条件'),

    // 口座残高
    el('div', { className: 'input-group' },
      el('label', {}, '口座残高（円）'),
      el('input', {
        type: 'number',
        value: state.balance,
        onChange: (e) => handleInputChange('balance', parseFloat(e.target.value)) // changed from onInput to onChange to prevent scroll jump
      })
    ),

    // リスク許容率
    el('div', { className: 'input-group' },
      el('label', {}, `許容リスク（${state.riskPercentage}%）`),
      el('input', {
        type: 'range',
        min: '0.5',
        max: '10',
        step: '0.5',
        value: state.riskPercentage,
        onInput: (e) => handleInputChange('riskPercentage', parseFloat(e.target.value))
      }),
      el('div', { className: 'risk-presets' },
        el('button', { onClick: () => handleInputChange('riskPercentage', 1), className: state.riskPercentage === 1 ? 'active' : '' }, '1%'),
        el('button', { onClick: () => handleInputChange('riskPercentage', 2), className: state.riskPercentage === 2 ? 'active recommended' : 'recommended' }, '2%（推奨）'),
        el('button', { onClick: () => handleInputChange('riskPercentage', 5), className: state.riskPercentage === 5 ? 'active' : '' }, '5%')
      )
    ),

    // 損切り幅
    el('div', { className: 'input-group' },
      el('label', {}, '損切り幅（pips）'),
      el('input', {
        type: 'number',
        value: state.stopLossPips,
        onChange: (e) => handleInputChange('stopLossPips', parseFloat(e.target.value)) // changed from onInput to onChange to prevent scroll jump
      })
    ),

    // 口座タイプ
    el('div', { className: 'input-group' },
      el('label', {}, '口座タイプ'),
      el('select', {
        className: 'account-type-select',
        value: state.accountType,
        onChange: (e) => {
          handleInputChange('accountType', e.target.value);
        }
      },
        el('option', { value: 'overseas' }, '海外FX（10万通貨）'),
        el('option', { value: 'domestic' }, '国内FX（1万通貨）'),
        el('option', { value: 'micro' }, 'マイクロ口座（1000通貨）')
      )
    ),

    // 計算実行ボタン
    el('button', {
      className: 'calculate-btn',
      onClick: handleCalculate
    }, '計算する')
  );
}

// ========================================
// 計算結果表示UI
// ========================================
function renderResults() {
  return el('div', { className: 'calculator-results' },
    el('h3', { className: 'section-title' }, '計算結果'),

    el('div', { className: 'result-card' },
      el('div', { className: 'result-item primary' },
        el('span', { className: 'result-label' }, '推奨ロット数'),
        el('span', { className: 'result-value' }, `${state.calculatedLot} Lot`)
      ),
      
      el('div', { className: 'result-item' },
        el('span', { className: 'result-label' }, '許容リスク額'),
        el('span', { className: 'result-value' }, `¥${state.riskAmount.toLocaleString()}`)
      )
    )
  );
}

// ========================================
// イベントハンドラ
// ========================================
function handleCategorySelect(categoryId) {
  state.selectedCategory = categoryId;
  
  // カテゴリー内の最初の銘柄を自動選択
  const pairs = getPairsByCategory(categoryId);
  if (pairs.length > 0) {
    state.selectedPairId = pairs[0].id;
    updateRate();
  } else {
    state.selectedPairId = null;
    render();
  }
}

function handlePairSelect(pairId) {
  state.selectedPairId = pairId;
  updateRate();
  render(); // updateRate内でもrenderされるが、ローディング表示のためここでも呼ぶ
}

function handleInputChange(key, value) {
  state[key] = value;
  render();
}

function handleCalculate() {
  const pair = getPairById(state.selectedPairId);
  if (!pair || !state.currentRate) {
    alert('レート情報を取得できません。手動でレートを入力してください。');
    return;
  }

  // 基本の契約サイズ
  let contractSize = pair.contractSize;

  // 口座タイプによる契約サイズ調整（FXのみ）
  if (pair.type === 'forex') {
    if (state.accountType === 'domestic') {
      contractSize = 10000; // 国内1万通貨
    } else if (state.accountType === 'micro') {
      contractSize = 1000; // マイクロ1000通貨
    } else {
      contractSize = 100000; // 海外10万通貨
    }
  }

  // リスク許容額（円）
  const riskAmount = state.balance * (state.riskPercentage / 100);

  // 1pipの価値計算
  let pipValue;

  if (pair.type === 'forex') {
    if (pair.isJpyPair) {
      // クロス円: 0.01円 = 1pip
      pipValue = (contractSize / 100);
    } else {
      // クロスドル等: 0.0001ドル = 1pip
      const assumedUsdJpy = 150;
      pipValue = (contractSize / 10000) * assumedUsdJpy;
    }
  } else if (pair.type === 'commodity') {
    // GOLD等: pipValueをそのまま使用（口座タイプによる調整は不要）
    pipValue = pair.pipValue;
  } else if (pair.type === 'crypto') {
    // 仮想通貨: pipValueを使用（1ドル変動の円価値）
    pipValue = pair.pipValue;

    // 損切り幅は「ドル単位」と解釈
    // 例: 20pips = 20ドル変動
  } else if (pair.type === 'stock') {
    // 株式CFD: pipValueをそのまま使用
    pipValue = pair.pipValue;
  }

  // ロット数計算: リスク額 ÷ (SL幅 × 1pip価値)
  let lots = riskAmount / (state.stopLossPips * pipValue);

  // 小数点処理（商品タイプに応じて）
  let finalLots;
  if (pair.type === 'forex') {
    finalLots = Math.floor(lots * 100) / 100; // 0.01ロット単位
  } else if (pair.type === 'crypto') {
    finalLots = Math.floor(lots * 10000) / 10000; // 0.0001単位
  } else if (pair.type === 'commodity') {
    finalLots = Math.max(Math.floor(lots * 100) / 100, pair.minLot);
  } else if (pair.type === 'stock') {
    finalLots = Math.floor(lots * 10) / 10; // 0.1単位
  }

  // 最小ロット制約
  if (finalLots < pair.minLot) {
    finalLots = pair.minLot;
  }

  // 結果を保存
  state.calculatedLot = finalLots;
  state.riskAmount = Math.floor(riskAmount);

  console.log('計算結果:', {
    pair: pair.displayName,
    type: pair.type,
    accountType: state.accountType,
    contractSize,
    pipValue,
    currentRate: state.currentRate,
    riskAmount,
    stopLossPips: state.stopLossPips,
    rawLots: lots,
    calculatedLots: finalLots
  });

  render();
}

// ========================================
// レート更新
// ========================================
async function updateRate() {
  if (!state.selectedPairId) return;

  state.isLoadingRate = true;
  state.currentRate = null;
  render();

  const rate = await rateService.getRate(state.selectedPairId);

  state.isLoadingRate = false;
  state.currentRate = rate;
  render();
}

// ========================================
// 設定機能（復元版）
// ========================================
let accountSettingsUnsubscribe = null;

export function initAccountSettings(container) {
  // 既存の購読解除
  if (accountSettingsUnsubscribe) {
    accountSettingsUnsubscribe();
    accountSettingsUnsubscribe = null;
  }

  container.innerHTML = '';
  container.appendChild(createAccountSettingsSection());
  
  bindAccountSettings(container);
}

/**
 * 取引口座設定セクションを構築
 */
function createAccountSettingsSection() {
  return el('div', { className: 'account-settings-page lot-calculator' }, // スタイルスコープ共有のためlot-calculator付与
    el('h2', { className: 'calculator-title' }, '取引口座設定'),
    el('p', { style: { marginBottom: '20px', color: '#666' } },
      'FX・ゴールドのロットサイズ / pip設定を口座タイプに合わせて管理します。', el('br'),
      'ここで設定した値は記録フォームや分析でも自動的に使用されます。'
    ),
    el('div', { className: 'calculator-inputs' },
      el('div', { className: 'settings-grid' },
        // FX口座タイプ
        createSelectGroup('fx-preset', 'FX口座タイプ', [
          { value: 'fx-overseas', label: PRESET_LABELS['fx-overseas'] },
          { value: 'fx-domestic', label: PRESET_LABELS['fx-domestic'] },
          { value: 'fx-micro', label: PRESET_LABELS['fx-micro'] },
          { value: 'custom', label: 'カスタム設定' }
        ]),
        // ゴールド口座タイプ
        createSelectGroup('gold-preset', 'ゴールド口座タイプ', [
          { value: 'gold-standard', label: PRESET_LABELS['gold-standard'] },
          { value: 'gold-mini', label: PRESET_LABELS['gold-mini'] },
          { value: 'gold-micro', label: PRESET_LABELS['gold-micro'] },
          { value: 'custom', label: 'カスタム設定' }
        ]),
        // USD/JPY レート
        createInputGroup('usd-jpy-rate', 'USD/JPY 想定レート', 'number', { step: '0.1', min: '1' }, '米ドル建て資産の円換算に使用します'),
        // FXロットサイズ
        createInputGroup('fx-lot-size', 'FX 1ロットあたり通貨量', 'number', { min: '1', step: '1' }, '例: 100,000通貨（海外FX） / 10,000通貨（国内FX）'),
        // FX pipサイズ (JPY)
        createInputGroup('fx-pip-size-jpy', 'JPYペアのpip刻み', 'number', { min: '0.0001', step: '0.0001' }, '通常は 0.01（1銭）'),
        // FX pipサイズ (USD)
        createInputGroup('fx-pip-size-usd', 'USDペアのpip刻み', 'number', { min: '0.00001', step: '0.00001' }, '通常は 0.0001'),
        // ゴールド ロットサイズ
        createInputGroup('gold-lot-size', 'ゴールド 1ロットあたり重量（oz）', 'number', { min: '0.01', step: '0.01' }, '例: スタンダード100oz / ミニ10oz / マイクロ1oz'),
        // ゴールド pipサイズ
        createInputGroup('gold-pip-size', 'ゴールドのpip刻み（ドル）', 'number', { min: '0.0001', step: '0.0001' }, '例: 0.1（10セント）')
      ),
      el('div', { className: 'settings-summary', id: 'pip-summary', style: { marginTop: '20px', padding: '15px', background: '#f5f5f5', borderRadius: '8px' } }),
      el('div', { className: 'settings-actions', style: { marginTop: '20px', textAlign: 'right' } },
        el('button', { type: 'button', id: 'reset-account-settings', className: 'btn-secondary', style: { padding: '8px 16px' } }, 'デフォルトに戻す')
      )
    )
  );
}

function createSelectGroup(id, label, options) {
  return el('div', { className: 'input-group' },
    el('label', { for: id }, label),
    el('select', { id: id },
      ...options.map(opt => el('option', { value: opt.value }, opt.label))
    )
  );
}

function createInputGroup(id, label, type, attrs = {}, smallText = '') {
  return el('div', { className: 'input-group' },
    el('label', { for: id }, label),
    el('input', { type, id, ...attrs }),
    smallText ? el('small', { style: { display: 'block', marginTop: '4px', fontSize: '12px', color: '#888' } }, smallText) : null
  );
}

function bindAccountSettings(root) {
  const numberInputsMap = {
    '#usd-jpy-rate': 'usdJpyRate',
    '#fx-lot-size': 'fxLotSize',
    '#fx-pip-size-jpy': 'fxPipSizeJpy',
    '#fx-pip-size-usd': 'fxPipSizeUsd',
    '#gold-lot-size': 'goldLotSize',
    '#gold-pip-size': 'goldPipSize',
  };

  const query = (selector) => root.querySelector(selector);

  query('#fx-preset')?.addEventListener('change', (e) => {
    const value = e.target.value;
    if (value === 'custom') {
      updateSettings({ presetFx: 'custom' });
    } else {
      applyPreset(value);
    }
    refreshAccountSettingsView(root);
  });

  query('#gold-preset')?.addEventListener('change', (e) => {
    const value = e.target.value;
    if (value === 'custom') {
      updateSettings({ presetGold: 'custom' });
    } else {
      applyPreset(value);
    }
    refreshAccountSettingsView(root);
  });

  Object.entries(numberInputsMap).forEach(([selector, key]) => {
    const input = query(selector);
    if (!input) return;
    input.addEventListener('change', () => {
      const value = parseFloat(input.value);
      updateSettings({ [key]: value });
      refreshAccountSettingsView(root);
    });
  });

  query('#reset-account-settings')?.addEventListener('click', () => {
    if (confirm('設定をデフォルトに戻しますか？')) {
      resetSettings();
      refreshAccountSettingsView(root);
    }
  });

  refreshAccountSettingsView(root);
  accountSettingsUnsubscribe = onSettingsChange(() => refreshAccountSettingsView(root));
}

function refreshAccountSettingsView(root) {
  const { settings, fxJpy, fxUsd, gold } = getDerivedSettings();
  const query = (selector) => root.querySelector(selector);

  const fxPreset = query('#fx-preset');
  const goldPreset = query('#gold-preset');
  const usdJpyRate = query('#usd-jpy-rate');
  const fxLotSize = query('#fx-lot-size');
  const fxPipSizeJpy = query('#fx-pip-size-jpy');
  const fxPipSizeUsd = query('#fx-pip-size-usd');
  const goldLotSize = query('#gold-lot-size');
  const goldPipSize = query('#gold-pip-size');
  const pipSummary = query('#pip-summary');

  if (fxPreset) fxPreset.value = settings.presetFx || 'custom';
  if (goldPreset) goldPreset.value = settings.presetGold || 'custom';
  if (usdJpyRate) usdJpyRate.value = settings.usdJpyRate;
  if (fxLotSize) fxLotSize.value = settings.fxLotSize;
  if (fxPipSizeJpy) fxPipSizeJpy.value = settings.fxPipSizeJpy;
  if (fxPipSizeUsd) fxPipSizeUsd.value = settings.fxPipSizeUsd;
  if (goldLotSize) goldLotSize.value = settings.goldLotSize;
  if (goldPipSize) goldPipSize.value = settings.goldPipSize;

  if (pipSummary) {
    pipSummary.innerHTML = '';
    pipSummary.appendChild(el('strong', {}, '現在の設定サマリー'));
    pipSummary.appendChild(el('ul', { style: { paddingLeft: '20px', marginTop: '10px' } },
      el('li', {}, `FX（JPYペア）: 1pips ≒ ${Math.round(fxJpy.pipValuePerLot).toLocaleString()}円 / ロット（計算倍率 ${fxJpy.pipMultiplier.toFixed(0)}）`),
      el('li', {}, `FX（USDペア）: 1pips ≒ ${Math.round(fxUsd.pipValuePerLot).toLocaleString()}円 / ロット（計算倍率 ${fxUsd.pipMultiplier.toFixed(0)}）`),
      el('li', {}, `GOLD: 1pips ≒ ${Math.round(gold.pipValuePerLot).toLocaleString()}円 / ロット（計算倍率 ${gold.pipMultiplier.toFixed(0)}）`)
    ));
  }
}
