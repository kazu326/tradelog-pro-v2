/**
 * 共通トレード型（JSDoc typedef）
 * この型に準拠してインポート/保存/分析/表示を実装します。
 * @typedef {Object} TradeRecord
 * @property {string} id - 任意（保存後に付与）
 * @property {string} created_at - ISO文字列（JST推奨/UTC可）
 * @property {string} pair - 通貨ペア (e.g., "USDJPY")
 * @property {"buy"|"sell"} direction - 方向
 * @property {number} entry_price - エントリー価格
 * @property {number} exit_price - 決済価格
 * @property {number} lot_size - ロット
 * @property {number} pips - 獲得/損失pips
 * @property {number} pnl - 円ベース損益
 * @property {string} [notes] - メモ
 */

/** 必須キー */
export const REQUIRED_TRADE_KEYS = [
  'created_at','pair','direction','entry_price','exit_price','lot_size','pips','pnl'
];

const PAIR_ALIASES = new Map([
  ['XAUUSD', 'XAU/USD'],
  ['XAU/USD', 'XAU/USD'],
  ['GOLDUSD', 'XAU/USD'],
  ['GOLD/USD', 'XAU/USD'],
  ['GOLDXAU', 'XAU/USD'],
  ['XAUUS', 'XAU/USD'] // 一部業者表記対応
]);

export function normalizePairSymbol(value) {
  if (!value) return '';
  const upper = String(value).toUpperCase().trim();
  const compact = upper.replace(/\s+/g, '');
  if (PAIR_ALIASES.has(compact)) {
    return PAIR_ALIASES.get(compact);
  }
  if (PAIR_ALIASES.has(upper)) {
    return PAIR_ALIASES.get(upper);
  }
  return upper;
}

/**
 * レコード型ガード + 正規化
 * @param {any} raw
 * @returns {{ok:true, value: import('./types.js').TradeRecord} | {ok:false, error:string}}
 */
export function validateAndNormalizeTrade(raw) {
  try {
    const missing = REQUIRED_TRADE_KEYS.filter(k => raw[k] === undefined || raw[k] === null || raw[k] === '');
    if (missing.length) return { ok:false, error:`必須項目が不足: ${missing.join(', ')}` };
    const direction = String(raw.direction).toLowerCase();
    if (direction !== 'buy' && direction !== 'sell') return { ok:false, error:'direction は buy/sell' };
    const normalized = {
      created_at: new Date(raw.created_at).toISOString(),
      pair: normalizePairSymbol(raw.pair),
      direction,
      entry_price: Number(raw.entry_price),
      exit_price: Number(raw.exit_price),
      lot_size: Number(raw.lot_size),
      pips: Number(raw.pips),
      pnl: Number(raw.pnl),
      notes: raw.notes ? String(raw.notes) : undefined
    };
    // idが有効な値の場合のみ含める（更新時など）
    if (raw.id && raw.id !== null && raw.id !== undefined && raw.id !== '') {
      normalized.id = String(raw.id);
    }
    if ([normalized.entry_price,normalized.exit_price,normalized.lot_size,normalized.pips,normalized.pnl].some(n=>Number.isNaN(n))) {
      return { ok:false, error:'数値項目に無効値があります' };
    }
    return { ok:true, value: normalized };
  } catch (e) {
    return { ok:false, error: '変換エラー' };
  }
}


