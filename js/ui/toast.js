/**
 * トースト通知
 */
import { el } from '../utils/dom.js';

export function showToast(message, type = 'info', duration = 3000) {
  // 既存のトーストを削除
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  // トースト作成
  const toast = el('div', { className: `toast toast--${type}` }, message);

  document.body.appendChild(toast);

  // アニメーション
  // requestAnimationFrameを使ってブラウザの描画タイミングに合わせることで、
  // トランジションが確実に発火するようにする
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.classList.add('toast--show');
    });
  });

  // 自動削除
  setTimeout(() => {
    toast.classList.remove('toast--show');
    // トランジション終了後に削除 (300msはCSSのtransition時間に合わせる想定)
    setTimeout(() => {
      // まだDOMに残っていれば削除（ユーザー操作などで既に消えている可能性を考慮）
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, duration);
}
