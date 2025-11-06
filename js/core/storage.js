/**
 * Supabase データ操作
 */
import { supabaseClient, getCurrentUser } from './supabase-client.js';

/**
 * トレード保存
 */
export async function saveTrade(tradeData) {
  const user = await getCurrentUser();
  if (!user) throw new Error('ログインが必要です');

  // idがundefined/nullの場合は除外（Supabaseが自動生成するため）
  const { id, ...dataToInsert } = tradeData;
  const payload = {
    user_id: user.id,
    ...dataToInsert
  };
  // idが有効な値の場合のみ含める（更新時など）
  if (id && id !== null && id !== undefined) {
    payload.id = id;
  }

  const { data, error } = await supabaseClient
    .from('trades')
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error('Error saving trade:', error);
    throw error;
  }

  return data;
}

/**
 * トレード一覧取得
 */
export async function getTrades(limit = 100) {
  const user = await getCurrentUser();
  if (!user) throw new Error('ログインが必要です');

  const { data, error } = await supabaseClient
    .from('trades')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error getting trades:', error);
    throw error;
  }

  return data || [];
}

/**
 * トレード更新
 */
export async function updateTrade(tradeId, updates) {
  const user = await getCurrentUser();
  if (!user) throw new Error('ログインが必要です');

  const { data, error } = await supabaseClient
    .from('trades')
    .update(updates)
    .eq('id', tradeId)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating trade:', error);
    throw error;
  }

  return data;
}

/**
 * トレード削除
 */
export async function deleteTrade(tradeId) {
  const user = await getCurrentUser();
  if (!user) throw new Error('ログインが必要です');

  const { error } = await supabaseClient
    .from('trades')
    .delete()
    .eq('id', tradeId)
    .eq('user_id', user.id);

  if (error) {
    console.error('Error deleting trade:', error);
    throw error;
  }

  return true;
}

/**
 * 期間でフィルター
 */
export async function getTradesByDateRange(startDate, endDate) {
  const user = await getCurrentUser();
  if (!user) throw new Error('ログインが必要です');

  const { data, error } = await supabaseClient
    .from('trades')
    .select('*')
    .eq('user_id', user.id)
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error getting trades by date range:', error);
    throw error;
  }

  return data || [];
}

