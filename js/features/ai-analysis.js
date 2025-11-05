/**
 * AI分析アシスタント機能
 */
import { getTrades } from '../core/storage.js';
import { calculateStats, calculateDrawdown, getStatsByPair } from '../core/analytics.js';
import { showToast } from '../ui/toast.js';

/**
 * AI分析アシスタント初期化
 */
export async function initAIAnalysis(container) {
  // HTMLは app.html に移動したので、イベントリスナーのみ設定
  const buttons = container.querySelectorAll('[data-provider]');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => handleAIAnalysis(btn.dataset.provider));
  });
}

/**
 * AI分析処理
 */
async function handleAIAnalysis(provider) {
  try {
    // トレードデータ取得
    const trades = await getTrades(50);
    
    if (!trades || trades.length === 0) {
      showToast('分析するトレードデータがありません', 'error');
      return;
    }
    
    // オプション取得
    const includeNotes = document.getElementById('includeNotes')?.checked || false;
    const includePairAnalysis = document.getElementById('includePairAnalysis')?.checked || false;
    const includeTimeAnalysis = document.getElementById('includeTimeAnalysis')?.checked || false;
    const includeRiskAnalysis = document.getElementById('includeRiskAnalysis')?.checked || false;
    const includeGoals = document.getElementById('includeGoals')?.checked || false;
    
    // プロンプト生成
    const prompt = generateAIPrompt(trades, {
      includeNotes,
      includePairAnalysis,
      includeTimeAnalysis,
      includeRiskAnalysis,
      includeGoals
    });
    
    // クリップボードにコピー
    await copyToClipboard(prompt);
    
    // トーストを先に表示
    showToast('プロンプトをコピーしました！AIチャットに貼り付けてください', 'success');
    
    // 0.5秒後に別タブ起動（トースト表示時間を確保）
    setTimeout(() => {
      const urls = {
        chatgpt: 'https://chat.openai.com/',
        claude: 'https://claude.ai/new',
        gemini: 'https://gemini.google.com/'
      };
      
      const url = urls[provider];
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    }, 1000);
    
  } catch (error) {
    console.error('Error in AI analysis:', error);
    showToast('エラーが発生しました', 'error');
  }
}

/**
 * AIプロンプト生成
 */
function generateAIPrompt(trades, options) {
  const stats = calculateStats(trades);
  const drawdown = calculateDrawdown(trades);
  const recentTrades = trades.slice(0, 10);
  
  let prompt = `# FXトレード分析依頼

以下のトレードデータを分析して、改善点やパターンを教えてください。

## 基本統計

- **総トレード数**: ${stats.totalTrades}件
- **勝率**: ${stats.winRate.toFixed(1)}%
- **総損益**: ${stats.totalPnl > 0 ? '+' : ''}${stats.totalPnl.toLocaleString()}円
- **勝ちトレード数**: ${stats.wins}件
- **負けトレード数**: ${stats.losses}件
- **プロフィットファクター**: ${stats.profitFactor.toFixed(2)}
- **平均勝ち**: ${stats.averageWin.toFixed(0)}円
- **平均負け**: ${stats.averageLoss.toFixed(0)}円
- **最大勝ち**: ${stats.largestWin.toFixed(0)}円
- **最大負け**: ${stats.largestLoss.toFixed(0)}円
- **最大ドローダウン**: ${drawdown.max.toFixed(2)}%
- **現在のドローダウン**: ${drawdown.current.toFixed(2)}%
`;

  // リスクリワード比の計算
  if (stats.averageLoss !== 0) {
    const riskRewardRatio = Math.abs(stats.averageWin / stats.averageLoss);
    prompt += `- **リスクリワード比**: ${riskRewardRatio.toFixed(2)}:1\n`;
  }
  
  prompt += `\n## 直近10件のトレード詳細\n\n`;
  
  recentTrades.forEach((trade, index) => {
    const date = new Date(trade.created_at).toLocaleString('ja-JP');
    prompt += `${index + 1}. **${trade.pair}** ${trade.direction} | `;
    prompt += `ロット: ${trade.lot_size} | `;
    prompt += `エントリー: ${trade.entry_price} | `;
    prompt += `決済: ${trade.exit_price} | `;
    prompt += `Pips: ${trade.pips} | `;
    prompt += `損益: ${trade.pnl > 0 ? '+' : ''}${trade.pnl.toLocaleString()}円`;
    if (options.includeNotes && trade.notes) {
      prompt += ` | メモ: ${trade.notes}`;
    }
    prompt += ` | 日時: ${date}\n`;
  });
  
  // 通貨ペア別分析
  if (options.includePairAnalysis) {
    const pairStats = getStatsByPair(trades);
    prompt += `\n## 通貨ペア別統計\n\n`;
    pairStats.forEach(stat => {
      prompt += `- **${stat.pair}**: ${stat.tradeCount}件 | `;
      prompt += `総損益: ${stat.totalPnl > 0 ? '+' : ''}${stat.totalPnl.toLocaleString()}円 | `;
      prompt += `勝率: ${stat.winRate.toFixed(1)}%\n`;
    });
  }
  
  // 時間帯別分析
  if (options.includeTimeAnalysis) {
    const timeStats = calculateTimeStats(trades);
    prompt += `\n## 時間帯別統計\n\n`;
    timeStats.forEach(stat => {
      prompt += `- **${stat.timeRange}**: ${stat.tradeCount}件 | `;
      prompt += `総損益: ${stat.totalPnl > 0 ? '+' : ''}${stat.totalPnl.toLocaleString()}円 | `;
      prompt += `勝率: ${stat.winRate.toFixed(1)}%\n`;
    });
  }
  
  // リスク管理分析
  if (options.includeRiskAnalysis) {
    const avgLotSize = trades.reduce((sum, t) => sum + (t.lot_size || 0), 0) / trades.length;
    const avgPips = trades.reduce((sum, t) => sum + Math.abs(t.pips || 0), 0) / trades.length;
    prompt += `\n## リスク管理情報\n\n`;
    prompt += `- **平均ロットサイズ**: ${avgLotSize.toFixed(2)}ロット\n`;
    prompt += `- **平均Pips（絶対値）**: ${avgPips.toFixed(1)}pips\n`;
    prompt += `- **最大ドローダウン**: ${drawdown.max.toFixed(2)}%\n`;
    if (stats.averageLoss !== 0) {
      const riskRewardRatio = Math.abs(stats.averageWin / stats.averageLoss);
      prompt += `- **リスクリワード比**: ${riskRewardRatio.toFixed(2)}:1\n`;
    }
  }
  
  prompt += `\n## 分析をお願いしたい点\n\n`;
  prompt += `1. 現在のトレードスタイルの強みと弱みは何ですか？\n`;
  prompt += `2. 勝率とプロフィットファクターのバランスは適切ですか？\n`;
  prompt += `3. リスクリワード比は最適ですか？改善すべき点はありますか？\n`;
  prompt += `4. 通貨ペアや時間帯に偏りはありますか？分散すべきですか？\n`;
  prompt += `5. ドローダウンが大きい場合、どのような対策が考えられますか？\n`;
  prompt += `6. 具体的な改善提案を3つ以上挙げてください。\n`;
  
  // 目標設定支援
  if (options.includeGoals) {
    prompt += `\n## 目標設定支援をお願いします\n\n`;
    prompt += `以下の点について、具体的な目標と行動計画を提案してください：\n\n`;
    prompt += `- 月間目標トレード数\n`;
    prompt += `- 月間目標利益額\n`;
    prompt += `- 改善すべき具体的な行動（3つ以上）\n`;
    prompt += `- 次月に取り組むべき最重要課題\n`;
  }
  
  prompt += `\n---\n`;
  prompt += `※上記のデータを基に、実践的なアドバイスをお願いします。\n`;
  
  return prompt;
}

/**
 * 時間帯別統計計算
 */
function calculateTimeStats(trades) {
  const timeRanges = {
    '朝 (6-12時)': { trades: [], totalPnl: 0, wins: 0 },
    '午後 (12-18時)': { trades: [], totalPnl: 0, wins: 0 },
    '夜 (18-24時)': { trades: [], totalPnl: 0, wins: 0 },
    '深夜 (0-6時)': { trades: [], totalPnl: 0, wins: 0 }
  };
  
  trades.forEach(trade => {
    const date = new Date(trade.created_at);
    const hour = date.getHours();
    
    let timeRange;
    if (hour >= 6 && hour < 12) {
      timeRange = '朝 (6-12時)';
    } else if (hour >= 12 && hour < 18) {
      timeRange = '午後 (12-18時)';
    } else if (hour >= 18 && hour < 24) {
      timeRange = '夜 (18-24時)';
    } else {
      timeRange = '深夜 (0-6時)';
    }
    
    timeRanges[timeRange].trades.push(trade);
    timeRanges[timeRange].totalPnl += trade.pnl;
    if (trade.pnl > 0) {
      timeRanges[timeRange].wins++;
    }
  });
  
  return Object.entries(timeRanges)
    .map(([timeRange, data]) => ({
      timeRange,
      tradeCount: data.trades.length,
      totalPnl: data.totalPnl,
      winRate: data.trades.length > 0 
        ? (data.wins / data.trades.length) * 100 
        : 0
    }))
    .filter(stat => stat.tradeCount > 0)
    .sort((a, b) => b.totalPnl - a.totalPnl);
}

/**
 * クリップボードにコピー
 */
async function copyToClipboard(text) {
  try {
    // モダンブラウザのClipboard API
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    
    // フォールバック: execCommand
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      document.execCommand('copy');
      textArea.remove();
    } catch (err) {
      console.error('Fallback copy failed:', err);
      textArea.remove();
      throw new Error('クリップボードへのコピーに失敗しました');
    }
  } catch (error) {
    console.error('Copy to clipboard failed:', error);
    throw error;
  }
}

/**
 * AIチャットを開く
 */
function openAIChat(provider) {
  const urls = {
    chatgpt: 'https://chat.openai.com/',
    claude: 'https://claude.ai/chat',
    gemini: 'https://gemini.google.com/app'
  };
  
  const url = urls[provider];
  if (url) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

