/**
 * アプリケーション初期化
 */
import { supabaseClient, getCurrentUser, getUserProfile, onAuthStateChange, signOut } from './core/supabase-client.js';
import { initTradeRecord } from './features/trade-record.js';
import { initLotCalculator } from './features/lot-calculator.js';
import { initAIAnalysis } from './features/ai-analysis.js';

// グローバル状態
let currentUser = null;
let userProfile = null;
let currentTab = 'record';

/**
 * アプリ起動
 */
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 TradeLog Pro starting...');
  
  // 認証状態監視
  onAuthStateChange(handleAuthChange);
  
  // 初回ロード時の認証チェック
  await checkAuth();
});

/**
 * 認証状態チェック
 */
async function checkAuth() {
  const user = await getCurrentUser();
  
  if (!user) {
    showLoginScreen();
    return;
  }
  
  currentUser = user;
  userProfile = await getUserProfile(user.id);
  
  // プロフィールがない場合は作成
  if (!userProfile) {
    await createUserProfile(user.id, user.email);
    userProfile = await getUserProfile(user.id);
  }
  
  showMainApp();
}

/**
 * 認証状態変化ハンドラ
 */
function handleAuthChange(event, session) {
  console.log('Auth state changed:', event);
  
  if (event === 'SIGNED_IN') {
    checkAuth();
  } else if (event === 'SIGNED_OUT') {
    showLoginScreen();
  }
}

/**
 * ユーザープロフィール作成
 */
async function createUserProfile(userId, email) {
  const { error } = await supabaseClient
    .from('users')
    .insert([{
      id: userId,
      email: email,
      plan: 'free'
    }]);
  
  if (error) {
    console.error('Error creating user profile:', error);
    throw error;
  }
}

/**
 * ログイン画面表示
 */
function showLoginScreen() {
  document.body.innerHTML = `
    <div class="login-container">
      <div class="login-box">
        <h1>TradeLog Pro</h1>
        <p>FXトレード記録・AI分析アプリ</p>
        
        <div class="login-form">
          <h2>ログイン / 新規登録</h2>
          <input type="email" id="email-input" placeholder="メールアドレス" />
          <button id="magic-link-btn" class="btn-primary">
            マジックリンクを送信
          </button>
          <p class="help-text">
            メールアドレスに届くリンクをクリックしてログイン
          </p>
        </div>
      </div>
    </div>
  `;
  
  // イベントリスナー
  document.getElementById('magic-link-btn').addEventListener('click', sendMagicLink);
}

/**
 * マジックリンク送信
 */
async function sendMagicLink() {
  const email = document.getElementById('email-input').value.trim();
  
  if (!email) {
    alert('メールアドレスを入力してください');
    return;
  }
  
  const btn = document.getElementById('magic-link-btn');
  btn.disabled = true;
  btn.textContent = '送信中...';
  
  try {
    const { error } = await supabaseClient.auth.signInWithOtp({
      email: email,
      options: {
        emailRedirectTo: window.location.origin
      }
    });
    
    if (error) throw error;
    
    alert(`${email} にログインリンクを送信しました！\nメールを確認してください。`);
  } catch (error) {
    console.error('Error sending magic link:', error);
    alert('エラーが発生しました: ' + error.message);
    btn.disabled = false;
    btn.textContent = 'マジックリンクを送信';
  }
}

/**
 * メインアプリ表示
 */
function showMainApp() {
  document.body.innerHTML = `
    <div class="app-container">
      <header class="app-header">
        <h1>TradeLog Pro</h1>
        <div class="user-info">
          <span>${currentUser.email}</span>
          <span class="plan-badge">${userProfile.plan}</span>
          <button id="logout-btn">ログアウト</button>
        </div>
      </header>
      
      <main class="app-main">
        <div class="tabs">
          <button class="tab-btn active" data-tab="record">記録</button>
          <button class="tab-btn" data-tab="analytics">📊 分析</button>
          <button class="tab-btn tab-btn--highlight" data-tab="ai-analysis">🤖 AI分析</button>
          <button class="tab-btn" data-tab="settings">設定</button>
        </div>
        
        <div class="tab-content">
          <div id="tab-record" class="tab-pane active"></div>
          <div id="tab-analytics" class="tab-pane">
            <h2>📊 分析</h2>
            <p>統計グラフ・勝率表示は今後実装予定...</p>
          </div>
          <div id="tab-ai-analysis" class="tab-pane">
            <div class="ai-analysis-hero">
              <h2>🤖 AI分析アシスタント</h2>
              <p class="hero-description">
                あなたのトレードデータを最先端AIが分析。<br>
                プロトレーダー級のアドバイスを即座に取得できます。
              </p>
            </div>
            
            <div class="ai-analysis-main-section">
              <h3>✨ 分析を開始</h3>
              <p class="section-description">
                ボタンをクリックすると、詳細な分析プロンプトが自動生成され、<br>
                クリップボードにコピーされます。AIチャットに貼り付けるだけ！
              </p>
              
              <div class="ai-provider-grid">
                <button class="btn btn--primary ai-provider-card" data-provider="chatgpt">
                  <span class="provider-icon">💬</span>
                  <div class="provider-info">
                    <strong>ChatGPT</strong>
                    <small>GPT-4で詳細分析</small>
                  </div>
                </button>
                
                <button class="btn btn--primary ai-provider-card" data-provider="claude">
                  <span class="provider-icon">🧠</span>
                  <div class="provider-info">
                    <strong>Claude</strong>
                    <small>Anthropicの最新AI</small>
                  </div>
                </button>
                
                <button class="btn btn--primary ai-provider-card" data-provider="gemini">
                  <span class="provider-icon">✨</span>
                  <div class="provider-info">
                    <strong>Gemini</strong>
                    <small>Googleの次世代AI</small>
                  </div>
                </button>
              </div>
              
              <div class="ai-options-card">
                <h4>📋 分析オプション</h4>
                <div class="options-grid">
                  <label class="option-item">
                    <input type="checkbox" id="includeNotes" checked>
                    <div class="option-content">
                      <strong>メモ・感情分析</strong>
                      <small>トレード時のメモから心理状態を分析</small>
                    </div>
                  </label>
                  
                  <label class="option-item">
                    <input type="checkbox" id="includePairAnalysis" checked>
                    <div class="option-content">
                      <strong>通貨ペア別分析</strong>
                      <small>各通貨ペアの得意/不得意を特定</small>
                    </div>
                  </label>
                  
                  <label class="option-item">
                    <input type="checkbox" id="includeTimeAnalysis">
                    <div class="option-content">
                      <strong>時間帯別分析</strong>
                      <small>東京/ロンドン/NY時間のパフォーマンス比較</small>
                    </div>
                  </label>
                  
                  <label class="option-item">
                    <input type="checkbox" id="includeRiskAnalysis" checked>
                    <div class="option-content">
                      <strong>リスク管理分析</strong>
                      <small>ロットサイズ・損切り設定の適切性評価</small>
                    </div>
                  </label>
                  
                  <label class="option-item">
                    <input type="checkbox" id="includeGoals">
                    <div class="option-content">
                      <strong>目標設定支援</strong>
                      <small>具体的な月間目標と行動計画を提案</small>
                    </div>
                  </label>
                </div>
              </div>
              
              <div class="help-card">
                <h4>💡 使い方</h4>
                <ol class="step-list">
                  <li>分析したい項目をチェック</li>
                  <li>使いたいAIのボタンをクリック</li>
                  <li>AIチャットが開いたら <kbd>Ctrl+V</kbd> で貼り付け</li>
                  <li>送信して詳細な分析結果を受け取る</li>
                </ol>
                
                <div class="tip-box">
                  <strong>💡 Tip:</strong> トレードデータが多いほど、AIの分析精度が向上します。
                  最低10件以上のトレード記録を推奨します。
                </div>
              </div>
            </div>
            
            <div class="ai-sample-section">
              <h3>📝 生成されるプロンプト例</h3>
              <div class="sample-prompt-container">
                <pre class="prompt-preview"><code># FXトレード分析依頼

あなたはプロのFXトレーダー兼コーチです。
以下の私のトレードデータを分析し、具体的な改善提案をお願いします。

## 📊 基本統計
- 総トレード数: 25件
- 勝率: 64.0%
- 総損益: +45,230円
- プロフィットファクター: 2.15
...（続く）</code></pre>
              </div>
              <p class="sample-note">
                ※ 実際のプロンプトは、あなたのトレードデータに基づいて自動生成されます。
              </p>
            </div>
          </div>
          <div id="tab-settings" class="tab-pane">
            <h2>設定</h2>
            <p>Day 4で実装予定...</p>
          </div>
        </div>
      </main>
    </div>
  `;
  
  // イベントリスナー
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await signOut();
  });
  
  // タブ切替
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tab = e.target.dataset.tab;
      switchTab(tab);
    });
  });

  // 初期タブの内容を読み込み
  loadTabContent('record');
}

/**
 * タブ切替
 */
function switchTab(tabName) {
  currentTab = tabName;
  
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.remove('active');
  });
  
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById(`tab-${tabName}`).classList.add('active');

  // タブの内容を読み込み
  loadTabContent(tabName);
}

/**
 * タブの内容を読み込み
 */
async function loadTabContent(tabName) {
  const container = document.getElementById(`tab-${tabName}`);
  
  if (tabName === 'record') {
    await initTradeRecord(container);
  } else if (tabName === 'analytics') {
    // 統計グラフ・勝率表示のみ（AI分析は独立タブに移動）
  } else if (tabName === 'ai-analysis') {
    await initAIAnalysis(container);
  } else if (tabName === 'settings') {
    initLotCalculator(container);
  }
}

// グローバルエクスポート（デバッグ用）
window.app = {
  currentUser: () => currentUser,
  userProfile: () => userProfile
};
