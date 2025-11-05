/**
 * トースト通知
 */

export function showToast(message, type = 'info', duration = 3000) {
  // 既存のトーストを削除
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  // トースト作成
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;

  document.body.appendChild(toast);

  // アニメーション
  setTimeout(() => toast.classList.add('toast--show'), 10);

  // 自動削除
  setTimeout(() => {
    toast.classList.remove('toast--show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
