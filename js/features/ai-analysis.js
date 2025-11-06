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
  console.log('🤖 initAIAnalysis 開始');
  console.log('コンテナ:', container);
  
  if (!container) {
    console.error('❌ AI分析: コンテナが見つかりません');
    return;
  }
  
  console.log('コンテナのクラス:', container.className);
  console.log('コンテナのスタイル:', window.getComputedStyle(container).display);
  console.log('コンテナのHTML長:', container.innerHTML.length);
  
  // HTMLは app.js の showMainApp() で生成されているので、イベントリスナーのみ設定
  const buttons = container.querySelectorAll('[data-provider]');
  
  console.log(`🔍 ボタン検索結果: ${buttons.length}個見つかりました`);
  
  if (buttons.length === 0) {
    console.warn('⚠️ AI分析: ボタンが見つかりません');
    console.warn('コンテナの内容（最初の500文字）:', container.innerHTML.substring(0, 500));
    console.warn('コンテナ内の全要素:', container.querySelectorAll('*').length);
    return;
  }
  
  console.log(`✅ AI分析: ${buttons.length}個のボタンにイベントリスナーを設定`);
  
  // イベント委譲を使用して、コンテナレベルでイベントを処理（重複防止）
  // 既存のイベントリスナーを削除
  const existingHandler = container._aiAnalysisHandler;
  if (existingHandler) {
    console.log('既存のイベントハンドラーを削除');
    container.removeEventListener('click', existingHandler);
  }
  
  // 新しいイベントハンドラーを作成（モバイル対応）
  let isProcessing = false; // 重複実行防止
  let touchHandled = false; // タッチイベント処理フラグ
  
  const clickHandler = (e) => {
    // モバイルでタッチイベントが既に処理された場合はスキップ
    if (touchHandled) {
      touchHandled = false; // フラグをリセット
      return;
    }
    
    const button = e.target.closest('[data-provider]');
    if (button && container.contains(button) && !isProcessing) {
      e.preventDefault();
      e.stopPropagation(); // イベントの伝播を停止
      
      const provider = button.dataset.provider;
      console.log('AI分析ボタンがクリックされました:', provider);
      
      isProcessing = true;
      
      // 非同期処理なので、完了後にフラグをリセット
      handleAIAnalysis(provider)
        .finally(() => {
          // 少し遅延を入れてからフラグをリセット（連続クリック防止）
          setTimeout(() => {
            isProcessing = false;
          }, 1000);
        });
    }
  };
  
  container.addEventListener('touchstart', (e) => {
    touchHandled = false;
  }, { passive: true });
  
  container.addEventListener('touchend', (e) => {
    // タッチイベントでも同じ処理を実行
    const button = e.target.closest('[data-provider]');
    if (button && container.contains(button) && !isProcessing && !touchHandled) {
      touchHandled = true;
      e.preventDefault();
      e.stopPropagation();
      
      const provider = button.dataset.provider;
      console.log('AI分析ボタンがタッチされました:', provider);
      
      isProcessing = true;
      
      handleAIAnalysis(provider)
        .finally(() => {
          setTimeout(() => {
            isProcessing = false;
            touchHandled = false;
          }, 1000);
        });
    }
  }, { passive: false });
  
  container.addEventListener('click', clickHandler, { passive: false });
  
  container._aiAnalysisHandler = clickHandler; // 後で削除できるように保存
  
  console.log('✅ initAIAnalysis 完了');
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
    
    // クリップボードにコピー（モバイル対応）
    let copySuccess = false;
    try {
      await copyToClipboard(prompt);
      copySuccess = true;
      showToast('プロンプトをコピーしました！AIチャットに貼り付けてください', 'success');
    } catch (copyError) {
      console.error('コピーエラー:', copyError);
      // モバイルでコピーに失敗した場合でも、プロンプトを表示して続行
      copySuccess = false;
      showToast('コピーできませんでした。プロンプトは下に表示されます', 'warning');
      
      // プロンプトを画面に表示（モバイル用フォールバック）
      const promptDisplay = document.createElement('div');
      promptDisplay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.9);
        z-index: 10000;
        padding: 20px;
        overflow-y: auto;
        color: white;
      `;
      promptDisplay.innerHTML = `
        <div style="max-width: 600px; margin: 0 auto;">
          <h2 style="color: white; margin-bottom: 20px;">生成されたプロンプト</h2>
          <pre style="background: #1a1a1a; padding: 15px; border-radius: 5px; white-space: pre-wrap; word-wrap: break-word; color: #e0e0e0;">${prompt}</pre>
          <button onclick="this.parentElement.parentElement.remove()" style="margin-top: 20px; padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">閉じる</button>
        </div>
      `;
      document.body.appendChild(promptDisplay);
    }
    
    // 別タブ起動（モバイル対応）
    // モバイルではwindow.openがブロックされる可能性があるため、ユーザーアクション内で実行
    const urls = {
      chatgpt: 'https://chat.openai.com/',
      claude: 'https://claude.ai/new',
      gemini: 'https://gemini.google.com/'
    };
    
    const url = urls[provider];
    if (url) {
      // モバイルでは即座に開く（ユーザーアクション内）
      try {
        const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
        // モバイルでポップアップブロックされた場合のフォールバック
        if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
          showToast('ポップアップがブロックされました。リンクを手動で開いてください', 'warning');
          // リンクをクリック可能な要素として表示
          const linkElement = document.createElement('a');
          linkElement.href = url;
          linkElement.target = '_blank';
          linkElement.rel = 'noopener noreferrer';
          linkElement.textContent = `${provider}を開く`;
          linkElement.style.cssText = 'display: block; margin-top: 10px; padding: 10px; background: #007bff; color: white; text-align: center; text-decoration: none; border-radius: 5px;';
          // 適切な場所に追加（例: トーストの近く）
          setTimeout(() => {
            const toast = document.querySelector('.toast');
            if (toast && toast.parentElement) {
              toast.parentElement.appendChild(linkElement);
            }
          }, 100);
        }
      } catch (openError) {
        console.error('Window open error:', openError);
        showToast(`${provider}を開けませんでした。手動で開いてください`, 'error');
      }
    }
    
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
    const textArea = document.createElement('textarea');
    textArea.value = text;
    // モバイルでの表示位置を調整
    textArea.style.position = 'fixed';
    textArea.style.left = '0';
    textArea.style.top = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    textArea.style.opacity = '0';
    textArea.setAttribute('readonly', '');
    textArea.setAttribute('aria-hidden', 'true');
    
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
    // モバイルではコピーに失敗してもエラーを表示せず、続行を許可
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

