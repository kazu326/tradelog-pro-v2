const STORAGE_KEY = 'tradelog:aiProgress:v1';
const MAX_LEVEL = 100;

const EVENT_POINTS = {
  ai_analysis: 18,
  trade_record: 6,
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { xp: 0, updatedAt: new Date().toISOString() };
    const parsed = JSON.parse(raw);
    if (typeof parsed.xp !== 'number' || Number.isNaN(parsed.xp)) {
      return { xp: 0, updatedAt: new Date().toISOString() };
    }
    return parsed;
  } catch (error) {
    console.warn('progress: load error', error);
    return { xp: 0, updatedAt: new Date().toISOString() };
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function xpNeededForNext(level) {
  if (level >= MAX_LEVEL) return Infinity;
  if (level < 10) {
    return 12 + level * 3; // Lv1:15, Lv9:39, Lv10:42
  }
  const extra = level - 9;
  return 42 + extra * 8; // Lv10->11:50, 11->12:58...
}

function computeProgress(xp) {
  let level = 1;
  let remainingXp = xp;
  let xpToNext = xpNeededForNext(level);

  while (level < MAX_LEVEL && remainingXp >= xpToNext) {
    remainingXp -= xpToNext;
    level += 1;
    xpToNext = xpNeededForNext(level);
  }

  if (level >= MAX_LEVEL) {
    return {
      level: MAX_LEVEL,
      xp,
      xpForNext: Infinity,
      xpIntoLevel: 0,
      remainingToNext: 0,
      progressPercent: 100,
    };
  }

  const progressPercent = Math.min(100, Math.round((remainingXp / xpToNext) * 100));
  return {
    level,
    xp,
    xpForNext: xpToNext,
    xpIntoLevel: remainingXp,
    remainingToNext: Math.max(0, xpToNext - remainingXp),
    progressPercent,
  };
}

export function getProgress() {
  const state = loadState();
  return computeProgress(state.xp);
}

export function addProgress(eventType) {
  const points = EVENT_POINTS[eventType] ?? 0;
  if (!points) {
    return getProgress();
  }
  const state = loadState();
  state.xp += points;
  state.updatedAt = new Date().toISOString();
  saveState(state);
  const progress = computeProgress(state.xp);
  document.dispatchEvent(new CustomEvent('ai-progress:updated', { detail: progress }));
  return progress;
}

export function refreshProgressUI(root = document) {
  const progress = getProgress();
  const levelEl = root.getElementById?.('ai-progress-level') || document.getElementById('ai-progress-level');
  const meterEl = root.getElementById?.('ai-progress-meter') || document.getElementById('ai-progress-meter');
  const remainingEl = root.getElementById?.('ai-progress-remaining') || document.getElementById('ai-progress-remaining');

  if (levelEl) {
    levelEl.textContent = String(progress.level);
  }
  if (meterEl) {
    meterEl.style.width = `${progress.progressPercent}%`;
  }
  if (remainingEl) {
    remainingEl.textContent = progress.level >= MAX_LEVEL ? '0' : `${progress.remainingToNext}`;
  }
}

export function listenProgressUpdates() {
  document.addEventListener('ai-progress:updated', () => refreshProgressUI());
}

export function getEventPoints() {
  return { ...EVENT_POINTS };
}


