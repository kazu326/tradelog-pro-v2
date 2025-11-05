/**
 * ロット計算ツール
 */

export function initLotCalculator(container) {
  container.innerHTML = `
    <div class="lot-calculator-container">
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
            あなたの口座タイプを選んでください
          </label>
          
          <!-- ラジオボタン選択 -->
          <div class="account-type-selector" style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px;">
            <label class="account-type-option" style="display: flex; align-items: center; padding: 12px; border: 2px solid var(--color-border); border-radius: var(--radius-md); cursor: pointer; transition: all 0.2s;">
              <input type="radio" name="account-type" value="100000" style="margin-right: 12px; width: 20px; height: 20px;" />
              <div>
                <div style="font-weight: 600; font-size: 14px;">海外FX（XM・Exness・FXGTなど）</div>
                <div style="font-size: 12px; color: var(--color-text-secondary);">1ロット = 100,000通貨 → 1pipsあたり 1000円</div>
              </div>
            </label>
            
            <label class="account-type-option" style="display: flex; align-items: center; padding: 12px; border: 2px solid var(--color-border); border-radius: var(--radius-md); cursor: pointer; transition: all 0.2s;">
              <input type="radio" name="account-type" value="10000" style="margin-right: 12px; width: 20px; height: 20px;" />
              <div>
                <div style="font-weight: 600; font-size: 14px;">国内FX（SBI・GMO・楽天など）</div>
                <div style="font-size: 12px; color: var(--color-text-secondary);">1ロット = 10,000通貨 → 1pipsあたり 100円</div>
              </div>
            </label>
            
            <label class="account-type-option" style="display: flex; align-items: center; padding: 12px; border: 2px solid var(--color-border); border-radius: var(--radius-md); cursor: pointer; transition: all 0.2s;">
              <input type="radio" name="account-type" value="1000" style="margin-right: 12px; width: 20px; height: 20px;" />
              <div>
                <div style="font-weight: 600; font-size: 14px;">マイクロ口座</div>
                <div style="font-size: 12px; color: var(--color-text-secondary);">1ロット = 1,000通貨 → 1pipsあたり 10円</div>
              </div>
            </label>
            
            <label class="account-type-option" style="display: flex; align-items: center; padding: 12px; border: 2px solid var(--color-border); border-radius: var(--radius-md); cursor: pointer; transition: all 0.2s;">
              <input type="radio" name="account-type" value="custom" style="margin-right: 12px; width: 20px; height: 20px;" />
              <div>
                <div style="font-weight: 600; font-size: 14px;">その他・手動設定</div>
                <div style="font-size: 12px; color: var(--color-text-secondary);">自分で入力したい場合</div>
              </div>
            </label>
          </div>
          
          <!-- 現在の設定表示 -->
          <div id="current-setting" style="display: none; padding: 12px; background: var(--color-bg-1); border-radius: var(--radius-md); margin-bottom: 16px;">
            <div style="font-size: 13px; font-weight: 600; margin-bottom: 8px;">✅ 自動設定されました：</div>
            <div style="font-size: 12px; line-height: 1.6;">
              <div>• 1ロット = <span id="lot-size-display">-</span></div>
              <div>• 1pipsあたりの価値 = <span id="pip-value-display">-</span></div>
              <div style="margin-top: 8px; color: var(--color-text-secondary);">
                💡 これで「1ロットで1pips動くと<span id="pip-value-display-2">-</span>の損益」になります
              </div>
            </div>
          </div>
          
          <!-- 手動入力欄 -->
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
    </div>
  `;

  document.getElementById('calculate-btn').addEventListener('click', calculateLot);

  // 口座タイプ選択のイベントリスナー
  document.querySelectorAll('input[name="account-type"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const value = e.target.value;
      const currentSetting = document.getElementById('current-setting');
      const manualInput = document.getElementById('manual-input');
      const pipValueInput = document.getElementById('pip-value');
      
      // 選択されたオプションをハイライト
      document.querySelectorAll('.account-type-option').forEach(option => {
        option.style.borderColor = 'var(--color-border)';
        option.style.background = 'transparent';
      });
      e.target.closest('.account-type-option').style.borderColor = 'var(--color-primary)';
      e.target.closest('.account-type-option').style.background = 'rgba(var(--color-teal-500-rgb), 0.05)';
      
      if (value === 'custom') {
        currentSetting.style.display = 'none';
        manualInput.style.display = 'block';
      } else {
        const pipValue = parseInt(value, 10) / 100;
        if (pipValueInput) {
          pipValueInput.value = pipValue;
        }
        
        // 設定表示を更新
        const lotSizeDisplay = document.getElementById('lot-size-display');
        const pipValueDisplay = document.getElementById('pip-value-display');
        const pipValueDisplay2 = document.getElementById('pip-value-display-2');
        if (lotSizeDisplay) lotSizeDisplay.textContent = parseInt(value, 10).toLocaleString() + '通貨';
        if (pipValueDisplay) pipValueDisplay.textContent = pipValue + '円';
        if (pipValueDisplay2) pipValueDisplay2.textContent = pipValue + '円';
        
        currentSetting.style.display = 'block';
        manualInput.style.display = 'none';
      }
    });
  });
}

function calculateLot() {
  const balance = parseFloat(document.getElementById('account-balance').value);
  const riskPct = parseFloat(document.getElementById('risk-percentage').value);
  const stopLossPips = parseFloat(document.getElementById('stop-loss-pips').value);
  const pipValue = parseFloat(document.getElementById('pip-value').value);

  // バリデーション
  if (!balance || !riskPct || !stopLossPips || !pipValue) {
    alert('すべての項目を入力してください');
    return;
  }

  // 計算
  const riskAmount = balance * (riskPct / 100);
  const recommendedLot = riskAmount / (stopLossPips * pipValue);
  const lossAmount = recommendedLot * stopLossPips * pipValue;

  // 結果表示
  document.getElementById('risk-amount').textContent = 
    riskAmount.toLocaleString() + '円';
  document.getElementById('recommended-lot').textContent = 
    recommendedLot.toFixed(2) + ' ロット';
  document.getElementById('loss-amount').textContent = 
    lossAmount.toLocaleString() + '円';

  document.getElementById('calculation-result').style.display = 'block';
}
