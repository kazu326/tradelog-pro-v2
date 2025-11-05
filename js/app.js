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
 * マジックリンク認証のトークン処理
 */
async function handleAuthCallback() {
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const access_token = hashParams.get('access_token');
  const refresh_token = hashParams.get('refresh_token');

  console.log('🔍 認証チェック:', { access_token: !!access_token });

  if (access_token) {
    try {
      const { data, error } = await supabaseClient.auth.setSession({
        access_token,
        refresh_token
      });

      if (error) throw error;

      console.log('✅ マジックリンクでログイン成功');
      
      // URLからトークンを削除（セキュリティ対策）
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // 認証チェックを実行（メイン画面を表示）
      await checkAuth();

    } catch (error) {
      console.error('❌ ログインエラー:', error);
      alert('ログインに失敗しました: ' + error.message);
    }
  }
}

/**
 * アプリ起動
 */
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 TradeLog Pro starting...');
  
  // マジックリンクのトークンチェック（最優先）
  await handleAuthCallback();
  
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
          <div id="tab-analytics" class="tab-pane">
            <h2>📊 分析</h2>
            <p>統計グラフ・勝率表示は今後実装予定...</p>
          </div>
          <div id="tab-ai-analysis" class="tab-pane"></div>
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
