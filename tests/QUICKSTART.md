# RLS テスト クイックスタートガイド

## 🚀 5分でRLSテストを実行

### ステップ1: テストユーザーを作成

Supabase Dashboard で2つのテストユーザーを作成します。

1. [Supabase Dashboard](https://app.supabase.com/) にアクセス
2. プロジェクトを選択
3. **Authentication** → **Users** に移動
4. **Add user** をクリック

**User A を作成:**
- Email: `test-user-a@example.com`
- Password: `TestPassword123!`
- **Create user** をクリック

**User B を作成:**
- Email: `test-user-b@example.com`
- Password: `TestPassword456!`
- **Create user** をクリック

### ステップ2: 環境変数ファイルを作成

プロジェクトルートで以下のコマンドを実行:

```bash
cp tests/env.test.example .env.test
```

`.env.test` を編集して実際の値を設定:

```env
# Supabase接続情報（Dashboard → Settings → API から取得）
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# テストユーザーA
TEST_USER_A_EMAIL=test-user-a@example.com
TEST_USER_A_PASSWORD=TestPassword123!

# テストユーザーB
TEST_USER_B_EMAIL=test-user-b@example.com
TEST_USER_B_PASSWORD=TestPassword456!
```

### ステップ3: テストデータを作成（推奨）

より正確なテストのため、各ユーザーでいくつかデータを作成:

**User A でログイン:**
1. アプリにログイン
2. トレードを1〜2件登録
3. ガードレール設定を保存

**User B でログイン:**
1. アプリにログイン
2. トレードを1〜2件登録
3. ガードレール設定を保存

### ステップ4: 依存関係をインストール

```bash
npm install
```

### ステップ5: テストを実行

#### TypeScript版（推奨）

```bash
npm run test:rls:ts
```

#### JavaScript版

```bash
npm run test:rls
```

#### cURL版（Node.js不要）

```bash
# スクリプトを編集
nano tests/rls-test-curl.sh

# 実行権限を付与
chmod +x tests/rls-test-curl.sh

# 実行
./tests/rls-test-curl.sh
```

## 📊 期待される結果

すべてのテストが成功した場合:

```
========================================
🔒 Supabase RLS セキュリティテスト開始
========================================

👤 User A (test-user-a@example.com) でテスト開始
✓ User A ログイン成功 (ID: abc12345...)

🔍 TEST: trades テーブルのRLS検証

ℹ テスト1: 自分のトレードデータを取得...
✓ 自分のデータ取得成功: 2件
ℹ テスト2: 他ユーザー(def67890...)のデータ取得試行...
✓ RLS正常: 他ユーザーのデータは取得できませんでした
ℹ テスト3: user_id指定なしで全件取得試行...
✓ RLS正常: 自分のデータのみ取得 (2件)

🔍 TEST: users テーブルのRLS検証

ℹ テスト1: 自分のユーザー情報を取得...
✓ 自分のユーザー情報取得成功
ℹ テスト2: 他ユーザー(def67890...)の情報取得試行...
✓ RLS正常: 他ユーザーの情報は取得できませんでした
ℹ テスト3: 全ユーザー取得試行...
✓ RLS正常: 自分のユーザー情報のみ取得

🔍 TEST: guardrail_settings テーブルのRLS検証

ℹ テスト1: 自分のガードレール設定を取得...
✓ 自分の設定取得成功: 1件
ℹ テスト2: 他ユーザー(def67890...)の設定取得試行...
✓ RLS正常: 他ユーザーの設定は取得できませんでした
ℹ テスト3: user_id指定なしで全件取得試行...
✓ RLS正常: 自分の設定のみ取得 (1件)

========================================
👤 User B (test-user-b@example.com) でテスト開始
========================================

...（User B でも同様のテストを実行）

========================================
📊 テスト結果サマリー
========================================
総テスト数: 18
成功: 18
失敗: 0

🎉 すべてのRLSテストに合格しました！
本番環境でもRLSが正しく機能しています。
```

## ❌ テストが失敗した場合

### エラー例: "ログイン失敗"

```
✗ ログイン失敗: Invalid login credentials
```

**原因:**
- メールアドレスまたはパスワードが間違っている
- ユーザーが存在しない
- メール認証が完了していない

**対処法:**
1. Supabase Dashboard でユーザーが存在するか確認
2. `.env.test` のメールアドレスとパスワードを確認
3. 必要に応じてユーザーのメール認証を完了させる

### エラー例: "RLS異常: 他ユーザーのデータが取得できました"

```
✗ RLS異常: 他ユーザーのデータが3件取得できました！
```

**原因:**
- RLSポリシーが正しく設定されていない
- RLSが無効になっている

**対処法:**

#### 1. RLSが有効か確認

Supabase Dashboard → SQL Editor で以下を実行:

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('trades', 'users', 'guardrail_settings');
```

`rowsecurity` が `false` の場合、RLSを有効化:

```sql
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardrail_settings ENABLE ROW LEVEL SECURITY;
```

#### 2. RLSポリシーを確認・設定

**trades テーブル:**

```sql
-- 既存のポリシーを削除（必要に応じて）
DROP POLICY IF EXISTS "Users can view own trades" ON trades;

-- 正しいポリシーを作成
CREATE POLICY "Users can view own trades"
ON trades FOR SELECT
USING (auth.uid() = user_id);
```

**users テーブル:**

```sql
DROP POLICY IF EXISTS "Users can view own profile" ON users;

CREATE POLICY "Users can view own profile"
ON users FOR SELECT
USING (auth.uid() = id);
```

**guardrail_settings テーブル:**

```sql
DROP POLICY IF EXISTS "Users can view own settings" ON guardrail_settings;

CREATE POLICY "Users can view own settings"
ON guardrail_settings FOR SELECT
USING (auth.uid() = user_id);
```

#### 3. テストを再実行

```bash
npm run test:rls:ts
```

## 🔍 手動でテストする

ブラウザの開発者ツールで手動テスト:

```javascript
// 現在のユーザーIDを確認
const { data: { user } } = await supabase.auth.getUser();
console.log('現在のユーザーID:', user.id);

// 自分のトレードを取得
const { data: myTrades } = await supabase
  .from('trades')
  .select('*');
console.log('自分のトレード:', myTrades);

// 他ユーザーのIDを指定して取得試行（空配列が返るべき）
const otherUserId = '他ユーザーのUUID';
const { data: otherTrades } = await supabase
  .from('trades')
  .select('*')
  .eq('user_id', otherUserId);
console.log('他ユーザーのトレード:', otherTrades); // [] が期待される
```

## 📚 さらに詳しく

- **tests/README.md** - 詳細なテストガイド
- **tests/manual-test-examples.md** - 手動テストの例
- **tests/rls-test.ts** - TypeScriptテストスクリプト（コメント付き）
- **tests/rls-test-curl.sh** - cURLテストスクリプト

## 🔒 セキュリティのベストプラクティス

1. ✅ すべてのテーブルでRLSを有効化
2. ✅ `auth.uid() = user_id` を使用して自分のデータのみアクセス可能に
3. ✅ 新機能追加時には必ずRLSテストを実行
4. ✅ 本番デプロイ前にテストを実行
5. ✅ テストユーザーは本番データと分離して管理

## 💡 よくある質問

### Q: テストユーザーは本番環境に作成して良いですか？

A: はい、ただし以下に注意してください:
- テスト用のメールアドレスを使用
- テスト後はテストデータを削除
- 定期的にテストユーザーのパスワードを変更

### Q: テストが遅いです

A: 以下を試してください:
- ネットワーク接続を確認
- Supabaseプロジェクトのリージョンを確認
- テストデータの量を減らす

### Q: マジックリンク認証でもテストできますか？

A: はい、以下のように修正してください:

```typescript
// マジックリンクでログイン
const { error } = await supabase.auth.signInWithOtp({
  email: 'user@example.com',
});

// メールからマジックリンクをクリック後、セッションを取得
const { data: { session } } = await supabase.auth.getSession();
const accessToken = session?.access_token;
```

ただし、自動テストの場合はパスワード認証の方が簡単です。

