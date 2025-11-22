#!/bin/bash

# Supabase RLS テスト - cURLバージョン
# Node.jsを使わずに、cURLコマンドでRLSをテストするスクリプト
#
# 使い方:
# 1. このスクリプトを編集して、実際の値を設定
# 2. chmod +x tests/rls-test-curl.sh
# 3. ./tests/rls-test-curl.sh

# ========================================
# 設定（実際の値に置き換えてください）
# ========================================

SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-anon-key"

# テストユーザーA
USER_A_EMAIL="test-user-a@example.com"
USER_A_PASSWORD="test-password-a"

# テストユーザーB
USER_B_EMAIL="test-user-b@example.com"
USER_B_PASSWORD="test-password-b"

# ========================================
# カラーコード
# ========================================
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ========================================
# ヘルパー関数
# ========================================

print_section() {
    echo -e "\n${CYAN}========================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# ========================================
# ログイン関数
# ========================================

login_user() {
    local email=$1
    local password=$2
    
    local response=$(curl -s -X POST \
        "${SUPABASE_URL}/auth/v1/token?grant_type=password" \
        -H "apikey: ${SUPABASE_ANON_KEY}" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"${email}\",\"password\":\"${password}\"}")
    
    local access_token=$(echo $response | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
    local user_id=$(echo $response | grep -o '"id":"[^"]*' | cut -d'"' -f4)
    
    if [ -z "$access_token" ]; then
        print_error "ログイン失敗: ${email}"
        echo "Response: $response"
        return 1
    fi
    
    echo "${access_token}|${user_id}"
}

# ========================================
# テスト: trades テーブル
# ========================================

test_trades_rls() {
    local user_name=$1
    local access_token=$2
    local user_id=$3
    local other_user_id=$4
    
    print_section "TEST: trades テーブルのRLS検証 (${user_name})"
    
    # 1. 自分のデータを取得
    print_info "1. 自分のトレードデータを取得..."
    local my_trades=$(curl -s -X GET \
        "${SUPABASE_URL}/rest/v1/trades?user_id=eq.${user_id}" \
        -H "apikey: ${SUPABASE_ANON_KEY}" \
        -H "Authorization: Bearer ${access_token}")
    
    local my_count=$(echo $my_trades | grep -o '"id"' | wc -l)
    print_success "自分のデータ取得成功: ${my_count}件"
    
    # 2. 他ユーザーのデータを取得試行
    print_info "2. 他ユーザーのデータ取得試行..."
    local other_trades=$(curl -s -X GET \
        "${SUPABASE_URL}/rest/v1/trades?user_id=eq.${other_user_id}" \
        -H "apikey: ${SUPABASE_ANON_KEY}" \
        -H "Authorization: Bearer ${access_token}")
    
    local other_count=$(echo $other_trades | grep -o '"id"' | wc -l)
    
    if [ "$other_count" -eq 0 ]; then
        print_success "RLS正常: 他ユーザーのデータは取得できませんでした"
    else
        print_error "RLS異常: 他ユーザーのデータが${other_count}件取得できました！"
        return 1
    fi
    
    # 3. user_id指定なしで全件取得試行
    print_info "3. user_id指定なしで全件取得試行..."
    local all_trades=$(curl -s -X GET \
        "${SUPABASE_URL}/rest/v1/trades?limit=100" \
        -H "apikey: ${SUPABASE_ANON_KEY}" \
        -H "Authorization: Bearer ${access_token}")
    
    # 他ユーザーのIDが含まれていないかチェック
    if echo "$all_trades" | grep -q "\"user_id\":\"${other_user_id}\""; then
        print_error "RLS異常: 他ユーザーのデータが含まれています！"
        return 1
    fi
    
    local all_count=$(echo $all_trades | grep -o '"id"' | wc -l)
    print_success "RLS正常: 自分のデータのみ取得 (${all_count}件)"
    
    return 0
}

# ========================================
# テスト: users テーブル
# ========================================

test_users_rls() {
    local user_name=$1
    local access_token=$2
    local user_id=$3
    local other_user_id=$4
    
    print_section "TEST: users テーブルのRLS検証 (${user_name})"
    
    # 1. 自分のユーザー情報を取得
    print_info "1. 自分のユーザー情報を取得..."
    local my_user=$(curl -s -X GET \
        "${SUPABASE_URL}/rest/v1/users?id=eq.${user_id}" \
        -H "apikey: ${SUPABASE_ANON_KEY}" \
        -H "Authorization: Bearer ${access_token}")
    
    if echo "$my_user" | grep -q "\"id\":\"${user_id}\""; then
        print_success "自分のユーザー情報取得成功"
    else
        print_error "自分のユーザー情報取得失敗"
        return 1
    fi
    
    # 2. 他ユーザーの情報を取得試行
    print_info "2. 他ユーザーの情報取得試行..."
    local other_user=$(curl -s -X GET \
        "${SUPABASE_URL}/rest/v1/users?id=eq.${other_user_id}" \
        -H "apikey: ${SUPABASE_ANON_KEY}" \
        -H "Authorization: Bearer ${access_token}")
    
    if echo "$other_user" | grep -q "\"id\":\"${other_user_id}\""; then
        print_error "RLS異常: 他ユーザーの情報が取得できました！"
        return 1
    else
        print_success "RLS正常: 他ユーザーの情報は取得できませんでした"
    fi
    
    # 3. 全ユーザー取得試行
    print_info "3. 全ユーザー取得試行..."
    local all_users=$(curl -s -X GET \
        "${SUPABASE_URL}/rest/v1/users?limit=100" \
        -H "apikey: ${SUPABASE_ANON_KEY}" \
        -H "Authorization: Bearer ${access_token}")
    
    if echo "$all_users" | grep -q "\"id\":\"${other_user_id}\""; then
        print_error "RLS異常: 他ユーザーの情報が含まれています！"
        return 1
    fi
    
    print_success "RLS正常: 自分のユーザー情報のみ取得"
    
    return 0
}

# ========================================
# テスト: guardrail_settings テーブル
# ========================================

test_guardrail_settings_rls() {
    local user_name=$1
    local access_token=$2
    local user_id=$3
    local other_user_id=$4
    
    print_section "TEST: guardrail_settings テーブルのRLS検証 (${user_name})"
    
    # 1. 自分の設定を取得
    print_info "1. 自分のガードレール設定を取得..."
    local my_settings=$(curl -s -X GET \
        "${SUPABASE_URL}/rest/v1/guardrail_settings?user_id=eq.${user_id}" \
        -H "apikey: ${SUPABASE_ANON_KEY}" \
        -H "Authorization: Bearer ${access_token}")
    
    local my_count=$(echo $my_settings | grep -o '"id"' | wc -l)
    print_success "自分の設定取得成功: ${my_count}件"
    
    # 2. 他ユーザーの設定を取得試行
    print_info "2. 他ユーザーの設定取得試行..."
    local other_settings=$(curl -s -X GET \
        "${SUPABASE_URL}/rest/v1/guardrail_settings?user_id=eq.${other_user_id}" \
        -H "apikey: ${SUPABASE_ANON_KEY}" \
        -H "Authorization: Bearer ${access_token}")
    
    local other_count=$(echo $other_settings | grep -o '"id"' | wc -l)
    
    if [ "$other_count" -eq 0 ]; then
        print_success "RLS正常: 他ユーザーの設定は取得できませんでした"
    else
        print_error "RLS異常: 他ユーザーの設定が${other_count}件取得できました！"
        return 1
    fi
    
    # 3. user_id指定なしで全件取得試行
    print_info "3. user_id指定なしで全件取得試行..."
    local all_settings=$(curl -s -X GET \
        "${SUPABASE_URL}/rest/v1/guardrail_settings?limit=100" \
        -H "apikey: ${SUPABASE_ANON_KEY}" \
        -H "Authorization: Bearer ${access_token}")
    
    if echo "$all_settings" | grep -q "\"user_id\":\"${other_user_id}\""; then
        print_error "RLS異常: 他ユーザーの設定が含まれています！"
        return 1
    fi
    
    local all_count=$(echo $all_settings | grep -o '"id"' | wc -l)
    print_success "RLS正常: 自分の設定のみ取得 (${all_count}件)"
    
    return 0
}

# ========================================
# メインテスト実行
# ========================================

main() {
    print_section "🔒 Supabase RLS セキュリティテスト開始"
    
    # 環境変数チェック
    if [ "$SUPABASE_URL" = "https://your-project.supabase.co" ]; then
        print_error "SUPABASE_URLが設定されていません"
        print_info "スクリプトを編集して実際の値を設定してください"
        exit 1
    fi
    
    local total_tests=0
    local passed_tests=0
    local failed_tests=0
    
    # User A でログイン
    print_info "User A (${USER_A_EMAIL}) でログイン中..."
    local user_a_data=$(login_user "$USER_A_EMAIL" "$USER_A_PASSWORD")
    if [ $? -ne 0 ]; then
        exit 1
    fi
    
    local user_a_token=$(echo $user_a_data | cut -d'|' -f1)
    local user_a_id=$(echo $user_a_data | cut -d'|' -f2)
    print_success "User A ログイン成功 (ID: ${user_a_id})"
    
    # User B でログイン
    print_info "User B (${USER_B_EMAIL}) でログイン中..."
    local user_b_data=$(login_user "$USER_B_EMAIL" "$USER_B_PASSWORD")
    if [ $? -ne 0 ]; then
        exit 1
    fi
    
    local user_b_token=$(echo $user_b_data | cut -d'|' -f1)
    local user_b_id=$(echo $user_b_data | cut -d'|' -f2)
    print_success "User B ログイン成功 (ID: ${user_b_id})"
    
    # User A でテスト実行
    print_section "👤 User A でテスト実行"
    
    total_tests=$((total_tests + 1))
    if test_trades_rls "User A" "$user_a_token" "$user_a_id" "$user_b_id"; then
        passed_tests=$((passed_tests + 1))
    else
        failed_tests=$((failed_tests + 1))
    fi
    
    total_tests=$((total_tests + 1))
    if test_users_rls "User A" "$user_a_token" "$user_a_id" "$user_b_id"; then
        passed_tests=$((passed_tests + 1))
    else
        failed_tests=$((failed_tests + 1))
    fi
    
    total_tests=$((total_tests + 1))
    if test_guardrail_settings_rls "User A" "$user_a_token" "$user_a_id" "$user_b_id"; then
        passed_tests=$((passed_tests + 1))
    else
        failed_tests=$((failed_tests + 1))
    fi
    
    # User B でテスト実行
    print_section "👤 User B でテスト実行"
    
    total_tests=$((total_tests + 1))
    if test_trades_rls "User B" "$user_b_token" "$user_b_id" "$user_a_id"; then
        passed_tests=$((passed_tests + 1))
    else
        failed_tests=$((failed_tests + 1))
    fi
    
    total_tests=$((total_tests + 1))
    if test_users_rls "User B" "$user_b_token" "$user_b_id" "$user_a_id"; then
        passed_tests=$((passed_tests + 1))
    else
        failed_tests=$((failed_tests + 1))
    fi
    
    total_tests=$((total_tests + 1))
    if test_guardrail_settings_rls "User B" "$user_b_token" "$user_b_id" "$user_a_id"; then
        passed_tests=$((passed_tests + 1))
    else
        failed_tests=$((failed_tests + 1))
    fi
    
    # 結果サマリー
    print_section "📊 テスト結果サマリー"
    echo "総テスト数: ${total_tests}"
    echo -e "${GREEN}成功: ${passed_tests}${NC}"
    echo -e "${RED}失敗: ${failed_tests}${NC}"
    
    if [ $failed_tests -eq 0 ]; then
        print_success "\n🎉 すべてのRLSテストに合格しました！"
        exit 0
    else
        print_error "\n❌ 一部のテストが失敗しました。RLSポリシーを確認してください。"
        exit 1
    fi
}

# テスト実行
main

