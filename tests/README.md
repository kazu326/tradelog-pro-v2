# Supabase RLS テストガイド

このディレクトリには、Supabase の Row Level Security (RLS) ポリシーが正しく機能しているかを検証するためのテストスクリプトが含まれています。

## 📋 テスト内容

以下の3つのテーブルについて、RLSが正しく機能しているかを検証します：

1. **trades テーブル**
   - 自分のトレードデータのみ取得可能か
   - 他ユーザーのトレードデータが取得できないか

2. **users テーブル**
   - 自分のユーザー情報のみ取得可能か
   - 他ユーザーの情報が取得できないか

3. **guardrail_settings テーブル**
   - 自分のガードレール設定のみ取得可能か
   - 他ユーザーの設定が取得できないか

## 🚀 使い方

### ⚡ クイックスタート

**5分で始めたい方は [QUICKSTART.md](./QUICKSTART.md) を参照してください。**

---

### 方法1: TypeScriptスクリプト（推奨）

#### 1. 環境変数ファイルの作成

```bash
# env.test.example をコピー
cp tests/env.test.example .env.test

# .env.test を編集して実際の値を設定
nano .env.test
```

`.env.test` の内容：

```env
# Supabase接続情報
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# テストユーザーA
TEST_USER_A_EMAIL=test-user-a@example.com
TEST_USER_A_PASSWORD=test-password-a

# テストユーザーB
TEST_USER_B_EMAIL=test-user-b@example.com
TEST_USER_B_PASSWORD=test-password-b
```

#### 2. 依存関係のインストール

```bash
npm install
```

#### 3. テスト実行

```bash
npm run test:rls:ts
```

### 方法2: JavaScript版

#### 1. 環境変数ファイルの作成

```bash
# env.test.example をコピー
cp tests/env.test.example .env.test

# .env.test を編集して実際の値を設定
nano .env.test
```

`.env.test` の内容：

```env
# Supabase接続情報
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# テストユーザーA
TEST_USER_A_EMAIL=test-user-a@example.com
TEST_USER_A_PASSWORD=test-password-a

# テストユーザーB
TEST_USER_B_EMAIL=test-user-b@example.com
TEST_USER_B_PASSWORD=test-password-b
```

#### 2. 依存関係のインストール

```bash
npm install @supabase/supabase-js dotenv
```

#### 3. テスト実行

```bash
node tests/rls-test.js
```

### 方法2: cURLスクリプト（Node.js不要）

#### 1. スクリプトの編集

```bash
nano tests/rls-test-curl.sh
```

スクリプト内の以下の変数を実際の値に置き換えてください：

```bash
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-anon-key"
USER_A_EMAIL="test-user-a@example.com"
USER_A_PASSWORD="test-password-a"
USER_B_EMAIL="test-user-b@example.com"
USER_B_PASSWORD="test-password-b"
```

#### 2. 実行権限の付与

```bash
chmod +x tests/rls-test-curl.sh
```

#### 3. テスト実行

```bash
./tests/rls-test-curl.sh
```

## 👥 テストユーザーの準備

テストを実行する前に、2つのテストユーザーを作成する必要があります。

### Supabase Dashboardでユーザーを作成

1. Supabase Dashboard にアクセス
2. **Authentication** → **Users** に移動
3. **Add user** をクリック
4. Email と Password を入力して作成
5. 2つのユーザーを作成（User A と User B）

### 各ユーザーでテストデータを作成

テストを正確に行うために、各ユーザーでいくつかのデータを作成しておくことを推奨します：

1. User A でログイン
   - トレードを1〜2件登録
   - ガードレール設定を保存

2. User B でログイン
   - トレードを1〜2件登録
   - ガードレール設定を保存

## 📊 テスト結果の見方

### 成功例

```
========================================
🔒 Supabase RLS セキュリティテスト開始
========================================

👤 User A (test-user-a@example.com) でテスト開始
✓ User A ログイン成功 (ID: abc123...)

========================================
TEST: trades テーブルのRLS検証 (User: test-user-a@example.com)
========================================

ℹ 1. 自分のトレードデータを取得...
✓ 自分のデータ取得成功: 2件
ℹ 2. 他ユーザー(def456...)のデータ取得試行...
✓ RLS正常: 他ユーザーのデータは取得できませんでした
ℹ 3. user_id指定なしで全件取得試行...
✓ RLS正常: 自分のデータのみ取得 (2件)

...

========================================
📊 テスト結果サマリー
========================================
総テスト数: 6
成功: 6
失敗: 0

🎉 すべてのRLSテストに合格しました！
```

### 失敗例

```
========================================
TEST: trades テーブルのRLS検証 (User: test-user-a@example.com)
========================================

ℹ 1. 自分のトレードデータを取得...
✓ 自分のデータ取得成功: 2件
ℹ 2. 他ユーザー(def456...)のデータ取得試行...
✗ RLS異常: 他ユーザーのデータが3件取得できました！

...

========================================
📊 テスト結果サマリー
========================================
総テスト数: 6
成功: 4
失敗: 2

❌ 一部のテストが失敗しました。RLSポリシーを確認してください。
```

## 🔧 RLSポリシーの確認・修正

テストが失敗した場合、Supabase Dashboard で RLS ポリシーを確認してください。

### 正しいRLSポリシーの例

#### trades テーブル

```sql
-- SELECT ポリシー
CREATE POLICY "Users can view own trades"
ON trades FOR SELECT
USING (auth.uid() = user_id);

-- INSERT ポリシー
CREATE POLICY "Users can insert own trades"
ON trades FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- UPDATE ポリシー
CREATE POLICY "Users can update own trades"
ON trades FOR UPDATE
USING (auth.uid() = user_id);

-- DELETE ポリシー
CREATE POLICY "Users can delete own trades"
ON trades FOR DELETE
USING (auth.uid() = user_id);
```

#### users テーブル

```sql
-- SELECT ポリシー
CREATE POLICY "Users can view own profile"
ON users FOR SELECT
USING (auth.uid() = id);

-- UPDATE ポリシー
CREATE POLICY "Users can update own profile"
ON users FOR UPDATE
USING (auth.uid() = id);
```

#### guardrail_settings テーブル

```sql
-- SELECT ポリシー
CREATE POLICY "Users can view own settings"
ON guardrail_settings FOR SELECT
USING (auth.uid() = user_id);

-- INSERT ポリシー
CREATE POLICY "Users can insert own settings"
ON guardrail_settings FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- UPDATE ポリシー
CREATE POLICY "Users can update own settings"
ON guardrail_settings FOR UPDATE
USING (auth.uid() = user_id);

-- DELETE ポリシー
CREATE POLICY "Users can delete own settings"
ON guardrail_settings FOR DELETE
USING (auth.uid() = user_id);
```

## 🔐 セキュリティのベストプラクティス

1. **RLSを必ず有効化**
   - すべてのテーブルで RLS を有効にする
   - `ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;`

2. **最小権限の原則**
   - ユーザーは自分のデータのみアクセス可能にする
   - `auth.uid() = user_id` を使用

3. **定期的なテスト**
   - 新機能追加時には必ずRLSテストを実行
   - 本番デプロイ前にテストを実行

4. **テストユーザーの管理**
   - テストユーザーは本番データと分離
   - テスト後はテストデータを削除

## 📝 トラブルシューティング

### エラー: "Login failed"

- ユーザーのメールアドレスとパスワードが正しいか確認
- Supabase Dashboard でユーザーが存在するか確認
- ユーザーのメール認証が完了しているか確認

### エラー: "Supabase URL or Anon Key is missing"

- `.env.test` ファイルが存在するか確認
- 環境変数が正しく設定されているか確認
- `VITE_SUPABASE_URL` と `VITE_SUPABASE_ANON_KEY` が正しいか確認

### テストが常に成功してしまう

- RLS が有効になっているか確認
  ```sql
  SELECT tablename, rowsecurity 
  FROM pg_tables 
  WHERE schemaname = 'public';
  ```
- RLS ポリシーが存在するか確認
  ```sql
  SELECT * FROM pg_policies WHERE schemaname = 'public';
  ```

## 🔗 参考リンク

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

