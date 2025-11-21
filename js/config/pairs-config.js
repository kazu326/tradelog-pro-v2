/**
 * 通貨ペア・商品定義設定ファイル
 * 
 * ロット計算で使用する各商品の詳細情報を管理
 */

export const PAIRS = [
  {
    id: 'USDJPY',
    displayName: 'ドル円',
    type: 'forex',
    category: 'クロス円',
    symbol: '💴',
    color: '#ea2e2e', // 赤枠（UI用）
    contractSize: 100000, // 1ロット単位（10万通貨）
    decimal: 3, // 表示小数点（150.123形式）
    isJpyPair: true, // クロス円判定
    apiSymbol: 'USDJPY', // API取得用コード
    backupSymbols: ['USDJPY=X'], // 予備API用コード
    minLot: 0.01, // 最小ロット
    icon: '🇯🇵',
    pipValue: 1000 // 1pip（0.01円）の価値（10万通貨時）
  },
  {
    id: 'XAUUSD',
    displayName: 'GOLD（金）',
    type: 'commodity',
    category: 'GOLD',
    symbol: '🥇',
    color: '#f5b800', // 金枠
    contractSize: 100, // 1ロット＝100オンス
    decimal: 2,
    isJpyPair: false,
    apiSymbol: 'XAUUSD',
    backupSymbols: ['GC=F'],
    minLot: 0.01,
    icon: '🥇',
    pipValue: 15000 // 1ドル変動 = 100ドル = 約15,000円（1ドル=150円想定）
  },
  {
    id: 'NIKKEI225',
    displayName: '日経225',
    type: 'stock',
    category: '株式',
    symbol: '📈',
    color: '#2496ff', // 青枠
    contractSize: 100, // 1ロット = 100倍（一般的なCFD仕様）
    decimal: 0,
    isJpyPair: true,
    apiSymbol: '^N225',
    backupSymbols: ['N225'],
    minLot: 0.1,
    icon: '🇯🇵',
    pipValue: 100 // 1ポイント変動 = 100円（100倍CFDの場合）
  },
  {
    id: 'BTCUSD',
    displayName: 'ビットコイン',
    type: 'crypto',
    category: '仮想通貨',
    symbol: '₿',
    color: '#161616', // 黒背景
    backgroundColor: '#161616',
    textColor: '#f7931a', // ビットコインオレンジ
    contractSize: 1, // 1BTC
    decimal: 2, // 価格表示（USD）
    lotDecimal: 4, // ロット表示（0.0001BTC単位）
    isJpyPair: false,
    apiSymbol: 'bitcoin', // CoinGecko用ID
    backupSymbols: ['BTC'],
    minLot: 0.0001,
    icon: '₿',
    pipValue: 150000 // 1ドル変動 × 1ロット（1BTC） × 1ドル=150円 × 倍率1000
    // これで適切な小数ロット（0.001〜0.1程度）になる
  },
  {
    id: 'ETHUSD',
    displayName: 'イーサリアム',
    type: 'crypto',
    category: '仮想通貨',
    symbol: 'Ξ',
    color: '#161616',
    backgroundColor: '#161616',
    textColor: '#627eea', // イーサリアムブルー
    contractSize: 1,
    decimal: 2,
    lotDecimal: 3,
    isJpyPair: false,
    apiSymbol: 'ethereum',
    backupSymbols: ['ETH'],
    minLot: 0.001,
    icon: 'Ξ',
    pipValue: 150000 // 同様に調整
  },
  {
    id: 'EURJPY',
    displayName: 'ユーロ円',
    type: 'forex',
    category: 'クロス円',
    symbol: '💴',
    color: '#ea2e2e',
    contractSize: 100000,
    decimal: 3,
    isJpyPair: true,
    apiSymbol: 'EURJPY',
    backupSymbols: ['EURJPY=X'],
    minLot: 0.01,
    icon: '🇪🇺',
    pipValue: 1000
  },
  {
    id: 'GBPJPY',
    displayName: 'ポンド円',
    type: 'forex',
    category: 'クロス円',
    symbol: '💴',
    color: '#ea2e2e',
    contractSize: 100000,
    decimal: 3,
    isJpyPair: true,
    apiSymbol: 'GBPJPY',
    backupSymbols: ['GBPJPY=X'],
    minLot: 0.01,
    icon: '🇬🇧',
    pipValue: 1000
  }
];

// カテゴリー定義（大選択UI用）
export const CATEGORIES = [
  {
    id: 'cross-yen',
    displayName: 'クロス円',
    color: '#ea2e2e',
    icon: '💴',
    description: 'ドル円・ユーロ円・ポンド円など'
  },
  {
    id: 'gold',
    displayName: 'GOLD',
    color: '#f5b800',
    icon: '🥇',
    description: '金CFD取引'
  },
  {
    id: 'stock',
    displayName: '株式',
    color: '#2496ff',
    icon: '📈',
    description: '日経225・米国株など'
  },
  {
    id: 'crypto',
    displayName: '仮想通貨',
    color: '#161616',
    backgroundColor: '#161616',
    textColor: '#ffffff',
    icon: '₿',
    description: 'BTC・ETH・USDTなど'
  }
];

// デフォルト商品
export const DEFAULT_PAIR_ID = 'USDJPY';

// ヘルパー関数：IDから商品情報を取得
export function getPairById(id) {
  return PAIRS.find(pair => pair.id === id);
}

// ヘルパー関数：カテゴリーから商品リストを取得
export function getPairsByCategory(category) {
  const categoryMap = {
    'cross-yen': 'クロス円',
    'gold': 'GOLD',
    'stock': '株式',
    'crypto': '仮想通貨'
  };
  return PAIRS.filter(pair => pair.category === categoryMap[category]);
}
