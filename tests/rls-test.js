/**
 * Supabase RLS (Row Level Security) テストスクリプト
 * 
 * 目的: 本番環境でRLSポリシーが正しく機能しているか検証
 * 
 * テスト内容:
 * 1. trades テーブル: 自分のデータのみ取得可能か
 * 2. users テーブル: 自分のユーザー情報のみ取得可能か
 * 3. guardrail_settings テーブル: 自分の設定のみ取得可能か
 * 4. 他ユーザーのデータが取得できないか（セキュリティ確認）
 * 
 * 使い方:
 * 1. .env.test ファイルを作成し、テスト用の認証情報を設定
 * 2. node tests/rls-test.js を実行
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// テスト用環境変数を読み込み
dotenv.config({ path: '.env.test' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

// テスト用ユーザー情報（実際のテストユーザーの認証情報を使用）
const TEST_USERS = [
  {
    name: 'User A',
    email: process.env.TEST_USER_A_EMAIL,
    password: process.env.TEST_USER_A_PASSWORD,
  },
  {
    name: 'User B',
    email: process.env.TEST_USER_B_EMAIL,
    password: process.env.TEST_USER_B_PASSWORD,
  }
];

// カラーコード（コンソール出力用）
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// ログヘルパー
const log = {
  success: (msg) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}✗ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ ${msg}${colors.reset}`),
  section: (msg) => console.log(`\n${colors.cyan}${'='.repeat(60)}\n${msg}\n${'='.repeat(60)}${colors.reset}\n`),
};

/**
 * Supabaseクライアントを作成
 */
function createSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase URL or Anon Key is missing in environment variables');
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

/**
 * ユーザーでログイン
 */
async function loginUser(supabase, email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(`Login failed: ${error.message}`);
  }

  return data.user;
}

/**
 * ログアウト
 */
async function logoutUser(supabase) {
  await supabase.auth.signOut();
}

/**
 * テスト1: trades テーブルのRLS検証
 */
async function testTradesRLS(supabase, currentUser, otherUserIds) {
  log.section(`TEST: trades テーブルのRLS検証 (User: ${currentUser.email})`);

  // 1. 自分のデータを取得（成功すべき）
  log.info('1. 自分のトレードデータを取得...');
  const { data: myTrades, error: myError } = await supabase
    .from('trades')
    .select('*')
    .eq('user_id', currentUser.id);

  if (myError) {
    log.error(`自分のデータ取得失敗: ${myError.message}`);
    return false;
  }

  log.success(`自分のデータ取得成功: ${myTrades.length}件`);

  // 2. 他ユーザーのデータを取得試行（失敗すべき）
  for (const otherUserId of otherUserIds) {
    log.info(`2. 他ユーザー(${otherUserId})のデータ取得試行...`);
    const { data: otherTrades, error: otherError } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', otherUserId);

    if (otherError) {
      log.warning(`他ユーザーデータ取得エラー: ${otherError.message}`);
    }

    if (!otherTrades || otherTrades.length === 0) {
      log.success('RLS正常: 他ユーザーのデータは取得できませんでした');
    } else {
      log.error(`RLS異常: 他ユーザーのデータが${otherTrades.length}件取得できました！`);
      return false;
    }
  }

  // 3. user_id指定なしで全件取得試行（自分のデータのみ返るべき）
  log.info('3. user_id指定なしで全件取得試行...');
  const { data: allTrades, error: allError } = await supabase
    .from('trades')
    .select('*')
    .limit(100);

  if (allError) {
    log.error(`全件取得エラー: ${allError.message}`);
    return false;
  }

  const hasOtherUserData = allTrades.some(trade => trade.user_id !== currentUser.id);
  if (hasOtherUserData) {
    log.error('RLS異常: 他ユーザーのデータが含まれています！');
    return false;
  }

  log.success(`RLS正常: 自分のデータのみ取得 (${allTrades.length}件)`);

  return true;
}

/**
 * テスト2: users テーブルのRLS検証
 */
async function testUsersRLS(supabase, currentUser, otherUserIds) {
  log.section(`TEST: users テーブルのRLS検証 (User: ${currentUser.email})`);

  // 1. 自分のユーザー情報を取得（成功すべき）
  log.info('1. 自分のユーザー情報を取得...');
  const { data: myUser, error: myError } = await supabase
    .from('users')
    .select('*')
    .eq('id', currentUser.id)
    .single();

  if (myError) {
    log.error(`自分のユーザー情報取得失敗: ${myError.message}`);
    return false;
  }

  log.success('自分のユーザー情報取得成功');

  // 2. 他ユーザーの情報を取得試行（失敗すべき）
  for (const otherUserId of otherUserIds) {
    log.info(`2. 他ユーザー(${otherUserId})の情報取得試行...`);
    const { data: otherUser, error: otherError } = await supabase
      .from('users')
      .select('*')
      .eq('id', otherUserId)
      .single();

    if (otherError && otherError.code === 'PGRST116') {
      log.success('RLS正常: 他ユーザーの情報は取得できませんでした');
    } else if (otherUser) {
      log.error('RLS異常: 他ユーザーの情報が取得できました！');
      return false;
    }
  }

  // 3. 全ユーザー取得試行（自分のみ返るべき）
  log.info('3. 全ユーザー取得試行...');
  const { data: allUsers, error: allError } = await supabase
    .from('users')
    .select('*')
    .limit(100);

  if (allError) {
    log.error(`全ユーザー取得エラー: ${allError.message}`);
    return false;
  }

  if (allUsers.length > 1 || (allUsers.length === 1 && allUsers[0].id !== currentUser.id)) {
    log.error('RLS異常: 他ユーザーの情報が含まれています！');
    return false;
  }

  log.success('RLS正常: 自分のユーザー情報のみ取得');

  return true;
}

/**
 * テスト3: guardrail_settings テーブルのRLS検証
 */
async function testGuardrailSettingsRLS(supabase, currentUser, otherUserIds) {
  log.section(`TEST: guardrail_settings テーブルのRLS検証 (User: ${currentUser.email})`);

  // 1. 自分の設定を取得（成功すべき）
  log.info('1. 自分のガードレール設定を取得...');
  const { data: mySettings, error: myError } = await supabase
    .from('guardrail_settings')
    .select('*')
    .eq('user_id', currentUser.id);

  if (myError) {
    log.error(`自分の設定取得失敗: ${myError.message}`);
    return false;
  }

  log.success(`自分の設定取得成功: ${mySettings.length}件`);

  // 2. 他ユーザーの設定を取得試行（失敗すべき）
  for (const otherUserId of otherUserIds) {
    log.info(`2. 他ユーザー(${otherUserId})の設定取得試行...`);
    const { data: otherSettings, error: otherError } = await supabase
      .from('guardrail_settings')
      .select('*')
      .eq('user_id', otherUserId);

    if (otherError) {
      log.warning(`他ユーザー設定取得エラー: ${otherError.message}`);
    }

    if (!otherSettings || otherSettings.length === 0) {
      log.success('RLS正常: 他ユーザーの設定は取得できませんでした');
    } else {
      log.error(`RLS異常: 他ユーザーの設定が${otherSettings.length}件取得できました！`);
      return false;
    }
  }

  // 3. user_id指定なしで全件取得試行（自分の設定のみ返るべき）
  log.info('3. user_id指定なしで全件取得試行...');
  const { data: allSettings, error: allError } = await supabase
    .from('guardrail_settings')
    .select('*')
    .limit(100);

  if (allError) {
    log.error(`全件取得エラー: ${allError.message}`);
    return false;
  }

  const hasOtherUserData = allSettings.some(setting => setting.user_id !== currentUser.id);
  if (hasOtherUserData) {
    log.error('RLS異常: 他ユーザーの設定が含まれています！');
    return false;
  }

  log.success(`RLS正常: 自分の設定のみ取得 (${allSettings.length}件)`);

  return true;
}

/**
 * メインテスト実行
 */
async function runTests() {
  console.log('\n');
  log.section('🔒 Supabase RLS セキュリティテスト開始');

  // 環境変数チェック
  if (!TEST_USERS[0].email || !TEST_USERS[0].password || 
      !TEST_USERS[1].email || !TEST_USERS[1].password) {
    log.error('テストユーザーの認証情報が.env.testに設定されていません');
    log.info('以下の環境変数を設定してください:');
    log.info('  TEST_USER_A_EMAIL, TEST_USER_A_PASSWORD');
    log.info('  TEST_USER_B_EMAIL, TEST_USER_B_PASSWORD');
    process.exit(1);
  }

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
  };

  try {
    // User A でテスト
    log.section(`👤 User A (${TEST_USERS[0].email}) でテスト開始`);
    const supabaseA = createSupabaseClient();
    const userA = await loginUser(supabaseA, TEST_USERS[0].email, TEST_USERS[0].password);
    log.success(`User A ログイン成功 (ID: ${userA.id})`);

    // User B でテスト用クライアント作成
    const supabaseB = createSupabaseClient();
    const userB = await loginUser(supabaseB, TEST_USERS[1].email, TEST_USERS[1].password);
    log.success(`User B ログイン成功 (ID: ${userB.id})`);
    await logoutUser(supabaseB);

    // User A で各テーブルのRLS検証
    const otherUserIds = [userB.id];

    results.total += 3;
    if (await testTradesRLS(supabaseA, userA, otherUserIds)) results.passed++;
    else results.failed++;

    if (await testUsersRLS(supabaseA, userA, otherUserIds)) results.passed++;
    else results.failed++;

    if (await testGuardrailSettingsRLS(supabaseA, userA, otherUserIds)) results.passed++;
    else results.failed++;

    await logoutUser(supabaseA);

    // User B でテスト
    log.section(`👤 User B (${TEST_USERS[1].email}) でテスト開始`);
    const supabaseB2 = createSupabaseClient();
    const userB2 = await loginUser(supabaseB2, TEST_USERS[1].email, TEST_USERS[1].password);
    log.success(`User B ログイン成功 (ID: ${userB2.id})`);

    const otherUserIdsB = [userA.id];

    results.total += 3;
    if (await testTradesRLS(supabaseB2, userB2, otherUserIdsB)) results.passed++;
    else results.failed++;

    if (await testUsersRLS(supabaseB2, userB2, otherUserIdsB)) results.passed++;
    else results.failed++;

    if (await testGuardrailSettingsRLS(supabaseB2, userB2, otherUserIdsB)) results.passed++;
    else results.failed++;

    await logoutUser(supabaseB2);

  } catch (error) {
    log.error(`テスト実行エラー: ${error.message}`);
    console.error(error);
    process.exit(1);
  }

  // 結果サマリー
  log.section('📊 テスト結果サマリー');
  console.log(`総テスト数: ${results.total}`);
  console.log(`${colors.green}成功: ${results.passed}${colors.reset}`);
  console.log(`${colors.red}失敗: ${results.failed}${colors.reset}`);

  if (results.failed === 0) {
    log.success('\n🎉 すべてのRLSテストに合格しました！');
    process.exit(0);
  } else {
    log.error('\n❌ 一部のテストが失敗しました。RLSポリシーを確認してください。');
    process.exit(1);
  }
}

// テスト実行
runTests();

