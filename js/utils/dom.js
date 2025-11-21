/**
 * HTML要素を生成するヘルパー関数
 * @param {string} tag - タグ名
 * @param {Object} [attributes] - 属性やイベント
 * @param {...(string|HTMLElement|number)} children - 子要素
 * @returns {HTMLElement} 生成された要素
 */
export function el(tag, attributes = {}, ...children) {
  const element = document.createElement(tag);

  // valueプロパティを後で設定するため、一時保存
  let pendingValue = null;

  // 属性の設定
  Object.entries(attributes || {}).forEach(([key, value]) => {
    if (key.startsWith('on') && typeof value === 'function') {
      // イベントリスナー (例: onClick -> click, onChange -> change)
      const eventName = key.toLowerCase().substring(2);
      element.addEventListener(eventName, value);
    } else if (key === 'className') {
      // クラス名
      element.className = value;
    } else if (key === 'dataset' && typeof value === 'object') {
      // データ属性 (data-*)
      Object.assign(element.dataset, value);
    } else if (key === 'style' && typeof value === 'object') {
      // スタイルオブジェクト
      Object.assign(element.style, value);
    } else if (key === 'innerHTML') {
       // innerHTMLの直接設定（要注意だが許可）
       element.innerHTML = value;
    } else if (key === 'value') {
      // valueプロパティ（select要素の場合は子要素追加後に設定）
      if (tag.toLowerCase() === 'select') {
        pendingValue = value;
      } else {
        element.value = value;
      }
    } else if (key === 'checked' || key === 'selected' || key === 'disabled' || key === 'readOnly' || key === 'required' || key === 'autofocus' || key === 'multiple') {
      // 真理値プロパティ & 属性
      element[key] = !!value;
      if (value) element.setAttribute(key, '');
      else element.removeAttribute(key);
    } else if (value === true) {
      // その他の真理値属性
      element.setAttribute(key, '');
      element[key] = true; 
    } else if (value !== false && value !== null && value !== undefined) {
      // 通常の属性
      element.setAttribute(key, value);
    }
  });

  // 子要素の追加
  children.forEach(child => {
    if (child === null || child === undefined) {
      return;
    }
    if (Array.isArray(child)) {
      // 配列の場合はフラット展開して再帰的に追加（簡易的）
      child.forEach(c => {
         if (typeof c === 'string' || typeof c === 'number') {
            element.appendChild(document.createTextNode(String(c)));
         } else if (c instanceof Node) {
            element.appendChild(c);
         }
      });
    } else if (typeof child === 'string' || typeof child === 'number') {
      element.appendChild(document.createTextNode(String(child)));
    } else if (child instanceof Node) {
      element.appendChild(child);
    }
  });

  // select要素のvalueを子要素追加後に設定
  if (tag.toLowerCase() === 'select' && pendingValue !== null) {
    element.value = pendingValue;
  }

  return element;
}
