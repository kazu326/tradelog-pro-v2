/**
 * アプリケーション初期化
 */
import { supabaseClient, getCurrentUser, getUserProfile, onAuthStateChange, signOut } from './core/supabase-client.js';
import { initTradeRecord } from './features/trade-record.js';
import { initLotCalculator } from './features/lot-calculator.js';
import { initAIAnalysis } from './features/ai-analysis.js';
import { initAnalytics } from './features/analytics.js';
import { showToast } from './ui/toast.js';

// グローバル状態
let currentUser = null;
let userProfile = null;
let currentTab = 'record';

// マジックリンク認証のトークン処理

async function handleAuthCallback() {
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const access_token = hashParams.get('access_token');
  const refresh_token = hashParams.get('refresh_token');

  if (access_token) {
    try {
      const { data, error } = await supabaseClient.auth.setSession({
        access_token,
        refresh_token
      });

      if (error) throw error;

      console.log('✅ ログイン成功');
      
      const authContainer = document.querySelector('.auth-container');
      const appContainer = document.querySelector('.app-container');
      
      if (authContainer) authContainer.style.display = 'none';
      if (appContainer) appContainer.style.display = 'block';

      showToast('ログインしました', 'success');
      window.history.replaceState({}, document.title, window.location.pathname);

    } catch (error) {
      console.error('❌ ログインエラー:', error);
      showToast('ログインに失敗しました', 'error');
    }
  }
}

/**
 * アプリ起動
 */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('🚀 TradeLog Pro starting...');
    
    // マジックリンクのトークンチェック（最優先）
    await handleAuthCallback();
    
    // 既存セッションのチェック
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (session) {
      const authContainer = document.querySelector('.auth-container');
      const appContainer = document.querySelector('.app-container');
      
      if (authContainer) authContainer.style.display = 'none';
      if (appContainer) appContainer.style.display = 'block';
    }
    
    // 認証状態監視
    onAuthStateChange(handleAuthChange);
    
    // 初回ロード時の認証チェック
    await checkAuth();
  } catch (error) {
    console.error('❌ アプリ起動エラー:', error);
    document.body.innerHTML = `
      <div style="padding: 20px; text-align: center;">
        <h1>エラーが発生しました</h1>
        <p>${error.message || '不明なエラー'}</p>
        <button onclick="location.reload()">ページをリロード</button>
      </div>
    `;
  }
});

/**
 * 認証状態チェック
 */
async function checkAuth() {
  try {
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
  } catch (error) {
    console.error('❌ 認証チェックエラー:', error);
    // エラーが発生した場合はログイン画面を表示
    showLoginScreen();
  }
}

/**
 * 認証状態変化ハンドラ
 */
function handleAuthChange(event, session) {
  console.log('Auth state changed:', event);
  
  if (event === 'SIGNED_IN') {
    // 非同期関数を呼び出す際はエラーハンドリングを追加
    checkAuth().catch(error => {
      console.error('❌ 認証状態変化時のエラー:', error);
    });
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
        emailRedirectTo: 'https://kazu326.github.io/tradelog-pro-v2/'
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
          <div id="tab-analytics" class="tab-pane"></div>
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
  loadTabContent('record').catch(error => {
    console.error('初期タブ読み込みエラー:', error);
  });
}

/**
 * タブ切替
 */
function switchTab(tabName) {
  try {
    console.log(`🔄 タブ切替開始: ${tabName}`);
    currentTab = tabName;
    
    // 全タブボタンから active を削除
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    
    // 全タブペインから active を削除
    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.remove('active');
    });
    
    const tabButton = document.querySelector(`[data-tab="${tabName}"]`);
    const tabPane = document.getElementById(`tab-${tabName}`);
    
    console.log('タブボタン:', tabButton);
    console.log('タブペイン:', tabPane);
    
    if (!tabButton || !tabPane) {
      console.error(`❌ タブが見つかりません: ${tabName}`);
      console.error('利用可能なタブボタン:', Array.from(document.querySelectorAll('.tab-btn')).map(b => b.dataset.tab));
      console.error('利用可能なタブペイン:', Array.from(document.querySelectorAll('.tab-pane')).map(p => p.id));
      return;
    }
    
    tabButton.classList.add('active');
    tabPane.classList.add('active');
    
    console.log(`✅ タブがアクティブになりました: ${tabName}`);
    console.log('タブペインの表示スタイル:', window.getComputedStyle(tabPane).display);

    // タブの内容を読み込み
    loadTabContent(tabName).catch(error => {
      console.error(`❌ タブコンテンツ読み込みエラー (${tabName}):`, error);
    });
  } catch (error) {
    console.error('❌ タブ切替エラー:', error);
    console.error('エラー詳細:', error.stack);
  }
}

/**
 * タブの内容を読み込み
 */
async function loadTabContent(tabName) {
  try {
    console.log(`📂 タブコンテンツ読み込み開始: ${tabName}`);
    const container = document.getElementById(`tab-${tabName}`);
    
    if (!container) {
      console.error(`❌ タブコンテナが見つかりません: tab-${tabName}`);
      return;
    }
    
    console.log(`✅ コンテナが見つかりました:`, container);
    console.log(`コンテナの内容（最初の200文字）:`, container.innerHTML.substring(0, 200));
    
    if (tabName === 'record') {
      console.log('📝 記録タブを初期化中...');
      await initTradeRecord(container);
    } else if (tabName === 'analytics') {
      console.log('📊 分析タブを初期化中...');
      await initAnalytics(container);
    } else if (tabName === 'ai-analysis') {
      console.log('🤖 AI分析タブを初期化中...');
      await initAIAnalysis(container);
    } else if (tabName === 'settings') {
      console.log('⚙️ 設定タブを初期化中...');
      initLotCalculator(container);
    }
    
    console.log(`✅ タブコンテンツ読み込み完了: ${tabName}`);
  } catch (error) {
    console.error(`❌ タブコンテンツ読み込みエラー (${tabName}):`, error);
    console.error('エラー詳細:', error.stack);
    // エラーが発生した場合でも、ユーザーには表示を継続
  }
}

// グローバルエクスポート（デバッグ用）
window.app = {
  currentUser: () => currentUser,
  userProfile: () => userProfile
};

