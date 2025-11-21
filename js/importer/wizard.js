// Import wizard v3 - Bulk Edit Support
import * as Importer from './index.js';
import { showToast } from '../ui/toast.js';
import { el } from '../utils/dom.js';

// 状態管理
let state = {
  parsedRows: [], // { data, isValid, errors, id }
  sourceType: 'csv'
};

/**
 * インポートウィザードを開く
 */
export function openImportWizard() {
  if (document.getElementById('import-wizard')) return;
  
  // 初期化
  state = { parsedRows: [], sourceType: 'csv' };
  
  const originalOverflow = document.body.style.overflow;
  const originalWidth = document.body.style.width;
  document.body.classList.add('no-scroll');
  
  const close = () => {
    const wrap = document.getElementById('import-wizard');
    if (wrap) wrap.remove();
    document.body.classList.remove('no-scroll');
    document.body.style.overflow = originalOverflow;
    document.body.style.width = originalWidth;
  };

  const handleSourceChange = () => {
    const sel = document.getElementById('imp-source');
    const file = document.getElementById('imp-file');
    const text = document.getElementById('imp-text');
    const gsheetsBlock = document.getElementById('gsheets-block');
    
    if (!sel || !file || !text || !gsheetsBlock) return;

    state.sourceType = sel.value;
    const v = sel.value;
    file.style.display = (v === 'paste') ? 'none' : '';
    text.style.display = (v === 'paste') ? '' : 'none';
    gsheetsBlock.style.display = (v === 'csv') ? '' : 'none';
  };

  // ファイル読み込み・パース処理（まだ保存はしない）
  const handleLoad = async () => {
    try {
      const progress = document.getElementById('imp-progress');
      const bar = progress.querySelector('div');
      progress.style.display = '';
      bar.style.width = '10%';

      const text = document.getElementById('imp-text');
      const file = document.getElementById('imp-file');
      
      let rawData = [];
      const mode = state.sourceType;

      if (mode === 'paste') {
        const txt = text.value.trim();
        rawData = Importer.parseClipboard(txt);
      } else if (mode === 'csv') {
        const gsUrl = document.getElementById('imp-gsheets-url').value.trim();
        if (gsUrl) {
          if (Importer.parseFromUrl) {
            rawData = await Importer.parseFromUrl(gsUrl);
          } else {
            const res = await fetch(gsUrl, { mode: 'cors' });
            const txt = await res.text();
            rawData = Importer.parseCSV(txt);
          }
        } else {
          const buf = await readFileAsText(file.files?.[0]);
          rawData = Importer.parseCSV(buf);
        }
      } else if (mode === 'json') {
        const buf = await readFileAsText(file.files?.[0]);
        rawData = Importer.parseJSON(buf);
      } else if (mode === 'xlsx') {
        const ab = await readFileAsArrayBuffer(file.files?.[0]);
        rawData = await Importer.parseXLSX(ab);
      }
      
      bar.style.width = '50%';

      if (!rawData || rawData.length === 0) {
        showToast('データが読み取れませんでした', 'error');
        progress.style.display = 'none';
        return;
      }

      // 生データを編集用オブジェクトに変換
      state.parsedRows = rawData.map((row, idx) => ({
        id: `row-${idx}`,
        data: row,
        selected: true,
        isValid: true, // 後で検証
        errors: []
      }));

      // 初期バリデーション
      validateRows();

      bar.style.width = '100%';
      setTimeout(() => { progress.style.display = 'none'; }, 300);
      
      // 編集画面へ切り替え
      switchView('edit');
      renderEditor();

    } catch (e) {
      console.error('Load error:', e);
      showToast('読み込みエラー: ' + e.message, 'error');
      document.getElementById('imp-progress').style.display = 'none';
    }
  };

  // 保存実行
  const handleSave = async () => {
    const validRows = state.parsedRows.filter(r => r.selected && r.isValid);
    if (validRows.length === 0) {
      showToast('インポート対象の有効なデータがありません', 'warning');
      return;
    }

    const confirmMsg = `${validRows.length} 件のデータをインポートしますか？`;
    if (!confirm(confirmMsg)) return;

    try {
      const progress = document.getElementById('imp-progress');
      progress.style.display = '';
      progress.querySelector('div').style.width = '50%';

      // Importer.importTrades は raw objects を期待する
      const dataToImport = validRows.map(r => r.data);
      const { okCount, ngCount, errors } = await Importer.importTrades(dataToImport);
      
      progress.querySelector('div').style.width = '100%';

      if (ngCount > 0) {
        showToast(`完了: 成功 ${okCount} / 失敗 ${ngCount}`, 'warning');
        console.warn('Import errors:', errors);
      } else {
        showToast(`${okCount} 件をインポートしました！`, 'success');
        // 成功したら画面遷移して閉じる
        try {
          localStorage.setItem('analytics:tab', 'graphs');
          const analyticsTabBtn = document.querySelector('.tab-btn[data-tab="analytics"]');
          if (analyticsTabBtn) analyticsTabBtn.click();
        } catch {}
        close();
      }
    } catch (e) {
      showToast('保存中にエラーが発生しました', 'error');
      console.error(e);
    } finally {
      const p = document.getElementById('imp-progress');
      if (p) p.style.display = 'none';
    }
  };

  const wrap = el('div', { id: 'import-wizard' },
    el('div', { className: 'modal-backdrop', onClick: close }),
    el('div', { className: 'modal', style: { maxWidth: '90%', width: '1000px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' } },
      el('div', { className: 'modal__header' },
        el('h3', {}, 'データインポート＆一括編集'),
        el('button', { className: 'modal__close', onClick: close }, '✕')
      ),
      
      // Step 1: Source Selection
      el('div', { id: 'view-source', className: 'modal__body' },
        el('div', { className: 'import-source' },
          el('label', {}, 'ソース:'),
          el('select', { id: 'imp-source', onChange: handleSourceChange },
            el('option', { value: 'csv' }, 'CSV'),
            el('option', { value: 'json' }, 'JSON'),
            el('option', { value: 'xlsx' }, 'XLSX'),
            el('option', { value: 'paste' }, 'コピペ')
          )
        ),
        el('div', { className: 'import-controls', style: { marginTop: '16px' } },
          el('input', { type: 'file', id: 'imp-file', accept: '.csv,.json,.xlsx' }),
          el('textarea', { id: 'imp-text', placeholder: 'ここに貼り付け', style: { display: 'none', height: '120px', width: '100%' } }),
          el('div', { id: 'gsheets-block', style: { display: 'none', marginTop: '8px' } },
            el('input', { type: 'url', id: 'imp-gsheets-url', placeholder: 'Googleスプレッドシートの共有URL', style: { width: '100%' } })
          )
        ),
        el('button', { className: 'btn-primary', style: { marginTop: '20px' }, onClick: handleLoad }, '読み込み')
      ),

      // Step 2: Editor (Table)
      el('div', { id: 'view-edit', className: 'modal__body', style: { display: 'none', flex: '1', overflow: 'hidden', padding: '0' } },
        // Toolbar
        el('div', { className: 'editor-toolbar', style: { padding: '10px', borderBottom: '1px solid var(--color-border)', display: 'flex', gap: '10px', background: 'var(--color-bg-secondary)' } },
          el('button', { className: 'btn-secondary btn-sm', onClick: () => handleBulkAction('delete') }, '🗑 選択削除'),
          el('span', { style: { borderLeft: '1px solid #ccc', margin: '0 5px' } }),
          el('select', { id: 'bulk-pair', style: { fontSize: '12px' } },
            el('option', { value: '' }, '通貨ペア一括変更...'),
            el('option', { value: 'USD/JPY' }, 'USD/JPY'),
            el('option', { value: 'EUR/USD' }, 'EUR/USD'),
            el('option', { value: 'XAU/USD' }, 'GOLD')
          ),
          el('button', { className: 'btn-secondary btn-sm', onClick: () => handleBulkAction('pair') }, '適用'),
          el('span', { style: { flex: '1' } }),
          el('div', { id: 'edit-summary', style: { fontSize: '12px', alignSelf: 'center' } }, '0 件')
        ),
        // Table Container
        el('div', { className: 'editor-table-container', style: { flex: '1', overflow: 'auto', padding: '10px' } },
          el('table', { id: 'editor-table', className: 'data-table' }) // 中身は renderEditor で生成
        )
      ),

      el('div', { className: 'progress-bar', id: 'imp-progress', style: { display: 'none' } },
        el('div', {})
      ),

      el('div', { className: 'modal__footer', style: { justifyContent: 'space-between' } },
        el('button', { id: 'btn-back', className: 'btn-secondary', style: { display: 'none' }, onClick: () => switchView('source') }, '← 戻る'),
        el('button', { id: 'btn-save', className: 'btn-primary', style: { display: 'none' }, onClick: handleSave }, 'インポート実行')
      )
    )
  );

  document.body.appendChild(wrap);
  handleSourceChange(); // 初期表示設定
}

function switchView(view) {
  const sourceView = document.getElementById('view-source');
  const editView = document.getElementById('view-edit');
  const btnBack = document.getElementById('btn-back');
  const btnSave = document.getElementById('btn-save');

  if (view === 'edit') {
    sourceView.style.display = 'none';
    editView.style.display = 'flex';
    editView.style.flexDirection = 'column';
    btnBack.style.display = '';
    btnSave.style.display = '';
  } else {
    sourceView.style.display = '';
    editView.style.display = 'none';
    btnBack.style.display = 'none';
    btnSave.style.display = 'none';
  }
}

function validateRows() {
  let okCount = 0;
  state.parsedRows.forEach(row => {
    const d = row.data;
    row.errors = [];
    
    if (!d.pair) row.errors.push('通貨ペアなし');
    if (!d.entry_price || isNaN(d.entry_price)) row.errors.push('Entry価格不正');
    if (!d.exit_price || isNaN(d.exit_price)) row.errors.push('Exit価格不正');
    if (!d.lot_size || isNaN(d.lot_size)) row.errors.push('ロット不正');
    
    row.isValid = row.errors.length === 0;
    if (row.isValid) okCount++;
  });
  
  const summary = document.getElementById('edit-summary');
  if (summary) summary.textContent = `有効: ${okCount} / 全体: ${state.parsedRows.length}`;
}

function renderEditor() {
  const table = document.getElementById('editor-table');
  if (!table) return;
  table.innerHTML = '';

  // Header
  const fields = [
    { key: 'selected', label: '☑', width: '30px' },
    { key: 'pair', label: '通貨ペア', width: '100px' },
    { key: 'direction', label: '売買', width: '60px' },
    { key: 'lot_size', label: 'Lot', width: '60px' },
    { key: 'entry_price', label: 'Entry', width: '80px' },
    { key: 'exit_price', label: 'Exit', width: '80px' },
    { key: 'pnl', label: '損益', width: '80px' },
    { key: 'created_at', label: '日付', width: '120px' },
    { key: 'notes', label: 'メモ', width: '150px' }
  ];

  const thead = el('thead', {},
    el('tr', {},
      ...fields.map(f => el('th', { style: { width: f.width } }, 
        f.key === 'selected' 
          ? el('input', { type: 'checkbox', checked: true, onChange: toggleAllSelection })
          : f.label
      ))
    )
  );
  table.appendChild(thead);

  // Body
  const tbody = el('tbody', {});
  
  state.parsedRows.forEach((row) => {
    const tr = el('tr', { 
      className: row.isValid ? '' : 'row-error',
      dataset: { id: row.id } 
    });

    // Checkbox
    tr.appendChild(el('td', {}, 
      el('input', { 
        type: 'checkbox', 
        checked: row.selected, 
        onChange: (e) => { row.selected = e.target.checked; }
      })
    ));

    // Fields
    fields.slice(1).forEach(f => {
      const val = row.data[f.key] || '';
      
      let input;
      if (f.key === 'direction') {
        input = el('select', { 
          value: val, 
          className: 'editor-input',
          onChange: (e) => updateCell(row, f.key, e.target.value)
        }, 
          el('option', { value: '買い' }, '買い'),
          el('option', { value: '売り' }, '売り')
        );
        input.value = val; // 明示的にセット
      } else {
        input = el('input', { 
          type: 'text', 
          value: val, 
          className: 'editor-input',
          style: { width: '100%' },
          onChange: (e) => updateCell(row, f.key, e.target.value)
        });
      }
      
      const td = el('td', {}, input);
      if (!row.isValid && row.errors.some(e => e.includes(f.label) || e.includes(f.key))) {
        td.style.background = '#fee';
        td.title = row.errors.join('\n');
      }
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
  
  table.appendChild(tbody);
}

function toggleAllSelection(e) {
  const checked = e.target.checked;
  state.parsedRows.forEach(r => r.selected = checked);
  renderEditor(); // 再描画（チェックボックスの状態更新のため）
}

function updateCell(row, key, value) {
  row.data[key] = value;
  validateRows();
  // エラー状態が変わるかもしれないので行スタイル更新が必要だが、
  // 簡易的に親のTRの色を変えるか、全体再描画。今回はパフォーマンス考慮しつつ簡易再描画
  // renderEditor(); // 全体再描画は重いので、検証結果表示だけ更新
  const tr = document.querySelector(`tr[data-id="${row.id}"]`);
  if (tr) {
    tr.className = row.isValid ? '' : 'row-error';
  }
}

function handleBulkAction(action) {
  const targets = state.parsedRows.filter(r => r.selected);
  if (targets.length === 0) return;

  if (action === 'delete') {
    if (!confirm(`${targets.length} 件を削除しますか？`)) return;
    state.parsedRows = state.parsedRows.filter(r => !r.selected);
    renderEditor();
  } else if (action === 'pair') {
    const val = document.getElementById('bulk-pair').value;
    if (!val) return;
    targets.forEach(r => {
      r.data.pair = val;
    });
    validateRows();
    renderEditor();
  }
  validateRows();
}

function readFileAsText(file) {
  return new Promise((res, rej)=>{
    if (!file) return rej(new Error('ファイル未選択'));
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result||''));
    fr.onerror = rej;
    fr.readAsText(file);
  });
}

function readFileAsArrayBuffer(file) {
  return new Promise((res, rej)=>{
    if (!file) return rej(new Error('ファイル未選択'));
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = rej;
    fr.readAsArrayBuffer(file);
  });
}
