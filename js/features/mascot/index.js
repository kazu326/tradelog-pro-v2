/**
 * AIマスコット機能 - コアロジック & ビジュアライザー
 */
import { getProgress } from '../../core/progression.js';
import { el } from '../../utils/dom.js';
import { MASCOT_ASSETS, getStageAssets } from './assets.js';

// マスコットの状態（将来的には永続化）
let mascotState = {
  emotion: 'normal', // normal, happy, thinking
  config: {
    color: 'var(--color-primary)',
    scale: 1.0
  }
};

/**
 * マスコットコンテナを初期化・描画
 * @param {HTMLElement} container - 親要素
 */
export function initMascot(container) {
  const progress = getProgress();
  
  // マスコットエリアの構築
  const mascotArea = el('div', { className: 'mascot-area' },
    createMascotVisual(progress.level),
    createExpBar(progress),
    // 吹き出しエリア（mascot-areaの直下に配置）
    el('div', { className: 'mascot-bubble', style: { opacity: '0' } }, 'Ready to trade!')
  );
  
  container.appendChild(mascotArea);
  
  // アニメーションループ開始（まばたき等）
  startMascotAnimation(mascotArea);
}

/**
 * マスコットのビジュアルを生成
 * 画像アセットベース（フォールバックでCSS描画）
 */
function createMascotVisual(level) {
  // レベルによる進化段階
  const stage = Math.floor((level - 1) / 10) + 1;
  const stageAssets = getStageAssets(level);
  
  // コンテナ
  const container = el('div', { 
    className: 'mascot-visual', 
    dataset: { stage }
  });

  // 背景オーラ（共通）
  container.appendChild(el('div', { className: 'mascot-aura' }));

  // 画像レイヤーコンテナ
  const layers = el('div', { className: 'mascot-layers' });
  container.appendChild(layers);

  // 画像ロード試行
  let baseImageLoaded = false;

  // 1. Base Body Layer
  const baseImg = el('img', {
    src: stageAssets.base,
    className: 'mascot-layer layer-base fade-in',
    style: { zIndex: 1 },
    alt: 'Mascot Base',
    onload: () => {
      baseImageLoaded = true;
      // CSSフォールバックが表示されていたら消すなどの処理が必要ならここに
    },
    onerror: (e) => {
      // 画像ロード失敗時のフォールバック: CSS描画に切り替え
      console.warn('Mascot image load failed, falling back to CSS render.', e.target.src);
      e.target.style.display = 'none';
      // 他のレイヤーも隠す
      const siblings = layers.querySelectorAll('img');
      siblings.forEach(img => img.style.display = 'none');
      
      // 既にCSSマスコットがなければ追加
      if (!container.querySelector('.mascot-body-css')) {
        container.appendChild(renderCssMascot());
      }
    }
  });
  layers.appendChild(baseImg);

  // 2. Emotion Face Layer
  const emotionSrc = stageAssets.emotions[mascotState.emotion] || stageAssets.emotions.normal;
  const faceImg = el('img', {
    src: emotionSrc,
    className: 'mascot-layer layer-face fade-in',
    style: { zIndex: 2 },
    alt: 'Mascot Face',
    onerror: (e) => e.target.style.display = 'none' // 顔だけロード失敗なら非表示
  });
  layers.appendChild(faceImg);

  // 3. Items (Optional)
  // 将来的には mascotState.equippedItems などを参照してループ生成

  return container;
}

/**
 * CSSベースのロボット描画（フォールバック用）
 */
function renderCssMascot() {
  return el('div', { className: 'mascot-body mascot-body-css' },
    // アンテナ
    el('div', { className: 'mascot-antenna' },
      el('div', { className: 'mascot-antenna-ball' })
    ),
    // 頭
    el('div', { className: 'mascot-head' },
      // 目（左右）
      el('div', { className: 'mascot-eye left' }),
      el('div', { className: 'mascot-eye right' }),
      // 口
      el('div', { className: 'mascot-mouth' })
    ),
    // 胴体
    el('div', { className: 'mascot-torso' },
      el('div', { className: 'mascot-core' })
    ),
    // 手
    el('div', { className: 'mascot-hand left' }),
    el('div', { className: 'mascot-hand right' })
  );
}

/**
 * グラデーションEXバーの生成
 */
function createExpBar(progress) {
  const percent = progress.progressPercent;
  const nextExp = progress.remainingToNext;
  
  return el('div', { className: 'mascot-status' },
    el('div', { className: 'mascot-info' },
      el('span', { className: 'mascot-level' }, `Lv.${progress.level}`),
      el('span', { className: 'mascot-next' }, `Next: ${nextExp} exp`)
    ),
    el('div', { className: 'exp-bar-container' },
      el('div', { 
        className: 'exp-bar-fill',
        style: { width: `${percent}%` } 
      }),
      el('div', { className: 'exp-bar-glare' }) // キラッと光るエフェクト用
    )
  );
}

/**
 * 簡単なアニメーション制御
 */
function startMascotAnimation(root) {
  // CSS描画用と画像用、両方の要素を対象にする
  
  // まばたきループ (CSS版のみ有効)
  setInterval(() => {
    if (Math.random() > 0.1) return;
    const eyes = root.querySelectorAll('.mascot-eye');
    eyes.forEach(eye => {
      eye.style.transform = 'scaleY(0.1)';
      setTimeout(() => {
        eye.style.transform = 'scaleY(1)';
      }, 150);
    });
  }, 2000);
  
  // クリックインタラクション
  const visual = root.querySelector('.mascot-visual');
  if (visual) {
    visual.addEventListener('click', () => {
      const bubble = root.querySelector('.mascot-bubble');
      const messages = [
        '調子はどう？',
        '今日も頑張ろう！',
        '分析はお任せあれ！',
        'しっかり損切りできて偉い！',
        'トレンドに乗ろう！'
      ];
      const msg = messages[Math.floor(Math.random() * messages.length)];
      
      if (bubble) {
        bubble.textContent = msg;
        bubble.style.opacity = '1';
        bubble.style.transform = 'translateY(-5px)';
        
        // ジャンプアニメ
        visual.classList.add('bounce');
        
        setTimeout(() => {
          bubble.style.opacity = '0';
          bubble.style.transform = 'translateY(0)';
          visual.classList.remove('bounce');
        }, 2500);
      }
    });
  }
}

/**
 * CSSスタイルを注入（動的に追加）
 */
export function injectMascotStyles() {
  if (document.getElementById('mascot-styles')) return;
  
  const style = el('style', { id: 'mascot-styles' }, `
    .mascot-area {
      background: white;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 24px;
      box-shadow: var(--shadow-sm);
      display: flex;
      align-items: center;
      gap: 20px;
      border: 1px solid var(--color-border);
      overflow: visible;
      position: relative;
      min-height: 100px;
    }
    
    /* ビジュアルエリア */
    .mascot-visual {
      width: 80px;
      height: 80px;
      position: relative;
      cursor: pointer;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    /* マスコットオーラ */
    .mascot-aura {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(74, 144, 226, 0.1) 0%, transparent 70%);
      animation: pulse 2s infinite;
    }
    
    @keyframes pulse {
      0%, 100% { transform: scale(1); opacity: 0.5; }
      50% { transform: scale(1.05); opacity: 0.8; }
    }
    
    /* 画像レイヤー */
    .mascot-layers {
      width: 100%;
      height: 100%;
      position: absolute;
      top: 0;
      left: 0;
    }
    
    .mascot-layer {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
      transition: opacity 0.3s ease;
    }
    
    .fade-in {
      animation: fadeIn 0.5s ease-in-out;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    /* CSSフォールバック用スタイル */
    .mascot-body-css {
      width: 100%;
      height: 100%;
      position: absolute;
      top: 0;
      left: 0;
      animation: float 3s ease-in-out infinite;
    }
    
    .mascot-head {
      width: 50px;
      height: 40px;
      background: var(--color-primary);
      border-radius: 12px;
      position: absolute;
      top: 10px;
      left: 15px;
    }
    
    .mascot-eye {
      width: 8px;
      height: 8px;
      background: #fff;
      border-radius: 50%;
      position: absolute;
      top: 12px;
      transition: transform 0.1s;
    }
    .mascot-eye.left { left: 10px; }
    .mascot-eye.right { right: 10px; }
    
    .mascot-antenna {
      width: 2px;
      height: 15px;
      background: var(--color-text-secondary);
      position: absolute;
      top: 5px;
      left: 39px;
    }
    .mascot-antenna-ball {
      width: 6px;
      height: 6px;
      background: #f44;
      border-radius: 50%;
      position: absolute;
      top: -4px;
      left: -2px;
      box-shadow: 0 0 5px #f44;
    }
    
    .mascot-torso {
      width: 30px;
      height: 25px;
      background: #ddd;
      border-radius: 0 0 10px 10px;
      position: absolute;
      top: 45px;
      left: 25px;
      z-index: 1;
    }
    
    .mascot-core {
      width: 10px;
      height: 10px;
      background: #4ff;
      border-radius: 50%;
      position: absolute;
      top: 5px;
      left: 10px;
      box-shadow: 0 0 8px #4ff;
    }
    
    .mascot-hand {
      width: 10px;
      height: 10px;
      background: var(--color-primary);
      border-radius: 50%;
      position: absolute;
      top: 50px;
    }
    .mascot-hand.left { left: 10px; }
    .mascot-hand.right { right: 60px; }
    
    /* 吹き出し */
    .mascot-bubble {
      position: absolute;
      top: 8px;
      left: 100px;
      background: #333;
      color: #fff;
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 13px;
      white-space: nowrap;
      pointer-events: none;
      transition: all 0.3s ease;
      z-index: 10;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }
    .mascot-bubble::after {
      content: '';
      position: absolute;
      left: -6px;
      top: 50%;
      margin-top: -6px;
      border-width: 6px 6px 6px 0;
      border-style: solid;
      border-color: transparent #333 transparent transparent;
    }
    
    /* ステータスエリア */
    .mascot-status {
      flex: 1;
    }
    
    .mascot-info {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
      font-size: 14px;
      font-weight: bold;
    }
    .mascot-level { color: var(--color-primary); }
    .mascot-next { font-size: 12px; color: var(--color-text-secondary); font-weight: normal; }
    
    .exp-bar-container {
      height: 12px;
      background: #eee;
      border-radius: 6px;
      overflow: hidden;
      position: relative;
    }
    
    .exp-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #4facfe 0%, #00f2fe 100%);
      border-radius: 6px;
      transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
    }
    
    .exp-bar-glare {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
      transform: translateX(-100%);
      animation: glare 3s infinite;
    }
    
    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-5px); }
    }
    
    @keyframes glare {
      0% { transform: translateX(-100%); }
      20% { transform: translateX(100%); }
      100% { transform: translateX(100%); }
    }
    
    .bounce {
      animation: bounce 0.5s !important;
    }
    @keyframes bounce {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1) translateY(-10px); }
    }
  `);
  document.head.appendChild(style);
}
