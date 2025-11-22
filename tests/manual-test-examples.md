# RLS 手動テスト例

ブラウザの開発者ツールやPostmanを使って、手動でRLSをテストする方法を説明します。

## 🌐 ブラウザ開発者ツールでのテスト

### 準備

1. アプリケーションにログイン（User A）
2. ブラウザの開発者ツールを開く（F12）
3. Console タブを開く

### テスト1: 自分のトレードデータを取得

```javascript
// Supabaseクライアントを取得（アプリで既に初期化されている場合）
const supabase = window.supabase; // または適切なグローバル変数

// 自分のトレードを取得
const { data, error } = await supabase
  .from('trades')
  .select('*');

console.log('自分のトレード:', data);
console.log('件数:', data?.length);
```

**期待結果**: 自分のトレードデータのみが返される

### テスト2: 他ユーザーのIDを指定してデータ取得試行

```javascript
// 他ユーザーのID（事前に確認しておく）
const otherUserId = '他ユーザーのUUID';

// 他ユーザーのトレードを取得試行
const { data, error } = await supabase
  .from('trades')
  .select('*')
  .eq('user_id', otherUserId);

console.log('他ユーザーのトレード:', data);
console.log('件数:', data?.length);
```

**期待結果**: 空の配列 `[]` が返される（データが取得できない）

### テスト3: ユーザー情報の取得

```javascript
// 現在のユーザー情報を取得
const { data: { user } } = await supabase.auth.getUser();
console.log('現在のユーザーID:', user.id);

// 自分のユーザー情報を取得
const { data: myUser, error: myError } = await supabase
  .from('users')
  .select('*')
  .eq('id', user.id)
  .single();

console.log('自分のユーザー情報:', myUser);

// 他ユーザーの情報を取得試行
const otherUserId = '他ユーザーのUUID';
const { data: otherUser, error: otherError } = await supabase
  .from('users')
  .select('*')
  .eq('id', otherUserId)
  .single();

console.log('他ユーザーの情報:', otherUser);
console.log('エラー:', otherError);
```

**期待結果**: 
- 自分の情報は取得できる
- 他ユーザーの情報は取得できない（エラーまたはnull）

### テスト4: ガードレール設定の取得

```javascript
// 自分の設定を取得
const { data: mySettings, error: myError } = await supabase
  .from('guardrail_settings')
  .select('*');

console.log('自分の設定:', mySettings);

// 他ユーザーの設定を取得試行
const otherUserId = '他ユーザーのUUID';
const { data: otherSettings, error: otherError } = await supabase
  .from('guardrail_settings')
  .select('*')
  .eq('user_id', otherUserId);

console.log('他ユーザーの設定:', otherSettings);
console.log('件数:', otherSettings?.length);
```

**期待結果**: 他ユーザーの設定は空の配列 `[]`

## 📮 Postman / cURL でのテスト

### 準備: アクセストークンの取得

#### 方法1: ブラウザから取得

```javascript
// ブラウザの開発者ツールで実行
const { data: { session } } = await supabase.auth.getSession();
console.log('Access Token:', session.access_token);
```

#### 方法2: cURLでログインしてトークン取得

```bash
curl -X POST 'https://your-project.supabase.co/auth/v1/token?grant_type=password' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

レスポンスから `access_token` をコピー

### テスト例

#### 1. 自分のトレードを取得

```bash
curl -X GET 'https://your-project.supabase.co/rest/v1/trades' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**期待結果**: 自分のトレードデータのみが返される

#### 2. 他ユーザーのトレードを取得試行

```bash
curl -X GET 'https://your-project.supabase.co/rest/v1/trades?user_id=eq.OTHER_USER_ID' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**期待結果**: 空の配列 `[]` が返される

#### 3. 自分のユーザー情報を取得

```bash
curl -X GET 'https://your-project.supabase.co/rest/v1/users?id=eq.YOUR_USER_ID' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**期待結果**: 自分のユーザー情報が返される

#### 4. 他ユーザーの情報を取得試行

```bash
curl -X GET 'https://your-project.supabase.co/rest/v1/users?id=eq.OTHER_USER_ID' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**期待結果**: 空の配列 `[]` またはエラーが返される

#### 5. ガードレール設定を取得

```bash
curl -X GET 'https://your-project.supabase.co/rest/v1/guardrail_settings' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**期待結果**: 自分の設定のみが返される

#### 6. 他ユーザーの設定を取得試行

```bash
curl -X GET 'https://your-project.supabase.co/rest/v1/guardrail_settings?user_id=eq.OTHER_USER_ID' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**期待結果**: 空の配列 `[]` が返される

## 🔍 Postman コレクション設定例

### 環境変数

```json
{
  "supabase_url": "https://your-project.supabase.co",
  "anon_key": "YOUR_ANON_KEY",
  "access_token_user_a": "USER_A_ACCESS_TOKEN",
  "access_token_user_b": "USER_B_ACCESS_TOKEN",
  "user_a_id": "USER_A_UUID",
  "user_b_id": "USER_B_UUID"
}
```

### リクエスト例

#### GET /trades (User A)

- **URL**: `{{supabase_url}}/rest/v1/trades`
- **Method**: GET
- **Headers**:
  - `apikey`: `{{anon_key}}`
  - `Authorization`: `Bearer {{access_token_user_a}}`

#### GET /trades?user_id=eq.USER_B_ID (User A で User B のデータ取得試行)

- **URL**: `{{supabase_url}}/rest/v1/trades?user_id=eq.{{user_b_id}}`
- **Method**: GET
- **Headers**:
  - `apikey`: `{{anon_key}}`
  - `Authorization`: `Bearer {{access_token_user_a}}`
- **期待結果**: `[]` (空の配列)

## 📊 テスト結果の記録

### チェックリスト

| テスト項目 | User A | User B | 結果 |
|-----------|--------|--------|------|
| trades: 自分のデータ取得 | ✓ | ✓ | ✓ |
| trades: 他ユーザーのデータ取得試行 | ✗ | ✗ | ✓ |
| users: 自分の情報取得 | ✓ | ✓ | ✓ |
| users: 他ユーザーの情報取得試行 | ✗ | ✗ | ✓ |
| guardrail_settings: 自分の設定取得 | ✓ | ✓ | ✓ |
| guardrail_settings: 他ユーザーの設定取得試行 | ✗ | ✗ | ✓ |

✓ = 成功（期待通り）  
✗ = 失敗（データが取得できてしまった）

## 🚨 よくある問題と対処法

### 問題1: 他ユーザーのデータが取得できてしまう

**原因**: RLSポリシーが正しく設定されていない

**対処法**:
1. Supabase Dashboard → Database → Tables
2. 該当テーブルを選択
3. RLS が有効になっているか確認
4. Policies タブでポリシーを確認・修正

### 問題2: 自分のデータも取得できない

**原因**: RLSポリシーが厳しすぎる、またはトークンが無効

**対処法**:
1. アクセストークンが有効か確認
2. `auth.uid()` が正しく取得できているか確認
3. ポリシーの条件を見直す

### 問題3: トークンの取得に失敗する

**原因**: メール認証が完了していない、パスワードが間違っている

**対処法**:
1. Supabase Dashboard でユーザーの状態を確認
2. メール認証を完了させる
3. パスワードをリセット

## 🔗 関連ドキュメント

- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [Supabase REST API](https://supabase.com/docs/guides/api)
- [RLS Policies](https://supabase.com/docs/guides/auth/row-level-security)

