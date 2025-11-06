// Importer index v2 - 2025-11-07
import { validateAndNormalizeTrade } from '../core/types.js';
import { showToast } from '../ui/toast.js';
import { saveTrade } from '../core/storage.js';

/** シンプルCSVパース（カンマ区切り、ヘッダ行必須） */
export function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h=>h.trim());
  return lines.slice(1).map(l => {
    const cols = l.split(',');
    const obj = {};
    headers.forEach((h,i)=>{ obj[h] = (cols[i]??'').trim(); });
    return obj;
  });
}

/** JSONパース */
export function parseJSON(text) {
  try { return JSON.parse(text); } catch { return []; }
}

/** クリップボード/ペースト（CSV/JSON自動判別） */
export function parseClipboard(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return parseJSON(trimmed);
  return parseCSV(trimmed);
}

/** Google Sheets の公開URL → CSVエクスポートURLへ変換 */
export function toGoogleSheetsCsvUrl(url) {
  try {
    const u = new URL(url);
    // 例: https://docs.google.com/spreadsheets/d/<ID>/edit#gid=0
    if (u.hostname.includes('docs.google.com') && u.pathname.includes('/spreadsheets/d/')) {
      const parts = u.pathname.split('/');
      const idIndex = parts.indexOf('d');
      const sheetId = parts[idIndex + 1];
      const gidMatch = (u.hash||'').match(/gid=(\d+)/);
      const gid = gidMatch ? gidMatch[1] : '0';
      return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
    }
  } catch {}
  return url; // 変換不可ならそのまま
}

/** URLからCSV/JSONを取得してパース（シンプル） */
export async function parseFromUrl(url) {
  const target = toGoogleSheetsCsvUrl(url);
  const res = await fetch(target, { mode: 'cors' });
  const text = await res.text();
  const t = text.trim();
  if (t.startsWith('[') || t.startsWith('{')) return parseJSON(t);
  return parseCSV(t);
}

/** XLSX: 可能なら動的読み込み（SheetJS） */
export async function parseXLSX(arrayBuffer) {
  const XLSX = await loadXLSX();
  const wb = XLSX.read(new Uint8Array(arrayBuffer), { type:'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws);
}

async function loadXLSX() {
  if (window.XLSX) return window.XLSX;
  await new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    s.onload = () => res();
    s.onerror = () => rej(new Error('XLSX読み込み失敗'));
    document.head.appendChild(s);
  });
  return window.XLSX;
}

/**
 * 共通インポート実行
 * @param {Array<Object>} rawRows
 * @returns {Promise<{okCount:number, ngCount:number, samples:any[], errors:Array<{index:number, error:string, data:any}>}>}
 */
export async function importTrades(rawRows) {
  let okCount = 0, ngCount = 0;
  const samples = [];
  const errors = [];
  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    const r = validateAndNormalizeTrade(raw);
    if (!r.ok) {
      ngCount++;
      errors.push({ index: i + 1, error: r.error, data: raw });
      continue;
    }
    if (samples.length < 5) samples.push(r.value);
    try {
      await saveTrade(r.value);
      okCount++;
    } catch (e) {
      ngCount++;
      const errorMsg = e?.message || e?.error?.message || String(e);
      errors.push({ index: i + 1, error: errorMsg, data: raw });
      console.error(`インポートエラー (行 ${i + 1}):`, e);
    }
  }
  return { okCount, ngCount, samples, errors };
}


