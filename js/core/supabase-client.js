/**
 * Supabase クライアント初期化
 */

// ⚠️ あとで自分のSupabase情報に置き換えてください
const SUPABASE_URL = 'https://dbjecojhzsnadyjghval.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiamVjb2poenNuYWR5amdodmFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjM3NDEsImV4cCI6MjA3Nzc5OTc0MX0._6sNC0-sG8jLQRE8GTOc17WiNr4tHYwGmUt6thQFrRw';

// Supabase CDNから読み込み
const { createClient } = supabase;

// クライアント初期化
export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

/**
 * 現在のユーザー取得
 */
export async function getCurrentUser() {
  const { data: { user }, error } = await supabaseClient.auth.getUser();
  if (error) {
    console.error('Error getting user:', error);
    return null;
  }
  return user;
}

/**
 * ユーザー情報取得（usersテーブルから）
 */
export async function getUserProfile(userId) {
  const { data, error } = await supabaseClient
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
  return data;
}

/**
 * セッション状態監視
 */
export function onAuthStateChange(callback) {
  return supabaseClient.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
}

/**
 * ログアウト
 */
export async function signOut() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    console.error('Error signing out:', error);
    throw error;
  }
}

// グローバルエクスポート（デバッグ用）
window.supabase = supabaseClient;
