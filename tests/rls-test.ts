/**
 * Supabase RLS (Row Level Security) 自動テストスクリプト (TypeScript版)
 * 
 * 【テストの目的】
 * - 各ユーザーが自分のデータのみ取得できることを確認
 * - 他ユーザーのデータが絶対に取得できないことを確認
 * - RLSポリシーが正しく機能していることを検証
 * 
 * 【対象テーブル】
 * 1. trades - トレード記録
 * 2. users - ユーザー情報
 * 3. guardrail_settings - ガードレール設定
 * 
 * 【テストフロー】
 * 1. ダミーユーザーA でログイン（JWT取得）
 * 2. ダミーユーザーB でログイン（JWT取得）
 * 3. User A で自分のデータ取得（成功すべき）
 * 4. User A で User B のデータ取得試行（失敗すべき）
 * 5. User B で自分のデータ取得（成功すべき）
 * 6. User B で User A のデータ取得試行（失敗すべき）
 * 
 * 【実行方法】
 * ```bash
 * # 1. 環境変数ファイルを作成
 * cp tests/env.test.example .env.test
 * 
 * # 2. .env.test を編集（Supabase接続情報とテストユーザー情報を設定）
 * 
 * # 3. TypeScriptをインストール（まだの場合）
 * npm install -D typescript ts-node @types/node
 * 
 * # 4. テスト実行
 * npx ts-node tests/rls-test.ts
 * 
 * # または package.json にスクリプトを追加して実行
 * npm run test:rls:ts
 * ```
 * 
 * 【事前準備】
 * - Supabase プロジェクトで2つのテストユーザーを作成
 * - 各ユーザーでいくつかのテストデータを作成
 * - RLSポリシーが設定されていること
 */

import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// 環境変数を読み込み
dotenv.config({ path: '.env.test' });

// ========================================
// 型定義
// ========================================

interface TestUser {
  name: string;
  email: string;
  password: string;
}

interface TestResult {
  testName: string;
  passed: boolean;
  message: string;
  details?: any;
}

interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
}

// Supabaseのテーブル型定義
interface Trade {
  id: string;
  user_id: string;
  pair: string;
  entry_date: string;
  [key: string]: any;
}

interface UserProfile {
  id: string;
  email?: string;
  created_at?: string;
  [key: string]: any;
}

interface GuardrailSettings {
  id: string;
  user_id: string;
  max_risk_per_trade?: number;
  [key: string]: any;
}

// ========================================
// 環境変数の取得と検証
// ========================================

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

const TEST_USERS: TestUser[] = [
  {
    name: 'User A',
    email: process.env.TEST_USER_A_EMAIL || '',
    password: process.env.TEST_USER_A_PASSWORD || '',
  },
  {
    name: 'User B',
    email: process.env.TEST_USER_B_EMAIL || '',
    password: process.env.TEST_USER_B_PASSWORD || '',
  }
];

// ========================================
// ログ出力用のカラーコードとヘルパー
// ========================================

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

const log = {
  success: (msg: string) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
  error: (msg: string) => console.log(`${colors.red}✗ ${msg}${colors.reset}`),
  warning: (msg: string) => console.log(`${colors.yellow}⚠ ${msg}${colors.reset}`),
  info: (msg: string) => console.log(`${colors.blue}ℹ ${msg}${colors.reset}`),
  section: (msg: string) => console.log(`\n${colors.cyan}${'='.repeat(70)}\n${msg}\n${'='.repeat(70)}${colors.reset}\n`),
  subsection: (msg: string) => console.log(`\n${colors.magenta}${msg}${colors.reset}\n`),
};

// ========================================
// Supabase クライアント作成
// ========================================

/**
 * Supabaseクライアントを作成
 * @returns SupabaseClient インスタンス
 */
function createSupabaseClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      '環境変数が設定されていません。.env.test ファイルを確認してください。\n' +
      '必要な変数: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY'
    );
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ========================================
// 認証関連の関数
// ========================================

/**
 * ユーザーでログイン（パスワード認証）
 * マジックリンク認証の場合は、事前に取得したトークンを使用することも可能
 * 
 * @param supabase - Supabaseクライアント
 * @param email - ユーザーのメールアドレス
 * @param password - ユーザーのパスワード
 * @returns ログインしたユーザー情報
 */
async function loginUser(
  supabase: SupabaseClient,
  email: string,
  password: string
): Promise<User> {
  log.info(`ログイン試行: ${email}`);
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    throw new Error(`ログイン失敗: ${error?.message || 'ユーザーが取得できませんでした'}`);
  }

  log.success(`ログイン成功: ${email} (ID: ${data.user.id.substring(0, 8)}...)`);
  return data.user;
}

/**
 * ログアウト
 * 
 * @param supabase - Supabaseクライアント
 */
async function logoutUser(supabase: SupabaseClient): Promise<void> {
  await supabase.auth.signOut();
}

/**
 * 現在のアクセストークン（JWT）を取得
 * 
 * @param supabase - Supabaseクライアント
 * @returns アクセストークン
 */
async function getAccessToken(supabase: SupabaseClient): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

// ========================================
// RLSテスト関数: trades テーブル
// ========================================

/**
 * trades テーブルのRLS検証
 * 
 * テスト内容:
 * 1. 自分のトレードデータが取得できるか
 * 2. 他ユーザーのトレードデータが取得できないか
 * 3. user_id指定なしで全件取得した場合、自分のデータのみか
 * 
 * @param supabase - Supabaseクライアント
 * @param currentUser - 現在ログイン中のユーザー
 * @param otherUserId - 他ユーザーのID
 * @returns テスト結果の配列
 */
async function testTradesRLS(
  supabase: SupabaseClient,
  currentUser: User,
  otherUserId: string
): Promise<TestResult[]> {
  log.subsection(`🔍 TEST: trades テーブルのRLS検証`);
  const results: TestResult[] = [];

  // テスト1: 自分のトレードデータを取得
  try {
    log.info('テスト1: 自分のトレードデータを取得...');
    
    const { data: myTrades, error } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', currentUser.id);

    if (error) {
      results.push({
        testName: 'trades: 自分のデータ取得',
        passed: false,
        message: `エラーが発生しました: ${error.message}`,
        details: error,
      });
    } else {
      // データが取得できた、または空配列（データがない場合も正常）
      results.push({
        testName: 'trades: 自分のデータ取得',
        passed: true,
        message: `成功: ${myTrades?.length || 0}件のデータを取得`,
        details: { count: myTrades?.length },
      });
      log.success(`自分のデータ取得成功: ${myTrades?.length || 0}件`);
    }
  } catch (error: any) {
    results.push({
      testName: 'trades: 自分のデータ取得',
      passed: false,
      message: `例外が発生: ${error.message}`,
      details: error,
    });
  }

  // テスト2: 他ユーザーのトレードデータを取得試行（失敗すべき）
  try {
    log.info(`テスト2: 他ユーザー(${otherUserId.substring(0, 8)}...)のデータ取得試行...`);
    
    const { data: otherTrades, error } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', otherUserId);

    // RLSが正しく機能している場合、データは空配列またはエラー
    if (error) {
      // エラーが返る場合もRLS正常
      results.push({
        testName: 'trades: 他ユーザーデータ取得試行',
        passed: true,
        message: `RLS正常: エラーが返されました (${error.message})`,
        details: error,
      });
      log.success('RLS正常: 他ユーザーのデータ取得時にエラー');
    } else if (!otherTrades || otherTrades.length === 0) {
      // 空配列が返る場合もRLS正常
      results.push({
        testName: 'trades: 他ユーザーデータ取得試行',
        passed: true,
        message: 'RLS正常: 空のデータが返されました',
        details: { count: 0 },
      });
      log.success('RLS正常: 他ユーザーのデータは取得できませんでした');
    } else {
      // データが取得できた場合はRLS異常
      results.push({
        testName: 'trades: 他ユーザーデータ取得試行',
        passed: false,
        message: `RLS異常: 他ユーザーのデータが${otherTrades.length}件取得できました！`,
        details: { count: otherTrades.length, data: otherTrades },
      });
      log.error(`RLS異常: 他ユーザーのデータが${otherTrades.length}件取得できました！`);
    }
  } catch (error: any) {
    results.push({
      testName: 'trades: 他ユーザーデータ取得試行',
      passed: false,
      message: `例外が発生: ${error.message}`,
      details: error,
    });
  }

  // テスト3: user_id指定なしで全件取得（自分のデータのみ返るべき）
  try {
    log.info('テスト3: user_id指定なしで全件取得試行...');
    
    const { data: allTrades, error } = await supabase
      .from('trades')
      .select('*')
      .limit(100);

    if (error) {
      results.push({
        testName: 'trades: 全件取得（自分のみか確認）',
        passed: false,
        message: `エラーが発生しました: ${error.message}`,
        details: error,
      });
    } else {
      // 他ユーザーのデータが含まれていないかチェック
      const hasOtherUserData = allTrades?.some(
        (trade: Trade) => trade.user_id !== currentUser.id
      );

      if (hasOtherUserData) {
        results.push({
          testName: 'trades: 全件取得（自分のみか確認）',
          passed: false,
          message: 'RLS異常: 他ユーザーのデータが含まれています！',
          details: { count: allTrades?.length },
        });
        log.error('RLS異常: 他ユーザーのデータが含まれています！');
      } else {
        results.push({
          testName: 'trades: 全件取得（自分のみか確認）',
          passed: true,
          message: `RLS正常: 自分のデータのみ取得 (${allTrades?.length || 0}件)`,
          details: { count: allTrades?.length },
        });
        log.success(`RLS正常: 自分のデータのみ取得 (${allTrades?.length || 0}件)`);
      }
    }
  } catch (error: any) {
    results.push({
      testName: 'trades: 全件取得（自分のみか確認）',
      passed: false,
      message: `例外が発生: ${error.message}`,
      details: error,
    });
  }

  return results;
}

// ========================================
// RLSテスト関数: users テーブル
// ========================================

/**
 * users テーブルのRLS検証
 * 
 * テスト内容:
 * 1. 自分のユーザー情報が取得できるか
 * 2. 他ユーザーの情報が取得できないか
 * 3. 全ユーザー取得時に自分のみか
 * 
 * @param supabase - Supabaseクライアント
 * @param currentUser - 現在ログイン中のユーザー
 * @param otherUserId - 他ユーザーのID
 * @returns テスト結果の配列
 */
async function testUsersRLS(
  supabase: SupabaseClient,
  currentUser: User,
  otherUserId: string
): Promise<TestResult[]> {
  log.subsection(`🔍 TEST: users テーブルのRLS検証`);
  const results: TestResult[] = [];

  // テスト1: 自分のユーザー情報を取得
  try {
    log.info('テスト1: 自分のユーザー情報を取得...');
    
    const { data: myUser, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', currentUser.id)
      .single();

    if (error) {
      results.push({
        testName: 'users: 自分のユーザー情報取得',
        passed: false,
        message: `エラーが発生しました: ${error.message}`,
        details: error,
      });
    } else {
      results.push({
        testName: 'users: 自分のユーザー情報取得',
        passed: true,
        message: '成功: 自分のユーザー情報を取得',
        details: { userId: myUser?.id },
      });
      log.success('自分のユーザー情報取得成功');
    }
  } catch (error: any) {
    results.push({
      testName: 'users: 自分のユーザー情報取得',
      passed: false,
      message: `例外が発生: ${error.message}`,
      details: error,
    });
  }

  // テスト2: 他ユーザーの情報を取得試行（失敗すべき）
  try {
    log.info(`テスト2: 他ユーザー(${otherUserId.substring(0, 8)}...)の情報取得試行...`);
    
    const { data: otherUser, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', otherUserId)
      .single();

    // PGRST116 = Row not found (RLSにより隠されている)
    if (error && error.code === 'PGRST116') {
      results.push({
        testName: 'users: 他ユーザー情報取得試行',
        passed: true,
        message: 'RLS正常: データが見つからないエラー',
        details: error,
      });
      log.success('RLS正常: 他ユーザーの情報は取得できませんでした');
    } else if (error) {
      results.push({
        testName: 'users: 他ユーザー情報取得試行',
        passed: true,
        message: `RLS正常: エラーが返されました (${error.message})`,
        details: error,
      });
      log.success('RLS正常: 他ユーザーの情報取得時にエラー');
    } else if (otherUser) {
      // データが取得できた場合はRLS異常
      results.push({
        testName: 'users: 他ユーザー情報取得試行',
        passed: false,
        message: 'RLS異常: 他ユーザーの情報が取得できました！',
        details: otherUser,
      });
      log.error('RLS異常: 他ユーザーの情報が取得できました！');
    }
  } catch (error: any) {
    results.push({
      testName: 'users: 他ユーザー情報取得試行',
      passed: false,
      message: `例外が発生: ${error.message}`,
      details: error,
    });
  }

  // テスト3: 全ユーザー取得試行（自分のみ返るべき）
  try {
    log.info('テスト3: 全ユーザー取得試行...');
    
    const { data: allUsers, error } = await supabase
      .from('users')
      .select('*')
      .limit(100);

    if (error) {
      results.push({
        testName: 'users: 全ユーザー取得（自分のみか確認）',
        passed: false,
        message: `エラーが発生しました: ${error.message}`,
        details: error,
      });
    } else {
      // 自分以外のユーザーが含まれていないかチェック
      const hasOtherUser = allUsers?.some(
        (user: UserProfile) => user.id !== currentUser.id
      );

      if (hasOtherUser || (allUsers && allUsers.length > 1)) {
        results.push({
          testName: 'users: 全ユーザー取得（自分のみか確認）',
          passed: false,
          message: 'RLS異常: 他ユーザーの情報が含まれています！',
          details: { count: allUsers?.length },
        });
        log.error('RLS異常: 他ユーザーの情報が含まれています！');
      } else {
        results.push({
          testName: 'users: 全ユーザー取得（自分のみか確認）',
          passed: true,
          message: 'RLS正常: 自分のユーザー情報のみ取得',
          details: { count: allUsers?.length },
        });
        log.success('RLS正常: 自分のユーザー情報のみ取得');
      }
    }
  } catch (error: any) {
    results.push({
      testName: 'users: 全ユーザー取得（自分のみか確認）',
      passed: false,
      message: `例外が発生: ${error.message}`,
      details: error,
    });
  }

  return results;
}

// ========================================
// RLSテスト関数: guardrail_settings テーブル
// ========================================

/**
 * guardrail_settings テーブルのRLS検証
 * 
 * テスト内容:
 * 1. 自分の設定が取得できるか
 * 2. 他ユーザーの設定が取得できないか
 * 3. user_id指定なしで全件取得した場合、自分の設定のみか
 * 
 * @param supabase - Supabaseクライアント
 * @param currentUser - 現在ログイン中のユーザー
 * @param otherUserId - 他ユーザーのID
 * @returns テスト結果の配列
 */
async function testGuardrailSettingsRLS(
  supabase: SupabaseClient,
  currentUser: User,
  otherUserId: string
): Promise<TestResult[]> {
  log.subsection(`🔍 TEST: guardrail_settings テーブルのRLS検証`);
  const results: TestResult[] = [];

  // テスト1: 自分の設定を取得
  try {
    log.info('テスト1: 自分のガードレール設定を取得...');
    
    const { data: mySettings, error } = await supabase
      .from('guardrail_settings')
      .select('*')
      .eq('user_id', currentUser.id);

    if (error) {
      results.push({
        testName: 'guardrail_settings: 自分の設定取得',
        passed: false,
        message: `エラーが発生しました: ${error.message}`,
        details: error,
      });
    } else {
      results.push({
        testName: 'guardrail_settings: 自分の設定取得',
        passed: true,
        message: `成功: ${mySettings?.length || 0}件の設定を取得`,
        details: { count: mySettings?.length },
      });
      log.success(`自分の設定取得成功: ${mySettings?.length || 0}件`);
    }
  } catch (error: any) {
    results.push({
      testName: 'guardrail_settings: 自分の設定取得',
      passed: false,
      message: `例外が発生: ${error.message}`,
      details: error,
    });
  }

  // テスト2: 他ユーザーの設定を取得試行（失敗すべき）
  try {
    log.info(`テスト2: 他ユーザー(${otherUserId.substring(0, 8)}...)の設定取得試行...`);
    
    const { data: otherSettings, error } = await supabase
      .from('guardrail_settings')
      .select('*')
      .eq('user_id', otherUserId);

    if (error) {
      results.push({
        testName: 'guardrail_settings: 他ユーザー設定取得試行',
        passed: true,
        message: `RLS正常: エラーが返されました (${error.message})`,
        details: error,
      });
      log.success('RLS正常: 他ユーザーの設定取得時にエラー');
    } else if (!otherSettings || otherSettings.length === 0) {
      results.push({
        testName: 'guardrail_settings: 他ユーザー設定取得試行',
        passed: true,
        message: 'RLS正常: 空のデータが返されました',
        details: { count: 0 },
      });
      log.success('RLS正常: 他ユーザーの設定は取得できませんでした');
    } else {
      results.push({
        testName: 'guardrail_settings: 他ユーザー設定取得試行',
        passed: false,
        message: `RLS異常: 他ユーザーの設定が${otherSettings.length}件取得できました！`,
        details: { count: otherSettings.length, data: otherSettings },
      });
      log.error(`RLS異常: 他ユーザーの設定が${otherSettings.length}件取得できました！`);
    }
  } catch (error: any) {
    results.push({
      testName: 'guardrail_settings: 他ユーザー設定取得試行',
      passed: false,
      message: `例外が発生: ${error.message}`,
      details: error,
    });
  }

  // テスト3: user_id指定なしで全件取得（自分の設定のみ返るべき）
  try {
    log.info('テスト3: user_id指定なしで全件取得試行...');
    
    const { data: allSettings, error } = await supabase
      .from('guardrail_settings')
      .select('*')
      .limit(100);

    if (error) {
      results.push({
        testName: 'guardrail_settings: 全件取得（自分のみか確認）',
        passed: false,
        message: `エラーが発生しました: ${error.message}`,
        details: error,
      });
    } else {
      const hasOtherUserData = allSettings?.some(
        (setting: GuardrailSettings) => setting.user_id !== currentUser.id
      );

      if (hasOtherUserData) {
        results.push({
          testName: 'guardrail_settings: 全件取得（自分のみか確認）',
          passed: false,
          message: 'RLS異常: 他ユーザーの設定が含まれています！',
          details: { count: allSettings?.length },
        });
        log.error('RLS異常: 他ユーザーの設定が含まれています！');
      } else {
        results.push({
          testName: 'guardrail_settings: 全件取得（自分のみか確認）',
          passed: true,
          message: `RLS正常: 自分の設定のみ取得 (${allSettings?.length || 0}件)`,
          details: { count: allSettings?.length },
        });
        log.success(`RLS正常: 自分の設定のみ取得 (${allSettings?.length || 0}件)`);
      }
    }
  } catch (error: any) {
    results.push({
      testName: 'guardrail_settings: 全件取得（自分のみか確認）',
      passed: false,
      message: `例外が発生: ${error.message}`,
      details: error,
    });
  }

  return results;
}

// ========================================
// メインテスト実行関数
// ========================================

/**
 * すべてのRLSテストを実行
 */
async function runAllTests(): Promise<void> {
  console.log('\n');
  log.section('🔒 Supabase RLS セキュリティテスト開始 (TypeScript版)');

  // 環境変数チェック
  if (!TEST_USERS[0].email || !TEST_USERS[0].password ||
      !TEST_USERS[1].email || !TEST_USERS[1].password) {
    log.error('テストユーザーの認証情報が設定されていません');
    log.info('以下の環境変数を .env.test ファイルに設定してください:');
    log.info('  VITE_SUPABASE_URL');
    log.info('  VITE_SUPABASE_ANON_KEY');
    log.info('  TEST_USER_A_EMAIL, TEST_USER_A_PASSWORD');
    log.info('  TEST_USER_B_EMAIL, TEST_USER_B_PASSWORD');
    process.exit(1);
  }

  const summary: TestSummary = {
    total: 0,
    passed: 0,
    failed: 0,
    results: [],
  };

  try {
    // ========================================
    // User A でテスト
    // ========================================
    log.section(`👤 User A (${TEST_USERS[0].email}) でテスト開始`);
    
    const supabaseA = createSupabaseClient();
    const userA = await loginUser(supabaseA, TEST_USERS[0].email, TEST_USERS[0].password);

    // User B のIDを取得するため、一時的にログイン
    const supabaseB = createSupabaseClient();
    const userB = await loginUser(supabaseB, TEST_USERS[1].email, TEST_USERS[1].password);
    const userBId = userB.id;
    await logoutUser(supabaseB);

    log.info(`テスト対象: User A (${userA.id.substring(0, 8)}...) vs User B (${userBId.substring(0, 8)}...)`);

    // User A で各テーブルのRLS検証
    const tradesResultsA = await testTradesRLS(supabaseA, userA, userBId);
    const usersResultsA = await testUsersRLS(supabaseA, userA, userBId);
    const guardrailResultsA = await testGuardrailSettingsRLS(supabaseA, userA, userBId);

    summary.results.push(...tradesResultsA, ...usersResultsA, ...guardrailResultsA);

    await logoutUser(supabaseA);

    // ========================================
    // User B でテスト
    // ========================================
    log.section(`👤 User B (${TEST_USERS[1].email}) でテスト開始`);
    
    const supabaseB2 = createSupabaseClient();
    const userB2 = await loginUser(supabaseB2, TEST_USERS[1].email, TEST_USERS[1].password);
    const userAId = userA.id;

    log.info(`テスト対象: User B (${userB2.id.substring(0, 8)}...) vs User A (${userAId.substring(0, 8)}...)`);

    // User B で各テーブルのRLS検証
    const tradesResultsB = await testTradesRLS(supabaseB2, userB2, userAId);
    const usersResultsB = await testUsersRLS(supabaseB2, userB2, userAId);
    const guardrailResultsB = await testGuardrailSettingsRLS(supabaseB2, userB2, userAId);

    summary.results.push(...tradesResultsB, ...usersResultsB, ...guardrailResultsB);

    await logoutUser(supabaseB2);

    // ========================================
    // 結果集計
    // ========================================
    summary.total = summary.results.length;
    summary.passed = summary.results.filter(r => r.passed).length;
    summary.failed = summary.results.filter(r => !r.passed).length;

  } catch (error: any) {
    log.error(`テスト実行中にエラーが発生しました: ${error.message}`);
    console.error(error);
    process.exit(1);
  }

  // ========================================
  // 結果サマリー表示
  // ========================================
  log.section('📊 テスト結果サマリー');
  
  console.log(`総テスト数: ${summary.total}`);
  console.log(`${colors.green}成功: ${summary.passed}${colors.reset}`);
  console.log(`${colors.red}失敗: ${summary.failed}${colors.reset}`);

  // 失敗したテストの詳細を表示
  if (summary.failed > 0) {
    log.subsection('❌ 失敗したテスト:');
    summary.results
      .filter(r => !r.passed)
      .forEach(result => {
        console.log(`  - ${result.testName}: ${result.message}`);
      });
  }

  // 最終判定
  if (summary.failed === 0) {
    log.success('\n🎉 すべてのRLSテストに合格しました！');
    log.info('本番環境でもRLSが正しく機能しています。');
    process.exit(0);
  } else {
    log.error('\n❌ 一部のテストが失敗しました。');
    log.warning('RLSポリシーを確認し、修正してください。');
    log.info('詳細は tests/README.md を参照してください。');
    process.exit(1);
  }
}

// ========================================
// テスト実行
// ========================================

runAllTests();

