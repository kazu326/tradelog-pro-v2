/**
 * トレード記録機能
 */
import { saveTrade, getTrades, deleteTrade, updateTrade } from '../core/storage.js';
import { calculateStats } from '../core/analytics.js';
import { showToast } from '../ui/toast.js';
import { getDerivedSettings, onSettingsChange } from '../core/settings.js';
import { normalizePairSymbol as normalizePair } from '../core/types.js';
import { addProgress, refreshProgressUI } from '../core/progression.js';
import { el } from '../utils/dom.js';

let allTrades = [];
let displayedTrades = [];
let currentOffset = 0;
const LIMIT_PER_PAGE = 20;

let derivedSettings = getDerivedSettings();
let usdRateInputManual = false;

// フィールド定義とバリデーションルール
const FIELD_DEFINITIONS = {
  pair: {
    label: '通貨ペア',
    required: true,
    guide: '取引した通貨ペアを選択してください。',
    validate: (val) => !val ? '通貨ペアを選択してください' : null
  },
  direction: {
    label: '方向',
    required: true,
    guide: '買い(Long)か売り(Short)かを選択します。',
    validate: (val) => !['買い', '売り'].includes(val) ? '方向を選択してください' : null
  },
  lot_size: {
    label: 'ロットサイズ',
    required: true,
    guide: '取引量です（例: 1.0 = 10万通貨）。',
    validate: (val) => val <= 0 ? '0より大きい値を入力してください' : (val > 100 ? 'ロット数が大きすぎます（確認してください）' : null)
  },
  entry_price: {
    label: 'エントリー価格',
    required: true,
    guide: 'ポジションを持った価格です。',
    validate: (val) => val <= 0 ? '0より大きい価格を入力してください' : null
  },
  exit_price: {
    label: '決済価格',
    required: true,
    guide: 'ポジションを決済した価格です。',
    validate: (val) => val <= 0 ? '0より大きい価格を入力してください' : null
  },
  created_at: {
    label: '取引日',
    required: false,
    guide: '実際に取引を行った日付です。',
    validate: null
  }
};

/**
 * トレード記録タブを初期化
 */
export async function initTradeRecord(container) {
  container.innerHTML = ''; // コンテナをクリア

  const title = el('h2', {}, 'トレード記録');

  // 統計サマリー
  const statsSummary = el('div', { className: 'stats-summary' },
    createStatCard('合計トレード', '0', 'total-trades'),
    createStatCard('勝率', '0%', 'win-rate'),
    createStatCard('合計損益', '0円', 'total-pnl'),
    createStatCard('プロフィットファクター', '0.00', 'profit-factor')
  );

  // トレード記録フォーム
  const tradeForm = createTradeForm('new');
  
  const tradeFormContainer = el('div', { className: 'trade-form-container' },
    el('h3', {}, '新規トレード記録'),
    tradeForm
  );

  const tradesList = el('div', { id: 'trades-list', className: 'trades-list' }, '読み込み中...');
  const loadMoreBtn = el('button', { 
    id: 'load-more-btn', 
    className: 'btn-secondary', 
    style: { width: '100%', marginTop: '16px', display: 'none' },
    onClick: handleLoadMore
  }, 'もっと見る');

  const tradesListContainer = el('div', { className: 'trades-list-container' },
    el('h3', {}, 'トレード履歴'),
    tradesList,
    loadMoreBtn
  );

  const wrapper = el('div', { className: 'trade-record-container' },
    title,
    statsSummary,
    tradeFormContainer,
    tradesListContainer
  );
  
  container.appendChild(wrapper);

  // 設定変更の購読（ロット/ピップ計算に反映）
  onSettingsChange((_, nextDerived) => {
    derivedSettings = nextDerived;
    if (!usdRateInputManual) {
      applyDefaultUsdJpyRate();
    }
    // 新規フォームの再計算
    calculateTradeValues('new'); 
  });

  // 初期化処理
  setupRateHelpers();

  // トレード一覧を読み込み
  await loadTrades();
}

/**
 * JSTでの現在時刻ISO文字列を取得 (+09:00オフセット付き)
 */
function getJstNowISO() {
  // ローカル時間を取得し、日本時間として扱う
  // 単純に new Date() だと環境依存なので、明示的に日本時間オフセットを加算して生成
  const now = new Date();
  
  // JSTオフセット (ミリ秒)
  const JST_OFFSET = 9 * 60 * 60 * 1000;
  
  // UTC時刻を取得し、JST分(9時間)進める
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const jstTime = new Date(utc + JST_OFFSET);
  
  // YYYY-MM-DDTHH:mm:ss.sss
  const iso = jstTime.toISOString().slice(0, 23);
  
  // タイムゾーン識別子を付与
  return `${iso}+09:00`;
}

/**
 * ISO文字列からJSTでの日付文字列(YYYY-MM-DD)を取得
 */
function getJstDateString(isoString) {
  if (!isoString) return '';
  try {
    // Dateオブジェクトに変換
    const d = new Date(isoString);
    
    // Intl.DateTimeFormatでJSTとしてフォーマット
    // formatToPartsを使って確実にYYYY, MM, DDを取得
    const parts = new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(d);
    
    const year = parts.find(p => p.type === 'year').value;
    const month = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;
    
    return `${year}-${month}-${day}`;
  } catch (e) {
    console.error('Date parse error:', e);
    return '';
  }
}

/**
 * フォームフィールドラッパー生成（ガイド・エラー表示付き）
 */
function createFieldWrapper(fieldKey, inputElement, mode = 'new') {
  const def = FIELD_DEFINITIONS[fieldKey];
  const suffix = mode === 'edit' ? '_edit' : '';
  const errorId = `${fieldKey}-error${suffix}`;
  
  return el('div', { className: 'form-group' },
    el('label', {}, 
      def?.label || fieldKey, 
      def?.required ? el('span', { className: 'required' }, '*') : null,
      // ガイドアイコン（ツールチップ）
      def?.guide ? el('span', { 
        className: 'info-icon', 
        title: def.guide,
        style: { marginLeft: '6px', cursor: 'help', fontSize: '12px', color: 'var(--color-text-secondary)' } 
      }, 'ⓘ') : null
    ),
    inputElement,
    // ガイドテキスト（フォーカス時に表示などが理想だが今回は常時またはバリデーションエラー表示用）
    el('div', { 
      id: errorId, 
      className: 'validation-error', 
      style: { color: 'var(--color-error)', fontSize: '11px', minHeight: '1.2em', marginTop: '2px' } 
    }, '')
  );
}

/**
 * バリデーション実行
 */
function validateField(fieldKey, value, mode) {
  const def = FIELD_DEFINITIONS[fieldKey];
  if (!def || !def.validate) return true;
  
  const suffix = mode === 'edit' ? '_edit' : '';
  const errorEl = document.getElementById(`${fieldKey}-error${suffix}`);
  const msg = def.validate(value);
  
  if (errorEl) {
    errorEl.textContent = msg || '';
  }
  return !msg;
}

/**
 * トレードフォームを作成するヘルパー関数
 * @param {string} mode - 'new' or 'edit'
 * @param {Object} initialData - 編集時の初期データ
 * @param {Function} onSubmit - 送信ハンドラ
 * @param {Function} onCancel - キャンセルハンドラ（編集時のみ）
 */
function createTradeForm(mode, initialData = null, onSubmit = handleTradeSubmit, onCancel = null) {
  const isEdit = mode === 'edit';
  const suffix = isEdit ? '_edit' : ''; // IDの重複を防ぐためのサフィックス

  const getValue = (key) => initialData ? initialData[key] : '';
  
  // 日付の初期値調整 (JSTで解釈)
  let dateValue = '';
  if (isEdit && initialData?.created_at) {
    dateValue = getJstDateString(initialData.created_at);
  } else if (mode === 'new') {
    // 新規時もデフォルトで今日(JST)を入れる
    dateValue = getJstDateString(getJstNowISO());
  }

  const handleInput = (key, e) => {
    if (key !== 'notes') validateField(key, e.target.value, mode);
    calculateTradeValues(mode);
  };

  const form = el('form', { 
    id: `trade-form${suffix}`, 
    className: 'trade-form', 
    onSubmit: onSubmit,
    // 元の時間情報を保持するための隠しフィールド
    dataset: { 
      originalCreatedAt: isEdit ? initialData?.created_at : '' 
    }
  },
    el('div', { className: 'form-row' },
      createFieldWrapper('pair', 
        el('select', { 
          name: 'pair', 
          id: `pair-select${suffix}`, 
          required: true, 
          onChange: (e) => handleInput('pair', e),
          value: getValue('pair')
        },
          el('option', { value: '' }, '選択してください'),
          el('option', { value: 'USD/JPY', selected: getValue('pair') === 'USD/JPY' }, 'USD/JPY'),
          el('option', { value: 'EUR/JPY', selected: getValue('pair') === 'EUR/JPY' }, 'EUR/JPY'),
          el('option', { value: 'GBP/JPY', selected: getValue('pair') === 'GBP/JPY' }, 'GBP/JPY'),
          el('option', { value: 'AUD/JPY', selected: getValue('pair') === 'AUD/JPY' }, 'AUD/JPY'),
          el('option', { value: 'EUR/USD', selected: getValue('pair') === 'EUR/USD' }, 'EUR/USD'),
          el('option', { value: 'GBP/USD', selected: getValue('pair') === 'GBP/USD' }, 'GBP/USD'),
          el('option', { value: 'XAU/USD', selected: getValue('pair') === 'XAU/USD' }, 'XAU/USD（GOLD）'),
          el('option', { value: 'GOLD/USD', selected: getValue('pair') === 'GOLD/USD' }, 'GOLD/USD'),
          el('option', { value: 'XAUUSD', selected: getValue('pair') === 'XAUUSD' }, 'XAUUSD')
        ), mode
      ),
      createFieldWrapper('direction',
        el('div', { className: 'form-group-inner' },
          el('div', { className: 'direction-buttons' },
            el('button', { 
              type: 'button', 
              className: `direction-btn ${getValue('direction') === '買い' ? 'active' : ''}`, 
              dataset: { direction: '買い' }, 
              onClick: (e) => handleDirectionClick(e, mode) 
            }, '📈 買い'),
            el('button', { 
              type: 'button', 
              className: `direction-btn ${getValue('direction') === '売り' ? 'active' : ''}`, 
              dataset: { direction: '売り' }, 
              onClick: (e) => handleDirectionClick(e, mode) 
            }, '📉 売り')
          ),
          el('input', { 
            type: 'hidden', 
            name: 'direction', 
            id: `direction-input${suffix}`, 
            required: true,
            value: getValue('direction')
          })
        ), mode
      ),
      createFieldWrapper('lot_size',
        el('div', { className: 'input-with-quick' },
          el('input', { 
            type: 'number', 
            name: 'lot_size', 
            id: `lot-size${suffix}`, 
            step: '0.01', 
            required: true, 
            onInput: (e) => handleInput('lot_size', e),
            value: getValue('lot_size')
          }),
          el('div', { className: 'quick-buttons' },
            el('button', { type: 'button', className: 'quick-btn', dataset: { value: '0.1' }, onClick: (e) => handleQuickLotClick(e, mode) }, '0.1'),
            el('button', { type: 'button', className: 'quick-btn', dataset: { value: '1' }, onClick: (e) => handleQuickLotClick(e, mode) }, '1.0'),
            el('button', { type: 'button', className: 'quick-btn', dataset: { value: '5' }, onClick: (e) => handleQuickLotClick(e, mode) }, '5.0')
          )
        ), mode
      )
    ),
    el('div', { className: 'form-row' },
      createFieldWrapper('created_at',
        el('div', {}, 
          el('input', { 
            type: 'date', 
            id: `trade-date-input${suffix}`,
            name: 'created_at', 
            value: dateValue
          }),
          el('small', { className: 'help-text', style: { display: 'block', marginTop: '4px' } }, 'レート取得時に使用します')
        ), mode
      ),
      el('div', { className: 'form-group' },
        el('label', {}, 'USD/JPY レート'),
        el('div', { className: 'input-with-action' },
          el('input', { 
            type: 'number', 
            id: `usd-jpy-rate-input${suffix}`, 
            step: '0.0001', 
            min: '1', 
            onInput: () => { 
              if (!isEdit) usdRateInputManual = true; 
              calculateTradeValues(mode); 
            } 
          }),
          el('button', { 
            type: 'button', 
            id: `fetch-usdjpy-rate-btn${suffix}`, 
            className: 'btn-secondary', 
            onClick: (e) => handleFetchRate(e, mode) 
          }, 'レート取得')
        ),
        el('small', { className: 'help-text' }, '指定日の終値を自動取得できます')
      )
    ),
    el('div', { className: 'form-row' },
      createFieldWrapper('entry_price',
        el('input', { 
          type: 'number', 
          name: 'entry_price', 
          id: `entry-price${suffix}`, 
          step: '0.001', 
          required: true, 
          onInput: (e) => handleInput('entry_price', e),
          value: getValue('entry_price')
        }), mode
      ),
      createFieldWrapper('exit_price',
        el('input', { 
          type: 'number', 
          name: 'exit_price', 
          id: `exit-price${suffix}`, 
          step: '0.001', 
          required: true, 
          onInput: (e) => handleInput('exit_price', e),
          value: getValue('exit_price')
        }), mode
      ),
      el('div', { className: 'form-group' },
        el('label', {}, 'Pips ', el('span', { className: 'auto-label' }, '自動計算')),
        el('input', { 
          type: 'number', 
          name: 'pips', 
          id: `pips${suffix}`, 
          step: '0.1', 
          readOnly: true, 
          style: { background: 'var(--color-secondary)' },
          value: getValue('pips')
        })
      )
    ),
    el('div', { className: 'form-row' },
      el('div', { className: 'form-group' },
        el('label', {}, '損益（円） ', el('span', { className: 'auto-label' }, '自動計算')),
        el('input', { 
          type: 'number', 
          name: 'pnl', 
          id: `pnl${suffix}`, 
          step: '0.01', 
          readOnly: true, 
          style: { background: 'var(--color-secondary)' },
          value: getValue('pnl')
        })
      ),
      el('div', { className: 'form-group' },
        el('label', {}, 'メモ'),
        el('textarea', { 
          name: 'notes', 
          rows: '2', 
          placeholder: 'トレードメモ（任意）',
          value: getValue('notes')
        })
      )
    ),
    el('div', { id: `calculation-preview${suffix}`, className: 'calculation-preview', style: { display: 'none' } },
      el('div', { className: 'preview-item' },
        el('span', { className: 'preview-label' }, 'Pips:'),
        el('span', { className: 'preview-value', id: `preview-pips${suffix}` }, '-')
      ),
      el('div', { className: 'preview-item' },
        el('span', { className: 'preview-label' }, '損益:'),
        el('span', { className: 'preview-value', id: `preview-pnl${suffix}` }, '-')
      ),
      el('div', { className: 'preview-item' },
        el('span', { className: 'preview-label' }, '勝率への影響:'),
        el('span', { className: 'preview-value', id: `preview-impact${suffix}` }, '-')
      )
    ),
    
    // 編集履歴表示（編集モードのみ）
    isEdit && initialData?.edit_history ? el('div', { className: 'edit-history-section', style: { marginTop: '16px', borderTop: '1px solid var(--color-border)', paddingTop: '8px' } },
      el('details', {},
        el('summary', { style: { cursor: 'pointer', fontSize: '12px', color: 'var(--color-text-secondary)' } }, `編集履歴 (${initialData.edit_history.length})`),
        el('ul', { style: { fontSize: '11px', color: 'var(--color-text-secondary)', paddingLeft: '20px', marginTop: '8px' } },
          initialData.edit_history.slice().reverse().map(h => {
            const updateTime = new Intl.DateTimeFormat('ja-JP', {
              timeZone: 'Asia/Tokyo',
              year: 'numeric', month: '2-digit', day: '2-digit',
              hour: '2-digit', minute: '2-digit', second: '2-digit'
            }).format(new Date(h.updatedAt));
            return el('li', {}, `${updateTime} - 更新`);
          })
        )
      )
    ) : null,

    el('div', { className: 'form-actions', style: { display: 'flex', gap: '10px', marginTop: '20px' } },
      el('button', { type: 'submit', className: 'btn-primary btn-submit', style: { flex: '1' } }, isEdit ? '💾 更新する' : '📝 記録する'),
      isEdit && onCancel ? el('button', { type: 'button', className: 'btn-secondary', onClick: onCancel, style: { flex: '1' } }, 'キャンセル') : null
    )
  );
  
  return form;
}

function createStatCard(label, value, id) {
  return el('div', { className: 'stat-card' },
    el('div', { className: 'stat-label' }, label),
    el('div', { className: 'stat-value', id: id }, value)
  );
}

function handleDirectionClick(e, mode = 'new') {
  const suffix = mode === 'edit' ? '_edit' : '';
  const container = mode === 'edit' ? document.getElementById('edit-modal') : document;
  
  container.querySelectorAll('.direction-btn').forEach(b => {
    b.classList.remove('active');
  });
  
  const target = e.currentTarget;
  target.classList.add('active');
  
  const directionInput = document.getElementById(`direction-input${suffix}`);
  if (directionInput) {
    directionInput.value = target.dataset.direction;
    validateField('direction', target.dataset.direction, mode);
    calculateTradeValues(mode);
  }
}

function handleQuickLotClick(e, mode = 'new') {
  const suffix = mode === 'edit' ? '_edit' : '';
  const value = e.currentTarget?.dataset?.value;
  const lotInput = document.getElementById(`lot-size${suffix}`);
  if (lotInput && value) {
    lotInput.value = value;
    validateField('lot_size', value, mode);
    calculateTradeValues(mode);
  }
}

async function handleFetchRate(e, mode = 'new') {
  const suffix = mode === 'edit' ? '_edit' : '';
  const tradeDateInput = document.getElementById(`trade-date-input${suffix}`);
  const usdRateInput = document.getElementById(`usd-jpy-rate-input${suffix}`);
  const fetchBtn = e.currentTarget;

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
    if (mode === 'new') usdRateInputManual = true;
    showToast(`USD/JPY ${Number(rate).toFixed(3)} を反映しました`, 'success');
    calculateTradeValues(mode);
  } catch (error) {
    console.error('USDJPY rate fetch error:', error);
    showToast('レート取得に失敗しました。', 'error');
  } finally {
    fetchBtn.disabled = false;
    fetchBtn.textContent = 'レート取得';
  }
}

/**
 * 日付文字列と時刻を合成してJSTのISO文字列を生成 (+09:00付与)
 */
function mergeDateAndTime(dateString, originalIsoString = null) {
  // 日付が未入力なら現在時刻 (JST)
  if (!dateString) return getJstNowISO();

  // 現在時刻 (JST基準)
  const now = new Date();
  let h = now.getHours();
  let m = now.getMinutes();
  let s = now.getSeconds();

  // 元の時間情報があればそれを使う (UTC時間をJST時間として解釈して数値を取り出す)
  if (originalIsoString) {
    const d = new Date(originalIsoString);
    if (!isNaN(d.getTime())) {
      // Intlを使ってJSTでの時分秒を取得
      const parts = new Intl.DateTimeFormat('ja-JP', {
        timeZone: 'Asia/Tokyo',
        hour: 'numeric', minute: 'numeric', second: 'numeric',
        hour12: false
      }).formatToParts(d);
      
      h = parseInt(parts.find(p => p.type === 'hour').value);
      m = parseInt(parts.find(p => p.type === 'minute').value);
      s = parseInt(parts.find(p => p.type === 'second').value);
    }
  }

  // 入力された日付 (YYYY-MM-DD)
  const [yyyy, mm, dd] = dateString.split('-').map(Number);
  
  // 手動でISO文字列を組み立て (+09:00)
  const pad = (n) => String(n).padStart(2, '0');
  const iso = `${yyyy}-${pad(mm)}-${pad(dd)}T${pad(h)}:${pad(m)}:${pad(s)}.000+09:00`;
  
  return iso;
}

/**
 * トレード送信処理
 */
async function handleTradeSubmit(e) {
  e.preventDefault();

  const formData = new FormData(e.target);
  const dateInput = formData.get('created_at');
  
  const tradeData = {
    pair: normalizePair(formData.get('pair')),
    direction: formData.get('direction'),
    lot_size: parseFloat(formData.get('lot_size')),
    entry_price: parseFloat(formData.get('entry_price')),
    exit_price: parseFloat(formData.get('exit_price')),
    pnl: parseFloat(formData.get('pnl')),
    pips: parseFloat(formData.get('pips')),
    notes: formData.get('notes') || '',
    // 日付と時刻を適切にマージ (JST)
    created_at: mergeDateAndTime(dateInput)
  };
  
  // 最終バリデーション
  let hasError = false;
  Object.keys(FIELD_DEFINITIONS).forEach(key => {
    if (!validateField(key, tradeData[key] || formData.get(key), 'new')) {
      hasError = true;
    }
  });
  
  if (hasError) {
    showToast('入力内容を確認してください', 'error');
    return;
  }

  try {
    await saveTrade(tradeData);
    addProgress('trade_record');
    refreshProgressUI();
    showToast('トレードを記録しました！', 'success');
    e.target.reset();
    // リセット後、方向ボタンの選択状態などもクリアする必要があればここで
    document.querySelectorAll('.direction-btn').forEach(b => b.classList.remove('active'));
    
    // デフォルト日付の再設定 (JST)
    const dateInputEl = document.getElementById('trade-date-input');
    if (dateInputEl) dateInputEl.value = getJstDateString(getJstNowISO());
    
    await loadTrades();
  } catch (error) {
    showToast('エラーが発生しました', 'error');
    console.error(error);
  }
}

/**
 * トレード更新処理
 */
async function handleEditSubmit(e, tradeId) {
  e.preventDefault();
  
  const form = e.target;
  const formData = new FormData(form);
  const dateInput = formData.get('created_at');
  const originalCreatedAt = form.dataset.originalCreatedAt;

  const tradeData = {
    pair: normalizePair(formData.get('pair')),
    direction: formData.get('direction'),
    lot_size: parseFloat(formData.get('lot_size')),
    entry_price: parseFloat(formData.get('entry_price')),
    exit_price: parseFloat(formData.get('exit_price')),
    pnl: parseFloat(formData.get('pnl')),
    pips: parseFloat(formData.get('pips')),
    notes: formData.get('notes') || '',
    // JSTでマージ
    created_at: mergeDateAndTime(dateInput, originalCreatedAt)
  };
  
  // バリデーション
  let hasError = false;
  Object.keys(FIELD_DEFINITIONS).forEach(key => {
    const val = key === 'created_at' ? (dateInput || '') : (tradeData[key] || formData.get(key));
    if (!validateField(key, val, 'edit')) {
      hasError = true;
    }
  });
  
  if (hasError) {
    showToast('入力内容を確認してください', 'error');
    return;
  }
  
  // 編集履歴の更新
  const originalTrade = allTrades.find(t => t.id === tradeId);
  const oldHistory = originalTrade?.edit_history || [];
  
  const newHistoryItem = {
    updatedAt: getJstNowISO(), // JSTで記録
    changes: 'Updated via Web UI'
  };
  
  tradeData.edit_history = [...oldHistory, newHistoryItem];

  try {
    await updateTrade(tradeId, tradeData);
    showToast('トレードを更新しました！', 'success');
    
    // モーダルを閉じる
    const modal = document.getElementById('edit-modal');
    if (modal) modal.remove();
    
    await loadTrades();
  } catch (error) {
    showToast('更新に失敗しました', 'error');
    console.error(error);
  }
}

/**
 * 編集モーダルを表示
 */
function showEditModal(trade) {
  // 既存のモーダルがあれば消す
  const existing = document.getElementById('edit-modal');
  if (existing) existing.remove();

  const closeModal = () => {
    const modal = document.getElementById('edit-modal');
    if (modal) modal.remove();
  };

  const form = createTradeForm('edit', trade, (e) => handleEditSubmit(e, trade.id), closeModal);
  
  // 初期計算を実行してプレビュー等を表示
  
  const modal = el('div', { 
    id: 'edit-modal',
    className: 'modal-overlay',
    style: {
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px'
    },
    onClick: (e) => { if(e.target.id === 'edit-modal') closeModal(); }
  },
    el('div', { 
      className: 'modal-content',
      style: {
        background: 'var(--color-bg)', padding: '24px', borderRadius: '12px',
        width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
      }
    },
      el('h3', { style: { marginTop: 0, marginBottom: '20px' } }, 'トレード編集'),
      form
    )
  );
  
  document.body.appendChild(modal);
  
  // フォームがDOMに追加された後に計算を実行してプレビューを更新
  setTimeout(() => calculateTradeValues('edit'), 0);
}

/**
 * トレード一覧を読み込み
 */
async function loadTrades() {
  try {
    // 全件取得（件数が多すぎる場合はサーバーサイドでlimitをかけるべきだが、現状はクライアント側で制御）
    // 将来的には getTrades に offset/limit を渡せるようにする
    allTrades = await getTrades(1000); 
    
    currentOffset = 0;
    displayedTrades = [];
    
    renderTrades(true); // リセットして描画
    updateStats();
  } catch (error) {
    console.error('Error loading trades:', error);
    const list = document.getElementById('trades-list');
    if (list) {
      list.innerHTML = '';
      list.appendChild(el('p', {}, 'エラーが発生しました'));
    }
  }
}

function handleLoadMore() {
  renderTrades(false); // 追加描画
}

/**
 * トレード一覧を表示
 * @param {boolean} reset - 一覧をリセットするかどうか
 */
function renderTrades(reset = false) {
  const container = document.getElementById('trades-list');
  const loadMoreBtn = document.getElementById('load-more-btn');
  if (!container) return;

  if (reset) {
    container.innerHTML = '';
    displayedTrades = [];
    currentOffset = 0;
  }

  if (allTrades.length === 0) {
    container.appendChild(el('p', {}, 'まだトレード記録がありません'));
    if (loadMoreBtn) loadMoreBtn.style.display = 'none';
    return;
  }

  const nextBatch = allTrades.slice(currentOffset, currentOffset + LIMIT_PER_PAGE);
  displayedTrades = [...displayedTrades, ...nextBatch];
  currentOffset += LIMIT_PER_PAGE;

  nextBatch.forEach(trade => {
    const isProfit = trade.pnl > 0;
    
    // 日付フォーマットの修正 (JST強制指定)
    let dateStr = '-';
    try {
      if (trade.created_at) {
        dateStr = new Intl.DateTimeFormat('ja-JP', {
          timeZone: 'Asia/Tokyo',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }).format(new Date(trade.created_at));
      }
    } catch (e) {
      console.error('Date format error:', e);
    }
    
    const card = el('div', { className: `trade-card ${isProfit ? 'profit' : 'loss'}` },
      el('div', { className: 'trade-header' },
        el('span', { className: 'trade-pair' }, trade.pair),
        el('span', { className: `trade-direction ${trade.direction === '買い' ? 'buy' : 'sell'}` }, trade.direction),
        el('span', { className: 'trade-pnl' }, (isProfit ? '+' : '') + trade.pnl.toLocaleString() + '円')
      ),
      el('div', { className: 'trade-details' },
        el('span', {}, `ロット: ${trade.lot_size}`),
        el('span', {}, `エントリー: ${trade.entry_price}`),
        el('span', {}, `決済: ${trade.exit_price}`),
        el('span', {}, `Pips: ${trade.pips}`)
      ),
      trade.notes ? el('div', { className: 'trade-notes' }, trade.notes) : null,
      el('div', { className: 'trade-footer' },
        el('span', { className: 'trade-date' }, dateStr),
        el('div', { className: 'trade-actions', style: { display: 'flex', gap: '8px' } },
          el('button', { 
            className: 'btn-secondary btn-sm', 
            style: { padding: '4px 8px', fontSize: '12px' },
            onClick: () => showEditModal(trade)
          }, '編集'),
          el('button', { 
            className: 'btn-delete', 
            onClick: () => deleteTradeHandler(trade.id) 
          }, '削除')
        )
      )
    );
    
    container.appendChild(card);
  });

  // 「もっと見る」ボタンの表示制御
  if (loadMoreBtn) {
    loadMoreBtn.style.display = currentOffset < allTrades.length ? 'block' : 'none';
  }
}

/**
 * 統計を更新
 */
function updateStats() {
  const stats = calculateStats(allTrades);

  const elTotalTrades = document.getElementById('total-trades');
  const elWinRate = document.getElementById('win-rate');
  const elTotalPnl = document.getElementById('total-pnl');
  const elProfitFactor = document.getElementById('profit-factor');

  if (elTotalTrades) elTotalTrades.textContent = stats.totalTrades;
  if (elWinRate) elWinRate.textContent = stats.winRate.toFixed(1) + '%';
  if (elTotalPnl) elTotalPnl.textContent = stats.totalPnl.toLocaleString() + '円';
  if (elProfitFactor) elProfitFactor.textContent = stats.profitFactor.toFixed(2);
}

/**
 * トレード削除
 */
async function deleteTradeHandler(tradeId) {
  if (!confirm('このトレードを削除しますか？')) return;

  try {
    await deleteTrade(tradeId);
    showToast('トレードを削除しました', 'success');
    // 全件再ロード
    await loadTrades();
  } catch (error) {
    showToast('エラーが発生しました', 'error');
    console.error(error);
  }
}

/**
 * トレード値を計算
 * @param {string} mode - 'new' or 'edit'
 */
function calculateTradeValues(mode = 'new') {
  const suffix = mode === 'edit' ? '_edit' : '';
  
  const pair = document.getElementById(`pair-select${suffix}`)?.value;
  const entry = parseFloat(document.getElementById(`entry-price${suffix}`)?.value);
  const exit = parseFloat(document.getElementById(`exit-price${suffix}`)?.value);
  const lot = parseFloat(document.getElementById(`lot-size${suffix}`)?.value);
  const direction = document.getElementById(`direction-input${suffix}`)?.value;
  const usdRateInput = document.getElementById(`usd-jpy-rate-input${suffix}`);

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
  const pipsInput = document.getElementById(`pips${suffix}`);
  const pnlInput = document.getElementById(`pnl${suffix}`);
  
  if (pipsInput) pipsInput.value = pips.toFixed(1);
  if (pnlInput) pnlInput.value = pnl.toFixed(0);

  // プレビュー表示
  updateCalculationPreview(pips, pnl, pipMultiplier, pipValuePerLot, usdJpyRateUsed, normalizedPair, mode);
}

/**
 * 計算プレビュー更新
 */
function updateCalculationPreview(pips, pnl, pipMultiplier, pipValuePerLot, usdJpyRate, pair, mode = 'new') {
  const suffix = mode === 'edit' ? '_edit' : '';
  const preview = document.getElementById(`calculation-preview${suffix}`);
  if (!preview) return;
  
  preview.style.display = 'flex';

  const previewPips = document.getElementById(`preview-pips${suffix}`);
  const previewPnl = document.getElementById(`preview-pnl${suffix}`);
  const previewImpact = document.getElementById(`preview-impact${suffix}`);

  if (previewPips) previewPips.textContent = pips.toFixed(1);
  if (previewPnl) {
    previewPnl.textContent = (pnl > 0 ? '+' : '') + pnl.toLocaleString() + '円';
    previewPnl.style.color = pnl > 0 ? 'var(--color-success)' : 'var(--color-error)';
  }

  // 既存のmeta要素を探して更新、なければ作成
  let previewMeta = preview.querySelector('.preview-meta');
  const rateText = pair === 'XAU/USD' || (!pair.endsWith('/JPY') && pair.includes('/USD'))
    ? ` USDJPY: ${usdJpyRate.toFixed(3)}`
    : '';
    
  const metaText = `1ロットあたり1pips = 約${Math.round(pipValuePerLot).toLocaleString()}円 (${pipMultiplier.toFixed(0)}倍計算${rateText})`;

  if (!previewMeta) {
    previewMeta = el('div', { 
      className: 'preview-meta',
      style: { fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }
    }, metaText);
    preview.appendChild(previewMeta);
  } else {
    previewMeta.textContent = metaText;
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

function setupRateHelpers() {
  const tradeDateInput = document.getElementById('trade-date-input');

  const today = new Date();
  // デフォルト値をJSTでセット
  if (tradeDateInput && !tradeDateInput.value) {
    tradeDateInput.value = getJstDateString(getJstNowISO());
  }

  applyDefaultUsdJpyRate();
}

async function fetchUsdJpyRate(date) {
  // Frankfurter API
  let endpoint = 'https://api.frankfurter.app/latest?from=USD&to=JPY';
  if (date) {
    // 日付形式の検証 (簡易)
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      endpoint = `https://api.frankfurter.app/${date}?from=USD&to=JPY`;
    }
  }

  console.log(`Fetching rate from: ${endpoint}`);

  try {
    const response = await fetch(endpoint);
    
    if (!response.ok) {
      console.error(`Rate fetch failed: ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.error('Response body:', text);
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Rate data:', data);
    
    return data?.rates?.JPY;
  } catch (error) {
    console.error('Rate fetch error details:', error);
    throw error;
  }
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
