import { parseCSV, parseJSON, parseClipboard, parseXLSX, importTrades } from './index.js';
import { showToast } from '../ui/toast.js';

export function openImportWizard() {
  if (document.getElementById('import-wizard')) return;
  
  // bodyのスクロールを無効化（横ブレ防止）
  const originalOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  
  const wrap = document.createElement('div');
  wrap.id = 'import-wizard';
  wrap.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal">
      <div class="modal__header">
        <h3>データインポート</h3>
        <button class="modal__close" aria-label="閉じる">✕</button>
      </div>
      <div class="modal__body">
        <div class="import-source">
          <label>ソース:</label>
          <select id="imp-source">
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
            <option value="xlsx">XLSX</option>
            <option value="paste">コピペ</option>
          </select>
        </div>
        <div class="import-controls">
          <input type="file" id="imp-file" accept=".csv,.json,.xlsx" />
          <textarea id="imp-text" placeholder="ここに貼り付け（CSV/JSON 自動判別）" style="display:none;height:120px"></textarea>
        </div>
        <div class="progress-bar" id="imp-progress" style="display:none"><div></div></div>
        <div class="import-preview" id="imp-preview"></div>
      </div>
      <div class="modal__footer">
        <button id="imp-run" class="btn-primary">インポート開始</button>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);

  const close = () => {
    document.body.style.overflow = originalOverflow;
    wrap.remove();
  };
  wrap.querySelector('.modal__close').addEventListener('click', close);
  wrap.querySelector('.modal-backdrop').addEventListener('click', close);

  const sel = wrap.querySelector('#imp-source');
  const file = wrap.querySelector('#imp-file');
  const text = wrap.querySelector('#imp-text');
  sel.addEventListener('change', () => {
    const v = sel.value;
    file.style.display = (v==='paste') ? 'none' : '';
    text.style.display = (v==='paste') ? '' : 'none';
  });

  wrap.querySelector('#imp-run').addEventListener('click', async () => {
    try {
      const progress = wrap.querySelector('#imp-progress');
      const bar = progress.querySelector('div');
      progress.style.display = '';
      bar.style.width = '10%';

      let rows = [];
      const mode = sel.value;
      if (mode === 'paste') {
        const txt = text.value.trim();
        rows = parseClipboard(txt);
      } else if (mode === 'csv') {
        const buf = await readFileAsText(file.files?.[0]);
        rows = parseCSV(buf);
      } else if (mode === 'json') {
        const buf = await readFileAsText(file.files?.[0]);
        rows = parseJSON(buf);
      } else if (mode === 'xlsx') {
        const ab = await readFileAsArrayBuffer(file.files?.[0]);
        rows = await parseXLSX(ab);
      }
      bar.style.width = '30%';

      if (!rows || rows.length === 0) {
        showToast('データが読み取れませんでした', 'error');
        progress.style.display = 'none';
        return;
      }

      const { okCount, ngCount, samples } = await importTrades(rows);
      bar.style.width = '90%';

      renderPreview(wrap.querySelector('#imp-preview'), samples, okCount, ngCount);
      bar.style.width = '100%';
      setTimeout(()=>{ progress.style.display='none'; }, 400);
      showToast(`インポート完了: 成功 ${okCount} / 失敗 ${ngCount}`, 'success');

      // インポート→分析体験へ自動遷移
      try {
        // 1) 分析ページの内部タブをグラフにする指定を保存
        localStorage.setItem('analytics:tab', 'graphs');
        // 2) ウィザードを閉じる
        wrap.remove();
        // 3) メインタブの「分析」へ切替（loadTabContentで再初期化）
        const analyticsTabBtn = document.querySelector('.tab-btn[data-tab="analytics"]');
        if (analyticsTabBtn) {
          analyticsTabBtn.click();
        }
      } catch {}
    } catch (e) {
      showToast('インポート中にエラーが発生しました', 'error');
    }
  });
}

function renderPreview(container, samples, ok, ng) {
  const head = ['created_at','pair','direction','entry_price','exit_price','lot_size','pips','pnl','notes'];
  const rows = samples.map(r => `<tr>${head.map(h=>`<td>${escapeHtml(r[h]??'')}</td>`).join('')}</tr>`).join('');
  container.innerHTML = `
    <div style="display:flex; gap:12px; align-items:center; margin:8px 0;">
      <strong>プレビュー</strong>
      <span style="font-size:12px; color:var(--color-text-secondary)">成功 ${ok} / 失敗 ${ng}</span>
    </div>
    <div style="overflow:auto; max-height:240px; border:1px solid var(--color-border); border-radius:8px;">
      <table style="width:100%; border-collapse:collapse;">
        <thead><tr>${head.map(h=>`<th style='text-align:left;padding:6px;border-bottom:1px solid var(--color-border);'>${h}</th>`).join('')}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function escapeHtml(s){
  return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
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


