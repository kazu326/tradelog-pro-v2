/**
 * 取引設定の管理（ローカルストレージ）
 */

const STORAGE_KEY = 'tradelog:account-settings:v1';

const DEFAULT_SETTINGS = {
  presetFx: 'fx-overseas',   // 海外FX標準: 1ロット=100,000通貨
  presetGold: 'gold-standard', // 1ロット=100oz
  fxLotSize: 100000,
  fxPipSizeJpy: 0.01,
  fxPipSizeUsd: 0.0001,
  goldLotSize: 100,
  goldPipSize: 0.1,
  usdJpyRate: 150
};

let cachedSettings = null;
const listeners = new Set();

function loadSettings() {
  if (cachedSettings) return cachedSettings;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      cachedSettings = { ...DEFAULT_SETTINGS };
      return cachedSettings;
    }
    const parsed = JSON.parse(raw);
    cachedSettings = { ...DEFAULT_SETTINGS, ...parsed };
  } catch (error) {
    console.warn('取引設定の読み込みに失敗しました。デフォルトを使用します。', error);
    cachedSettings = { ...DEFAULT_SETTINGS };
  }
  return cachedSettings;
}

function persistSettings(settings) {
  cachedSettings = { ...settings };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedSettings));
  listeners.forEach((fn) => {
    try {
      fn(cachedSettings, getDerivedSettings());
    } catch (error) {
      console.error('設定変更リスナーでエラー:', error);
    }
  });
}

export function getSettings() {
  return { ...loadSettings() };
}

export function updateSettings(updates) {
  const current = loadSettings();
  const next = { ...current, ...updates };
  // ピップサイズ・ロットサイズが0または負にならないように最低値を保証
  next.fxLotSize = Math.max(1, Number(next.fxLotSize) || DEFAULT_SETTINGS.fxLotSize);
  next.fxPipSizeJpy = Math.max(0.0001, Number(next.fxPipSizeJpy) || DEFAULT_SETTINGS.fxPipSizeJpy);
  next.fxPipSizeUsd = Math.max(0.00001, Number(next.fxPipSizeUsd) || DEFAULT_SETTINGS.fxPipSizeUsd);
  next.goldLotSize = Math.max(0.0001, Number(next.goldLotSize) || DEFAULT_SETTINGS.goldLotSize);
  next.goldPipSize = Math.max(0.0001, Number(next.goldPipSize) || DEFAULT_SETTINGS.goldPipSize);
  next.usdJpyRate = Math.max(0.0001, Number(next.usdJpyRate) || DEFAULT_SETTINGS.usdJpyRate);

  persistSettings(next);
  return next;
}

export function resetSettings() {
  persistSettings({ ...DEFAULT_SETTINGS });
}

export function onSettingsChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getDerivedSettings() {
  const settings = loadSettings();

  const fxJpyPipValue = settings.fxLotSize * settings.fxPipSizeJpy; // 円建て
  const fxUsdPipValue = settings.fxLotSize * settings.fxPipSizeUsd * settings.usdJpyRate;
  const goldPipValue = settings.goldLotSize * settings.goldPipSize * settings.usdJpyRate;

  return {
    settings,
    fxJpy: {
      pipMultiplier: 1 / settings.fxPipSizeJpy,
      pipValuePerLot: fxJpyPipValue
    },
    fxUsd: {
      pipMultiplier: 1 / settings.fxPipSizeUsd,
      pipValuePerLot: fxUsdPipValue
    },
    gold: {
      pipMultiplier: 1 / settings.goldPipSize,
      pipValuePerLot: goldPipValue
    }
  };
}

export function applyPreset(preset, { usdJpyRate } = {}) {
  const next = { ...loadSettings() };
  if (typeof usdJpyRate === 'number' && !Number.isNaN(usdJpyRate)) {
    next.usdJpyRate = usdJpyRate;
  }

  switch (preset) {
    case 'fx-overseas':
      next.presetFx = preset;
      next.fxLotSize = 100000;
      next.fxPipSizeJpy = 0.01;
      next.fxPipSizeUsd = 0.0001;
      break;
    case 'fx-domestic':
      next.presetFx = preset;
      next.fxLotSize = 10000;
      next.fxPipSizeJpy = 0.01;
      next.fxPipSizeUsd = 0.0001;
      break;
    case 'fx-micro':
      next.presetFx = preset;
      next.fxLotSize = 1000;
      next.fxPipSizeJpy = 0.01;
      next.fxPipSizeUsd = 0.0001;
      break;
    case 'gold-standard':
      next.presetGold = preset;
      next.goldLotSize = 100;
      next.goldPipSize = 0.1;
      break;
    case 'gold-mini':
      next.presetGold = preset;
      next.goldLotSize = 10;
      next.goldPipSize = 0.1;
      break;
    case 'gold-micro':
      next.presetGold = preset;
      next.goldLotSize = 1;
      next.goldPipSize = 0.1;
      break;
    default:
      break;
  }

  persistSettings(next);
  return next;
}

export const PRESET_LABELS = {
  'fx-overseas': '海外FX（1ロット=100,000通貨）',
  'fx-domestic': '国内FX（1ロット=10,000通貨）',
  'fx-micro': 'マイクロ口座（1ロット=1,000通貨）',
  'gold-standard': 'ゴールド スタンダード（1ロット=100oz）',
  'gold-mini': 'ゴールド ミニ（1ロット=10oz）',
  'gold-micro': 'ゴールド マイクロ（1ロット=1oz）'
};


