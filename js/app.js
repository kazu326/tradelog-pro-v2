/**
 * アプリケーション初期化
 */
import { supabaseClient, getCurrentUser, getUserProfile, onAuthStateChange, signOut } from './core/supabase-client.js';
import { initTradeRecord } from './features/trade-record.js';
import { initLotCalculator, initAccountSettings } from './features/lot-calculator.js';
import { initAIAnalysis } from './features/ai-analysis.js';
import { initAnalytics } from './features/analytics/index.js';
import { showToast } from './ui/toast.js';
import { refreshProgressUI, listenProgressUpdates } from './core/progression.js';
import { el } from './utils/dom.js';

// グローバル状態
let currentUser = null;
let userProfile = null;
let currentTab = 'record';
let aiPanelOpen = false;

const AI_PANEL_CONTENT_CHILDREN = [
  el('div', { className: 'ai-panel-hero' },
    el('div', { className: 'ai-panel-hero__level' },
      el('div', { className: 'ai-progress' },
        el('div', { className: 'ai-progress__level' },
          el('span', { className: 'ai-progress__label' }, 'Lv'),
          el('span', { className: 'ai-progress__value', id: 'ai-progress-level' }, '1')
        ),
        el('div', { className: 'ai-progress__details' },
          el('div', { className: 'ai-progress__meter' },
            el('div', { className: 'ai-progress__meter-bar', id: 'ai-progress-meter' })
          ),
          el('div', { className: 'ai-progress__next' },
            '次のレベルまで ', el('span', { id: 'ai-progress-remaining' }, '0'), ' pt'
          )
        )
      )
    ),
    el('div', { className: 'ai-panel-hero__avatar' },
      el('img', { src: 'images/ai-panel-hero__avatar-placeholder.svg', alt: 'AIキャラクター' })
    ),
    el('div', { className: 'ai-panel-hero__copy' },
      el('h3', {}, 'AIがトレードを瞬時に診断'),
      el('p', {},
        '最新モデルが勝率・リスク・改善ポイントを抽出。',
        el('br'),
        '具体的なアクションプランで次のトレードを後押しします。'
      )
    )
  ),

  el('div', { className: 'ai-analysis-main-section' },
    el('h3', { className: 'ai-analysis-main-section__title' },
      el('span', { className: 'ai-analysis-main-section__icon', 'aria-hidden': 'true' },
        el('img', { src: 'images/ai-analyzer-main.svg', alt: '', width: 36, height: 36 })
      ),
      el('span', {}, '分析を開始')
    ),
    el('p', { className: 'section-description' },
      'ボタンをクリックすると、詳細な分析プロンプトが自動生成され、',
      el('br'),
      'クリップボードにコピーされます。AIチャットに貼り付けるだけ！'
    ),
    
    el('div', { className: 'ai-provider-grid' },
      createAiProviderButton('chatgpt', 'images/ai-provider-chatgpt.svg', 'ChatGPT', 'GPT-4で詳細分析'),
      createAiProviderButton('claude', 'images/ai-provider-claude.svg', 'Claude', 'Anthropicの最新AI'),
      createAiProviderButton('gemini', 'images/ai-provider-gemini.svg', 'Gemini', 'Googleの次世代AI')
    ),
    
    el('div', { className: 'ai-options-card' },
      el('h4', {}, '📋 分析オプション'),
      el('div', { className: 'options-grid' },
        createOptionItem('includeNotes', 'メモ・感情分析', 'トレード時のメモから心理状態を分析', true),
        createOptionItem('includePairAnalysis', '通貨ペア別分析', '各通貨ペアの得意/不得意を特定', true),
        createOptionItem('includeTimeAnalysis', '時間帯別分析', '東京/ロンドン/NY時間のパフォーマンス比較'),
        createOptionItem('includeRiskAnalysis', 'リスク管理分析', 'ロットサイズ・損切り設定の適切性評価', true),
        createOptionItem('includeGoals', '目標設定支援', '具体的な月間目標と行動計画を提案')
      )
    ),
    
    el('div', { className: 'help-card' },
      el('h4', {}, '💡 使い方'),
      el('ol', { className: 'step-list' },
        el('li', {}, '分析したい項目をチェック'),
        el('li', {}, '使いたいAIのボタンをクリック'),
        el('li', {}, 'AIチャットが開いたら ', el('kbd', {}, 'Ctrl+V'), ' で貼り付け'),
        el('li', {}, '送信して詳細な分析結果を受け取る')
      ),
      
      el('div', { className: 'tip-box' },
        el('strong', {}, '💡 Tip:'),
        ' トレードデータが多いほど、AIの分析精度が向上します。最低10件以上のトレード記録を推奨します。'
      )
    )
  ),
  
  el('div', { className: 'ai-sample-section' },
    el('h3', {}, '📝 生成されるプロンプト例'),
    el('div', { className: 'sample-prompt-container' },
      el('pre', { className: 'prompt-preview' },
        el('code', {}, `# FXトレード分析依頼

あなたはプロのFXトレーダー兼コーチです。
以下の私のトレードデータを分析し、具体的な改善提案をお願いします。

## 📊 基本統計
- 総トレード数: 25件
- 勝率: 64.0%
- 総損益: +45,230円
- プロフィットファクター: 2.15
...（続く）`)
      )
    ),
    el('p', { className: 'sample-note' },
      '※ 実際のプロンプトは、あなたのトレードデータに基づいて自動生成されます。'
    )
  )
];

function createAiProviderButton(provider, imgSrc, imgAlt, description) {
  return el('button', { className: 'ai-provider-card', dataset: { provider }, type: 'button' },
    el('span', { className: 'ai-provider-card__badge' },
      el('img', { src: imgSrc, alt: imgAlt, width: 164, height: 48 })
    ),
    el('span', { className: 'ai-provider-card__description' }, description)
  );
}

function createOptionItem(id, title, desc, checked = false) {
  return el('label', { className: 'option-item' },
    el('input', { type: 'checkbox', id, checked }),
    el('div', { className: 'option-content' },
      el('strong', {}, title),
      el('small', {}, desc)
    )
  );
}

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
    document.body.innerHTML = '';
    document.body.appendChild(
      el('div', { style: { padding: '20px', textAlign: 'center' } },
        el('h1', {}, 'エラーが発生しました'),
        el('p', {}, error.message || '不明なエラー'),
        el('button', { onClick: () => location.reload() }, 'ページをリロード')
      )
    );
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
  document.body.innerHTML = '';
  
  const loginContainer = el('div', { className: 'login-container' },
    el('div', { className: 'login-box' },
      el('h1', {}, 'TradeLog Pro'),
      el('p', {}, 'FXトレード記録・AI分析アプリ'),
      
      el('div', { className: 'login-form' },
        el('h2', {}, 'ログイン / 新規登録'),
        el('input', { type: 'email', id: 'email-input', placeholder: 'メールアドレス' }),
        el('button', { id: 'magic-link-btn', className: 'btn-primary', onClick: sendMagicLink }, 'マジックリンクを送信'),
        el('div', { className: 'login-divider' },
          el('span', {}, 'または')
        ),
        el('button', { id: 'google-login-btn', className: 'btn-secondary', onClick: signInWithGoogle }, 'Googleでログイン'),
        el('p', { className: 'help-text' }, 'メールアドレスに届くリンクをクリックしてログイン')
      )
    )
  );

  document.body.appendChild(loginContainer);
}

/**
 * マジックリンク送信
 */
async function sendMagicLink() {
  const emailInput = document.getElementById('email-input');
  const email = emailInput.value.trim();
  
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
 * Googleでログイン
 */
async function signInWithGoogle() {
  const btn = document.getElementById('google-login-btn');
  
  if (!btn) return;
  
  const originalLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Googleにリダイレクト中...';
  
  try {
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account'
        }
      }
    });
    
    if (error) throw error;
    // 正常時はSupabase側でリダイレクトが発生する
  } catch (error) {
    console.error('Error signing in with Google:', error);
    alert('Googleログインでエラーが発生しました: ' + error.message);
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
}

/**
 * メインアプリ表示
 */
function showMainApp() {
  document.body.innerHTML = '';

  const header = el('header', { className: 'app-header' },
    el('div', { className: 'app-header__row' },
      el('h1', {}, 'TradeLog Pro'),
      el('div', { className: 'user-info' },
        el('span', {}, currentUser.email),
        el('span', { className: 'plan-badge' }, userProfile.plan),
        el('button', { id: 'logout-btn', onClick: async () => await signOut() }, 'ログアウト')
      )
    ),
    el('button', { className: 'ai-launch-btn', dataset: { action: 'open-ai-panel' }, onClick: (e) => { e.preventDefault(); toggleAiPanel(); } },
      el('span', { className: 'ai-launch-btn__icon-slot' },
        el('img', { src: 'images/ai-launch-btn__icon-slot.svg', alt: 'AIキャラクター' })
      ),
      el('span', { className: 'ai-launch-btn__text' }, 'AI分析アシスタントを開く')
    ),
    el('div', { id: 'ai-panel-container' })
  );

  const tabs = el('div', { className: 'tabs' },
    el('button', { className: 'tab-btn active', dataset: { tab: 'record' }, onClick: (e) => switchTab(e.target.dataset.tab) }, '記録'),
    el('button', { className: 'tab-btn', dataset: { tab: 'analytics' }, onClick: (e) => switchTab(e.target.dataset.tab) }, '📊 分析'),
    el('button', { className: 'tab-btn', dataset: { tab: 'lot' }, onClick: (e) => switchTab(e.target.dataset.tab) }, 'ロット計算'),
    el('button', { className: 'tab-btn', dataset: { tab: 'settings' }, onClick: (e) => switchTab(e.target.dataset.tab) }, '設定')
  );

  const tabContent = el('div', { className: 'tab-content' },
    el('div', { id: 'tab-record', className: 'tab-pane active' }),
    el('div', { id: 'tab-analytics', className: 'tab-pane' }),
    el('div', { id: 'tab-lot', className: 'tab-pane' }),
    el('div', { id: 'tab-settings', className: 'tab-pane' },
      el('h2', {}, '設定'),
      el('p', {}, 'Day 4で実装予定...')
    )
  );

  const main = el('main', { className: 'app-main' },
    tabs,
    tabContent
  );

  const appContainer = el('div', { className: 'app-container' },
    header,
    main
  );
  
  document.body.appendChild(appContainer);

  ensureAiPanel();
  setAiPanelOpen(false);
  listenProgressUpdates();
  refreshProgressUI();
  
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
    
    if (!tabButton || !tabPane) {
      console.error(`❌ タブが見つかりません: ${tabName}`);
      return;
    }
    
    tabButton.classList.add('active');
    tabPane.classList.add('active');
    
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
    const container = document.getElementById(`tab-${tabName}`);
    if (!container) return;
    
    // コンテンツが空の場合のみ初期化する（既に初期化済みの場合はスキップ）
    if (container.hasChildNodes()) {
        // settingsタブなどは静的なのでリロード不要だが、
        // recordタブなどはデータ更新が必要かもしれない。
        // ここでは簡易的に、recordタブだけは毎回initを呼んでデータをリフレッシュさせる挙動だったため、
        // hasChildNodesがあってもinitを呼ぶべきケースがある。
        // 元の実装では毎回innerHTMLを上書きしていた可能性があるが、
        // initTradeRecord等はinnerHTMLをクリアしてから構築しているので、再度呼んでも問題ないはず。
    }
    
    if (tabName === 'record') {
      await initTradeRecord(container);
    } else if (tabName === 'analytics') {
      // analyticsもinnerHTMLをクリアする実装になっているか確認が必要だが、
      // 一旦呼び出す。
      await initAnalytics(container);
    } else if (tabName === 'lot') {
      await initLotCalculator(container);
    } else if (tabName === 'settings') {
      await initAccountSettings(container);
    }
    
  } catch (error) {
    console.error(`❌ タブコンテンツ読み込みエラー (${tabName}):`, error);
  }
}

// グローバルエクスポート（デバッグ用）
window.app = {
  currentUser: () => currentUser,
  userProfile: () => userProfile
};

function ensureAiPanel() {
  const container = document.getElementById('ai-panel-container');
  if (!container || container.dataset.initialized === '1') return;
  
  container.innerHTML = ''; // クリア
  
  const overlay = el('div', { className: 'ai-panel-overlay', id: 'ai-panel-overlay', onClick: () => setAiPanelOpen(false) });
  
  const panel = el('div', { className: 'ai-panel', id: 'ai-panel', 'aria-hidden': 'true' },
    el('div', { className: 'ai-panel__header' },
      el('div', {},
        el('span', { className: 'ai-panel__badge' }, 'AIアシスタント'),
        el('h2', {}, '高度分析モード')
      ),
      el('button', { className: 'ai-panel__close', id: 'close-ai-panel-btn', 'aria-label': '閉じる', onClick: () => setAiPanelOpen(false) }, '✕')
    ),
    el('div', { className: 'ai-panel__content', id: 'ai-panel-content' },
      // 配列を展開して渡す
      ...AI_PANEL_CONTENT_CHILDREN
    )
  );
  
  container.appendChild(overlay);
  container.appendChild(panel);

  container.dataset.initialized = '1';
  const content = document.getElementById('ai-panel-content');
  if (content) {
    // AIパネルの内部イベントなどの初期化
    // 注: initAIAnalysisが内部でinnerHTMLを使っている場合はそこもリファクタ対象になるが、
    // ここではコンテナを渡すだけに留める
    initAIAnalysis(content);
    refreshProgressUI(content);
  }
}

function toggleAiPanel() {
  ensureAiPanel();
  setAiPanelOpen(!aiPanelOpen);
}

function setAiPanelOpen(isOpen) {
  aiPanelOpen = isOpen;
  const panel = document.getElementById('ai-panel');
  const overlay = document.getElementById('ai-panel-overlay');
  if (!panel || !overlay) return;
  if (isOpen) {
    panel.classList.add('ai-panel--open');
    overlay.classList.add('ai-panel-overlay--visible');
    panel.setAttribute('aria-hidden', 'false');
    document.body.classList.add('ai-panel-open');
    refreshProgressUI();
  } else {
    panel.classList.remove('ai-panel--open');
    overlay.classList.remove('ai-panel-overlay--visible');
    panel.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('ai-panel-open');
  }
}
