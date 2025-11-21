/**
 * マスコットのアセット定義
 */
export const MASCOT_ASSETS = {
  // 進化段階 (levels: 適用されるレベル帯)
  stages: {
    v1: {
      minLevel: 1,
      base: 'assets/images/mascot/v1_base.png',
      emotions: {
        normal: 'assets/images/mascot/v1_face_normal.png',
        happy: 'assets/images/mascot/v1_face_happy.png',
        surprise: 'assets/images/mascot/v1_face_surprise.png',
        sleepy: 'assets/images/mascot/v1_face_sleepy.png'
      }
    },
    v2: {
      minLevel: 10,
      base: 'assets/images/mascot/v2_base.png',
      emotions: {
        normal: 'assets/images/mascot/v2_face_normal.png',
        happy: 'assets/images/mascot/v2_face_happy.png',
        surprise: 'assets/images/mascot/v2_face_surprise.png',
        sleepy: 'assets/images/mascot/v2_face_sleepy.png'
      }
    }
  },
  // 着せ替えアイテム定義
  items: {
    cap_red: { type: 'head', src: 'assets/images/mascot/items/cap_red.png', zIndex: 10 },
    glasses: { type: 'face', src: 'assets/images/mascot/items/glasses.png', zIndex: 11 }
  }
};

/**
 * 現在のレベルに対応するアセットデータを取得
 * @param {number} level 
 * @returns {Object} ステージアセット設定
 */
export function getStageAssets(level) {
  // レベル要件が高い順にソートして検索
  const sortedStages = Object.entries(MASCOT_ASSETS.stages)
    .sort(([, a], [, b]) => b.minLevel - a.minLevel);
  
  for (const [key, stage] of sortedStages) {
    if (level >= stage.minLevel) {
      return { stageKey: key, ...stage };
    }
  }
  // デフォルトはv1
  return { stageKey: 'v1', ...MASCOT_ASSETS.stages.v1 };
}

