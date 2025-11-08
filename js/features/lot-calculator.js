import { getDerivedSettings, getSettings, updateSettings, applyPreset, resetSettings, PRESET_LABELS } from '../core/settings.js';

const ACCOUNT_SETTINGS_SECTION = `
  <section class="account-settings-card">
    <h2>取引口座設定</h2>
    <p class="description">
      FX・ゴールドのロットサイズ / pip設定を口座タイプに合わせて管理します。<br>
      ここで設定した値は記録フォームや分析でも自動的に使用されます。
    </p>

    <div class="settings-grid">
      <div class="form-group">
        <label for="fx-preset">FX口座タイプ</label>
        <select id="fx-preset">
          <option value="fx-overseas">${PRESET_LABELS['fx-overseas']}</option>
          <option value="fx-domestic">${PRESET_LABELS['fx-domestic']}</option>
          <option value="fx-micro">${PRESET_LABELS['fx-micro']}</option>
          <option value="custom">カスタム設定</option>
        </select>
      </div>

      <div class="form-group">
        <label for="gold-preset">ゴールド口座タイプ</label>
        <select id="gold-preset">
          <option value="gold-standard">${PRESET_LABELS['gold-standard']}</option>
          <option value="gold-mini">${PRESET_LABELS['gold-mini']}</option>
          <option value="gold-micro">${PRESET_LABELS['gold-micro']}</option>
          <option value="custom">カスタム設定</option>
        </select>
      </div>

      <div class="form-group">
        <label for="usd-jpy-rate">USD/JPY 想定レート</label>
        <input type="number" id="usd-jpy-rate" step="0.1" min="1" />
        <small>米ドル建て資産の円換算に使用します</small>
      </div>

      <div class="form-group">
        <label for="fx-lot-size">FX 1ロットあたり通貨量</label>
        <input type="number" id="fx-lot-size" min="1" step="1" />
        <small>例: 100,000通貨（海外FX） / 10,000通貨（国内FX）</small>
      </div>

      <div class="form-group">
        <label for="fx-pip-size-jpy">JPYペアのpip刻み</label>
        <input type="number" id="fx-pip-size-jpy" min="0.0001" step="0.0001" />
        <small>通常は 0.01（1銭）</small>
      </div>

      <div class="form-group">
        <label for="fx-pip-size-usd">USDペアのpip刻み</label>
        <input type="number" id="fx-pip-size-usd" min="0.00001" step="0.00001" />
        <small>通常は 0.0001</small>
      </div>

      <div class="form-group">
        <label for="gold-lot-size">ゴールド 1ロットあたり重量（oz）</label>
        <input type="number" id="gold-lot-size" min="0.01" step="0.01" />
        <small>例: スタンダード100oz / ミニ10oz / マイクロ1oz</small>
      </div>

      <div class="form-group">
        <label for="gold-pip-size">ゴールドのpip刻み（ドル）</label>
        <input type="number" id="gold-pip-size" min="0.0001" step="0.0001" />
        <small>例: 0.1（10セント）</small>
      </div>
    </div>

    <div class="settings-summary" id="pip-summary"></div>

    <div class="settings-actions">
      <button type="button" id="reset-account-settings" class="btn-secondary">デフォルトに戻す</button>
    </div>
  </section>
`;

const LOT_CALCULATOR_SECTION = `
  <section class="lot-calculator-container">
    <h2>ロット計算ツール</h2>
    <p class="description">2%ルールに基づいて適切なロットサイズを計算します</p>

    <div class="calculator-card">
      <div class="form-group">
        <label>口座残高（円）</label>
        <input type="number" id="account-balance" value="1000000" />
      </div>

      <div class="form-group">
        <label>リスク許容率（%）</label>
        <input type="number" id="risk-percentage" value="2" step="0.1" />
      </div>

      <div class="form-group">
        <label>損切り幅（pips）</label>
        <input type="number" id="stop-loss-pips" value="50" />
      </div>

      <div class="form-group">
        <label style="font-size: 16px; font-weight: 600; margin-bottom: 12px; display: block;">
          口座タイプを参考にする
        </label>
        
        <div class="account-type-selector" style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px;">
          <label class="account-type-option" data-preset="fx-overseas" style="display: flex; align-items: center; padding: 12px; border: 2px solid var(--color-border); border-radius: var(--radius-md); cursor: pointer; transition: all 0.2s;">
            <input type="radio" name="account-type" value="fx-overseas" style="margin-right: 12px; width: 20px; height: 20px;" />
            <div>
              <div style="font-weight: 600; font-size: 14px;">海外FX（XM・Exness・FXGTなど）</div>
              <div style="font-size: 12px; color: var(--color-text-secondary);">1ロット = 100,000通貨 → 1pipsあたり 約1,000円</div>
            </div>
          </label>
          
          <label class="account-type-option" data-preset="fx-domestic" style="display: flex; align-items: center; padding: 12px; border: 2px solid var(--color-border); border-radius: var(--radius-md); cursor: pointer; transition: all 0.2s;">
            <input type="radio" name="account-type" value="fx-domestic" style="margin-right: 12px; width: 20px; height: 20px;" />
            <div>
              <div style="font-weight: 600; font-size: 14px;">国内FX（SBI・GMO・楽天など）</div>
              <div style="font-size: 12px; color: var(--color-text-secondary);">1ロット = 10,000通貨 → 1pipsあたり 約100円</div>
            </div>
          </label>
          
          <label class="account-type-option" data-preset="fx-micro" style="display: flex; align-items: center; padding: 12px; border: 2px solid var(--color-border); border-radius: var(--radius-md); cursor: pointer; transition: all 0.2s;">
            <input type="radio" name="account-type" value="fx-micro" style="margin-right: 12px; width: 20px; height: 20px;" />
            <div>
              <div style="font-weight: 600; font-size: 14px;">マイクロ口座</div>
              <div style="font-size: 12px; color: var(--color-text-secondary);">1ロット = 1,000通貨 → 1pipsあたり 約10円</div>
            </div>
          </label>
          
          <label class="account-type-option" data-preset="custom" style="display: flex; align-items: center; padding: 12px; border: 2px solid var(--color-border); border-radius: var(--radius-md); cursor:pointer; transition: all 0.2s;">
            <input type="radio" name="account-type" value="custom" style="margin-right: 12px; width: 20px; height: 20px;" />
            <div>
              <div style="font-weight: 600; font-size: 14px;">その他・手動設定</div>
              <div style="font-size: 12px; color: var(--color-text-secondary);">自分で入力したい場合</div>
            </div>
          </label>
        </div>
        
        <div id="current-setting" style="display: none; padding: 12px; background: var(--color-bg-1); border-radius: var(--radius-md); margin-bottom: 16px;">
          <div style="font-size: 13px; font-weight: 600; margin-bottom: 8px;">✅ 自動設定値</div>
          <div style="font-size: 12px; line-height: 1.6;">
            <div>• 1ロット = <span id="lot-size-display">-</span></div>
            <div>• 1pipsあたりの価値 = <span id="pip-value-display">-</span></div>
          </div>
        </div>
        
        <div id="manual-input" style="display: none;">
          <label style="font-size: 13px; font-weight: 500; margin-bottom: 8px; display: block;">
            1pipsあたりの価値（円）
          </label>
          <input type="number" id="pip-value" value="1000" step="1" min="1" />
        </div>
      </div>

      <button id="calculate-btn" class="btn-primary">計算する</button>

      <div id="calculation-result" class="calculation-result" style="display: none;">
        <h3>計算結果</h3>
        <div class="result-grid">
          <div class="result-item">
            <div class="result-label">許容リスク額</div>
            <div class="result-value" id="risk-amount">-</div>
          </div>
          <div class="result-item">
            <div class="result-label">推奨ロットサイズ</div>
            <div class="result-value highlight" id="recommended-lot">-</div>
          </div>
          <div class="result-item">
            <div class="result-label">損切り時の損失</div>
            <div class="result-value" id="loss-amount">-</div>
          </div>
        </div>
      </div>
    </div>
  </section>
`;

function renderPage({ includeAccountSettings, includeCalculator }) {
  const sections = [];
  if (includeAccountSettings) sections.push(ACCOUNT_SETTINGS_SECTION);
  if (includeCalculator) sections.push(LOT_CALCULATOR_SECTION);
  return `<div class="settings-page">${sections.join('')}</div>`;
}

function query(root, selector) {
  return root.querySelector(selector);
}

function queryAll(root, selector) {
  return Array.from(root.querySelectorAll(selector));
}

function refreshAccountSettingsView(root) {
  const { settings, fxJpy, fxUsd, gold } = getDerivedSettings();
  const fxPreset = query(root, '#fx-preset');
  const goldPreset = query(root, '#gold-preset');
  const usdJpyRate = query(root, '#usd-jpy-rate');
  const fxLotSize = query(root, '#fx-lot-size');
  const fxPipSizeJpy = query(root, '#fx-pip-size-jpy');
  const fxPipSizeUsd = query(root, '#fx-pip-size-usd');
  const goldLotSize = query(root, '#gold-lot-size');
  const goldPipSize = query(root, '#gold-pip-size');
  const pipSummary = query(root, '#pip-summary');
  const pipValueInput = query(root, '#pip-value');
  const lotSizeDisplay = query(root, '#lot-size-display');
  const pipValueDisplay = query(root, '#pip-value-display');

  if (fxPreset) fxPreset.value = settings.presetFx || 'custom';
  if (goldPreset) goldPreset.value = settings.presetGold || 'custom';
  if (usdJpyRate) usdJpyRate.value = settings.usdJpyRate;
  if (fxLotSize) fxLotSize.value = settings.fxLotSize;
  if (fxPipSizeJpy) fxPipSizeJpy.value = settings.fxPipSizeJpy;
  if (fxPipSizeUsd) fxPipSizeUsd.value = settings.fxPipSizeUsd;
  if (goldLotSize) goldLotSize.value = settings.goldLotSize;
  if (goldPipSize) goldPipSize.value = settings.goldPipSize;

  if (pipSummary) {
    pipSummary.innerHTML = `
      <strong>現在の設定サマリー</strong>
      <ul>
        <li>FX（JPYペア）: 1pips ≒ ${Math.round(fxJpy.pipValuePerLot).toLocaleString()}円 / ロット（計算倍率 ${fxJpy.pipMultiplier.toFixed(0)}）</li>
        <li>FX（USDペア）: 1pips ≒ ${Math.round(fxUsd.pipValuePerLot).toLocaleString()}円 / ロット（計算倍率 ${fxUsd.pipMultiplier.toFixed(0)}）</li>
        <li>GOLD: 1pips ≒ ${Math.round(gold.pipValuePerLot).toLocaleString()}円 / ロット（計算倍率 ${gold.pipMultiplier.toFixed(0)}）</li>
      </ul>
    `;
  }

  if (pipValueInput && pipValueInput.dataset.manual !== 'true') {
    pipValueInput.value = Math.round(fxJpy.pipValuePerLot);
  }

  if (lotSizeDisplay) lotSizeDisplay.textContent = Math.round(settings.fxLotSize).toLocaleString() + '通貨';
  if (pipValueDisplay) pipValueDisplay.textContent = Math.round(fxJpy.pipValuePerLot).toLocaleString() + '円';
}

function highlightSelectedAccountType(root, preset) {
  queryAll(root, '.account-type-option').forEach(option => {
    option.style.borderColor = 'var(--color-border)';
    option.style.background = 'transparent';
    const input = option.querySelector('input[type="radio"]');
    if (input) input.checked = false;
  });

  if (!preset) return;
  queryAll(root, `.account-type-option[data-preset="${preset}"]`).forEach(option => {
    option.style.borderColor = 'var(--color-primary)';
    option.style.background = 'rgba(var(--color-teal-500-rgb), 0.05)';
    const input = option.querySelector('input[type="radio"]');
    if (input) input.checked = true;
  });
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

  query(root, '#fx-preset')?.addEventListener('change', (e) => {
    const value = e.target.value;
    if (value === 'custom') {
      updateSettings({ presetFx: 'custom' });
    } else {
      applyPreset(value);
    }
    refreshAccountSettingsView(root);
  });

  query(root, '#gold-preset')?.addEventListener('change', (e) => {
    const value = e.target.value;
    if (value === 'custom') {
      updateSettings({ presetGold: 'custom' });
    } else {
      applyPreset(value);
    }
    refreshAccountSettingsView(root);
  });

  Object.entries(numberInputsMap).forEach(([selector, key]) => {
    const input = query(root, selector);
    if (!input) return;
    input.addEventListener('change', () => {
      const value = parseFloat(input.value);
      updateSettings({ [key]: value });
      refreshAccountSettingsView(root);
    });
  });

  query(root, '#reset-account-settings')?.addEventListener('click', () => {
    if (confirm('設定をデフォルトに戻しますか？')) {
      resetSettings();
      refreshAccountSettingsView(root);
    }
  });

  refreshAccountSettingsView(root);
}

function bindLotCalculator(root) {
  const pipValueInput = query(root, '#pip-value');
  const currentSetting = query(root, '#current-setting');
  const manualInput = query(root, '#manual-input');

  if (pipValueInput) {
    pipValueInput.addEventListener('input', () => {
      pipValueInput.dataset.manual = 'true';
    });
  }

  queryAll(root, 'input[name="account-type"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const value = e.target.value;
      highlightSelectedAccountType(root, value);

      if (!currentSetting || !manualInput || !pipValueInput) return;

      if (value === 'custom') {
        currentSetting.style.display = 'none';
        manualInput.style.display = 'block';
        pipValueInput.dataset.manual = 'true';
      } else {
        applyPreset(value);
        pipValueInput.dataset.manual = 'false';
        refreshAccountSettingsView(root);
        currentSetting.style.display = 'block';
        manualInput.style.display = 'none';
      }
    });
  });

  query(root, '#calculate-btn')?.addEventListener('click', () => calculateLot(root));

  refreshAccountSettingsView(root);
  highlightSelectedAccountType(root, getSettings().presetFx);
}

function calculateLot(root) {
  const balance = parseFloat(query(root, '#account-balance')?.value || '');
  const riskPct = parseFloat(query(root, '#risk-percentage')?.value || '');
  const stopLossPips = parseFloat(query(root, '#stop-loss-pips')?.value || '');
  const pipValue = parseFloat(query(root, '#pip-value')?.value || '');

  if (!balance || !riskPct || !stopLossPips || !pipValue) {
    alert('すべての項目を入力してください');
    return;
  }

  const riskAmount = balance * (riskPct / 100);
  const recommendedLot = riskAmount / (stopLossPips * pipValue);
  const lossAmount = recommendedLot * stopLossPips * pipValue;

  const riskAmountEl = query(root, '#risk-amount');
  const recommendedLotEl = query(root, '#recommended-lot');
  const lossAmountEl = query(root, '#loss-amount');
  const resultContainer = query(root, '#calculation-result');

  if (riskAmountEl) riskAmountEl.textContent = `${Math.round(riskAmount).toLocaleString()}円`;
  if (recommendedLotEl) recommendedLotEl.textContent = `${recommendedLot.toFixed(2)} ロット`;
  if (lossAmountEl) lossAmountEl.textContent = `${Math.round(lossAmount).toLocaleString()}円`;
  if (resultContainer) resultContainer.style.display = 'block';
}

function initLotModules(container, { includeAccountSettings, includeCalculator }) {
  container.innerHTML = renderPage({ includeAccountSettings, includeCalculator });
  const root = container;
  if (includeAccountSettings) bindAccountSettings(root);
  if (includeCalculator) bindLotCalculator(root);
}

export function initAccountSettings(container) {
  initLotModules(container, { includeAccountSettings: true, includeCalculator: false });
}

export function initLotCalculator(container) {
  initLotModules(container, { includeAccountSettings: false, includeCalculator: true });
}
