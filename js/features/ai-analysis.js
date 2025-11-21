/**
 * AI分析アシスタント機能
 */
import { getTrades } from '../core/storage.js';
import { calculateStats, calculateDrawdown, getStatsByPair } from '../core/analytics.js';
import { showToast } from '../ui/toast.js';
import { addProgress, refreshProgressUI } from '../core/progression.js';
import { el } from '../utils/dom.js';

/**
 * AI分析アシスタント初期化
 */
export async function initAIAnalysis(container) {
  console.log('🤖 initAIAnalysis 開始');
  
  if (!container) {
    console.error('❌ AI分析: コンテナが見つかりません');
    return;
  }
  
  // HTMLは app.js の showMainApp/ensureAiPanel で el() を使って生成されるようになったため、
  // ここではイベントリスナーの登録（委譲）を行うだけでよい。
  // 以前のような innerHTML チェックは不要。
  
  const existingHandler = container._aiAnalysisHandler;
  if (existingHandler) {
    console.log('既存のイベントハンドラーを削除');
    container.removeEventListener('click', existingHandler);
  }
  
  // 新しいイベントハンドラーを作成
  let isProcessing = false;
  let lastTouchTime = 0;
  
  const handleButtonClick = (e, provider) => {
    if (isProcessing) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    console.log('AI分析ボタンがタップされました:', provider);
    
    isProcessing = true;
    
    // ボタンの視覚的フィードバック
    const button = e.target.closest('[data-provider]');
    if (button) {
      button.style.opacity = '0.6';
      button.style.transform = 'scale(0.95)';
    }
    
    handleAIAnalysis(provider)
      .finally(() => {
        if (button) {
          setTimeout(() => {
            button.style.opacity = '';
            button.style.transform = '';
            isProcessing = false;
          }, 500);
        } else {
          setTimeout(() => {
            isProcessing = false;
          }, 500);
        }
      });
  };
  
  // タッチイベント
  container.addEventListener('touchstart', (e) => {
    const button = e.target.closest('[data-provider]');
    if (button && !isProcessing) {
      const now = Date.now();
      if (now - lastTouchTime < 300) {
        return;
      }
      lastTouchTime = now;
      
      const provider = button.dataset.provider;
      handleButtonClick(e, provider);
    }
  }, { passive: false });
  
  // クリックイベント
  const clickHandler = (e) => {
    if (Date.now() - lastTouchTime < 500) {
      return;
    }
    
    const button = e.target.closest('[data-provider]');
    if (button && !isProcessing) {
      const provider = button.dataset.provider;
      handleButtonClick(e, provider);
    }
  };
  
  container.addEventListener('click', clickHandler, { passive: false });
  container._aiAnalysisHandler = clickHandler;
  
  console.log('✅ initAIAnalysis 完了');
}

/**
 * AI分析処理
 */
async function handleAIAnalysis(provider) {
  try {
    const trades = await getTrades(50);
    
    if (!trades || trades.length === 0) {
      showToast('分析するトレードデータがありません', 'error');
      return;
    }
    
    const includeNotes = document.getElementById('includeNotes')?.checked || false;
    const includePairAnalysis = document.getElementById('includePairAnalysis')?.checked || false;
    const includeTimeAnalysis = document.getElementById('includeTimeAnalysis')?.checked || false;
    const includeRiskAnalysis = document.getElementById('includeRiskAnalysis')?.checked || false;
    const includeGoals = document.getElementById('includeGoals')?.checked || false;
    
    const prompt = generateAIPrompt(trades, {
      includeNotes,
      includePairAnalysis,
      includeTimeAnalysis,
      includeRiskAnalysis,
      includeGoals
    });
    
    const existingPrompt = document.getElementById('ai-prompt-display');
    if (existingPrompt) {
      existingPrompt.remove();
    }
    
    // プロンプト表示モーダルの作成（el関数使用）
    createPromptModal(prompt, provider);
    
    addProgress('ai_analysis');
    refreshProgressUI();
    
    try {
      await copyToClipboard(prompt);
      showToast('プロンプトをコピーしました！', 'success');
    } catch (copyError) {
      console.warn('自動コピーに失敗しましたが、手動でコピーできます:', copyError);
    }
    
  } catch (error) {
    console.error('Error in AI analysis:', error);
    showToast('エラーが発生しました', 'error');
  }
}

/**
 * プロンプト表示モーダル作成
 */
function createPromptModal(prompt, provider) {
  const urls = {
    chatgpt: 'https://chat.openai.com/',
    claude: 'https://claude.ai/new',
    gemini: 'https://gemini.google.com/'
  };

  const handleCopy = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const btn = e.currentTarget;
    try {
      await copyToClipboard(prompt);
      btn.textContent = '✓ コピー完了';
      btn.style.background = '#28a745';
      setTimeout(() => {
        btn.textContent = '📋 コピー';
        btn.style.background = '#007bff';
      }, 2000);
    } catch (err) {
      btn.textContent = '✗ コピー失敗';
      btn.style.background = '#dc3545';
      setTimeout(() => {
        btn.textContent = '📋 コピー';
        btn.style.background = '#007bff';
      }, 2000);
    }
  };

  const handleOpenAi = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const url = urls[provider];
    if (url) {
      const link = el('a', { href: url, target: '_blank', rel: 'noopener noreferrer', style: { display: 'none' } });
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleClose = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    document.getElementById('ai-prompt-display')?.remove();
  };

  const promptDisplay = el('div', {
    id: 'ai-prompt-display',
    onClick: (e) => { if (e.target.id === 'ai-prompt-display') handleClose(); },
    style: {
      position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      width: '90%', maxWidth: '600px', maxHeight: '70vh',
      background: 'rgba(0, 0, 0, 0.95)', zIndex: '10000', padding: '20px',
      borderRadius: '10px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
      color: 'white', display: 'flex', flexDirection: 'column'
    }
  },
    el('h2', { style: { color: 'white', marginBottom: '15px', fontSize: '18px', textAlign: 'center' } }, '生成されたプロンプト'),
    el('textarea', {
      readOnly: true,
      value: prompt,
      style: {
        flex: '1', minHeight: '200px', maxHeight: '50vh', background: '#1a1a1a',
        padding: '15px', borderRadius: '5px', border: '1px solid #333',
        color: '#e0e0e0', fontFamily: 'monospace', fontSize: '12px', lineHeight: '1.5',
        whiteSpace: 'pre-wrap', wordWrap: 'break-word', resize: 'none', overflowY: 'auto',
        marginBottom: '15px'
      }
    }),
    el('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } },
      el('button', {
        onClick: handleCopy,
        style: {
          flex: '1', minWidth: '120px', padding: '12px 20px', background: '#007bff',
          color: 'white', border: 'none', borderRadius: '5px', fontSize: '14px', fontWeight: 'bold',
          cursor: 'pointer', touchAction: 'manipulation', webkitTapHighlightColor: 'transparent'
        }
      }, '📋 コピー'),
      el('button', {
        onClick: handleOpenAi,
        style: {
          flex: '1', minWidth: '120px', padding: '12px 20px', background: '#28a745',
          color: 'white', border: 'none', borderRadius: '5px', fontSize: '14px', fontWeight: 'bold',
          cursor: 'pointer', touchAction: 'manipulation', webkitTapHighlightColor: 'transparent'
        }
      }, `🚀 ${provider.toUpperCase()}を開く`),
      el('button', {
        onClick: handleClose,
        style: {
          flex: '1', minWidth: '120px', padding: '12px 20px', background: '#6c757d',
          color: 'white', border: 'none', borderRadius: '5px', fontSize: '14px', fontWeight: 'bold',
          cursor: 'pointer', touchAction: 'manipulation', webkitTapHighlightColor: 'transparent'
        }
      }, '✕ 閉じる')
    )
  );

  document.body.appendChild(promptDisplay);
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
 * クリップボードにコピー（モバイル対応）
 */
async function copyToClipboard(text) {
  try {
    // モダンブラウザのClipboard API（モバイル対応）
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return;
      } catch (clipboardError) {
        console.warn('Clipboard API failed, trying fallback:', clipboardError);
        // フォールバックに続く
      }
    }
    
    // フォールバック: execCommand（モバイル対応）
    const textArea = el('textarea', {
      value: text,
      readOnly: true,
      'aria-hidden': 'true',
      style: {
        position: 'fixed', left: '0', top: '0', width: '2em', height: '2em',
        padding: '0', border: 'none', outline: 'none', boxShadow: 'none',
        background: 'transparent', opacity: '0'
      }
    });
    
    document.body.appendChild(textArea);
    
    // モバイル対応: iOS Safariでの選択
    if (navigator.userAgent.match(/ipad|iphone/i)) {
      const range = document.createRange();
      range.selectNodeContents(textArea);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      textArea.setSelectionRange(0, 999999);
    } else {
      textArea.select();
    }
    
    try {
      const successful = document.execCommand('copy');
      if (!successful) {
        throw new Error('execCommand failed');
      }
    } catch (err) {
      console.error('Fallback copy failed:', err);
      throw new Error('クリップボードへのコピーに失敗しました');
    } finally {
      document.body.removeChild(textArea);
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
