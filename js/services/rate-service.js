/**
 * レート取得サービス
 * 
 * 複数のAPIソースを統合してリアルタイムレートを取得
 * 
 * キャッシュ機能・エラーハンドリング・フォールバック機能搭載
 */

import { PAIRS, getPairById } from '../config/pairs-config.js';

class RateService {
  constructor() {
    // キャッシュストレージ（メモリ内）
    this.cache = new Map();
    // キャッシュ有効期限（ミリ秒）- デフォルト60秒
    this.cacheExpiry = 60 * 1000;
    // API呼び出し状態管理
    this.pendingRequests = new Map();
  }

  /**
   * レート取得のメインメソッド
   * 
   * @param {string} pairId - 通貨ペアID（例: 'USDJPY', 'BTCUSD'）
   * 
   * @returns {Promise<number|null>} - レート（取得失敗時はnull）
   */
  async getRate(pairId) {
    const pair = getPairById(pairId);
    if (!pair) {
      console.error(`Unknown pair ID: ${pairId}`);
      return null;
    }

    // キャッシュチェック
    const cached = this.getCached(pairId);
    if (cached !== null) {
      console.log(`[Cache Hit] ${pairId}: ${cached}`);
      return cached;
    }

    // 重複リクエスト防止（同時に同じペアを取得しようとした場合）
    if (this.pendingRequests.has(pairId)) {
      console.log(`[Pending] ${pairId} - waiting for existing request`);
      return this.pendingRequests.get(pairId);
    }

    // APIタイプに応じて取得メソッド振り分け
    let ratePromise;
    switch (pair.type) {
      case 'forex':
        ratePromise = this.getForexRate(pair);
        break;
      case 'commodity':
        ratePromise = this.getCommodityRate(pair);
        break;
      case 'crypto':
        ratePromise = this.getCryptoRate(pair);
        break;
      case 'stock':
        ratePromise = this.getStockRate(pair);
        break;
      default:
        console.error(`Unknown pair type: ${pair.type}`);
        return null;
    }

    // リクエスト管理
    this.pendingRequests.set(pairId, ratePromise);

    try {
      const rate = await ratePromise;
      if (rate !== null) {
        this.setCache(pairId, rate);
      }
      return rate;
    } catch (error) {
      console.error(`Failed to get rate for ${pairId}:`, error);
      return null;
    } finally {
      this.pendingRequests.delete(pairId);
    }
  }

  /**
   * 為替レート取得（Frankfurter API）
   * 
   * https://www.frankfurter.app/
   */
  async getForexRate(pair) {
    try {
      // USD/JPY形式からベース通貨と決済通貨を抽出
      const base = pair.apiSymbol.substring(0, 3);
      const quote = pair.apiSymbol.substring(3, 6);

      const url = `https://api.frankfurter.app/latest?from=${base}&to=${quote}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Frankfurter API error: ${response.status}`);
      }

      const data = await response.json();
      const rate = data.rates[quote];

      console.log(`[Forex] ${pair.displayName}: ${rate}`);
      return rate || null;
    } catch (error) {
      console.error(`Forex rate fetch failed for ${pair.displayName}:`, error);
      return null;
    }
  }

  /**
   * 仮想通貨レート取得（CoinGecko API）
   * 
   * https://www.coingecko.com/api/documentation
   */
  async getCryptoRate(pair) {
    try {
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${pair.apiSymbol}&vs_currencies=usd`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json();
      const rate = data[pair.apiSymbol]?.usd;

      console.log(`[Crypto] ${pair.displayName}: ${rate}`);
      return rate || null;
    } catch (error) {
      console.error(`Crypto rate fetch failed for ${pair.displayName}:`, error);
      return null;
    }
  }

  /**
   * コモディティ（GOLD等）レート取得
   * 
   * 現時点ではCoinGeckoのPAXG（金連動トークン）を利用
   */
  async getCommodityRate(pair) {
    try {
      // GOLD専用処理（PAX Gold利用）
      if (pair.id === 'XAUUSD') {
        const url = 'https://api.coingecko.com/api/v3/simple/price?ids=pax-gold&vs_currencies=usd';
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`CoinGecko API error: ${response.status}`);
        }

        const data = await response.json();
        const rate = data['pax-gold']?.usd;

        console.log(`[Commodity] ${pair.displayName}: ${rate}`);
        return rate || null;
      }

      return null;
    } catch (error) {
      console.error(`Commodity rate fetch failed for ${pair.displayName}:`, error);
      return null;
    }
  }

  /**
   * 株式レート取得
   * 
   * ※無料APIが制限的なため、現時点では未実装（将来的にαVantage等を統合予定）
   */
  async getStockRate(pair) {
    console.warn(`Stock rate fetching not yet implemented for ${pair.displayName}`);
    
    // 一時的なダミー値（実際の取引では手動入力を促す）
    if (pair.id === 'NIKKEI225') {
      // 日経225の概算値（実際は手動入力が必要）
      return 38000; // ダミー値
    }
    
    return null;
  }

  /**
   * キャッシュから取得
   */
  getCached(pairId) {
    const cached = this.cache.get(pairId);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > this.cacheExpiry) {
      // 期限切れ
      this.cache.delete(pairId);
      return null;
    }

    return cached.rate;
  }

  /**
   * キャッシュに保存
   */
  setCache(pairId, rate) {
    this.cache.set(pairId, {
      rate,
      timestamp: Date.now()
    });
  }

  /**
   * キャッシュクリア
   */
  clearCache() {
    this.cache.clear();
    console.log('[Cache] Cleared all cached rates');
  }

  /**
   * キャッシュ有効期限を設定
   * 
   * @param {number} seconds - 秒数
   */
  setCacheExpiry(seconds) {
    this.cacheExpiry = seconds * 1000;
    console.log(`[Cache] Expiry set to ${seconds} seconds`);
  }
}

// シングルトンインスタンスをエクスポート
export const rateService = new RateService();

// クラスもエクスポート（テスト用）
export default RateService;

