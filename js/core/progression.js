const STORAGE_KEY = 'tradelog:aiProgress:v1';
const MAX_LEVEL = 100;
const DAILY_CAP = 5;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function defaultDaily(date = todayKey()) {
  return {
    date,
    aiCount: 0,
    recordCount: 0,
    recordAwarded: false,
    dailyPoints: 0,
  };
}

function defaultState() {
  return {
    xp: 0,
    updatedAt: new Date().toISOString(),
    daily: defaultDaily(),
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return defaultState();
    const xp = Number(parsed.xp);
    const daily =
      typeof parsed.daily === 'object' && parsed.daily !== null
        ? {
            date: parsed.daily.date || todayKey(),
            aiCount: Number(parsed.daily.aiCount) || 0,
            recordCount: Number(parsed.daily.recordCount) || 0,
            recordAwarded: Boolean(parsed.daily.recordAwarded),
            dailyPoints: Number(parsed.daily.dailyPoints) || 0,
          }
        : defaultDaily();
    return {
      xp: Number.isFinite(xp) ? xp : 0,
      updatedAt: parsed.updatedAt || new Date().toISOString(),
      daily,
    };
  } catch (error) {
    console.warn('progress: load error', error);
    return defaultState();
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function resetDaily(state) {
  state.daily = defaultDaily();
}

function ensureDaily(state) {
  if (!state.daily || state.daily.date !== todayKey()) {
    resetDaily(state);
  }
}

function xpNeededForNext(level) {
  if (level >= MAX_LEVEL) return Infinity;
  if (level < 10) {
    return 12 + level * 3; // Lv1:15, Lv9:39, Lv10:42
  }
  const extra = level - 9;
  return 42 + extra * 8; // Lv10→11:50, 11→12:58 …
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

function tierForLevel(level) {
  return Math.min(9, Math.max(0, Math.floor((Math.max(level, 1) - 1) / 10)));
}

function applyTierClass(levelEl, level) {
  if (!levelEl) return;
  const tier = tierForLevel(level);
  const newClass = `ai-progress__level--tier${tier}`;
  const prevClass = levelEl.dataset.tierClass;
  if (prevClass && prevClass !== newClass) {
    levelEl.classList.remove(prevClass);
  }
  levelEl.classList.add(newClass);
  levelEl.dataset.tierClass = newClass;
}

export function refreshProgressUI(root = document) {
  const progress = getProgress();
  const levelEl = root.getElementById?.('ai-progress-level') || document.getElementById('ai-progress-level');
  const meterEl = root.getElementById?.('ai-progress-meter') || document.getElementById('ai-progress-meter');
  const remainingEl =
    root.getElementById?.('ai-progress-remaining') || document.getElementById('ai-progress-remaining');

  if (levelEl) {
    levelEl.textContent = String(progress.level);
    applyTierClass(levelEl, progress.level);
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

export function addProgress(eventType) {
  const state = loadState();
  ensureDaily(state);

  let pointsToAdd = 0;
  const remainingCap = Math.max(0, DAILY_CAP - state.daily.dailyPoints);

  if (remainingCap <= 0) {
    return computeProgress(state.xp);
  }

  if (eventType === 'trade_record') {
    state.daily.recordCount += 1;
    if (!state.daily.recordAwarded && state.daily.recordCount >= 2) {
      pointsToAdd = Math.min(1, remainingCap);
      if (pointsToAdd > 0) {
        state.daily.recordAwarded = true;
      }
    }
  } else if (eventType === 'ai_analysis') {
    if (state.daily.aiCount < 2) {
      pointsToAdd = Math.min(2, remainingCap);
      if (pointsToAdd > 0) {
        state.daily.aiCount += 1;
      }
    }
  }

  if (pointsToAdd <= 0) {
    saveState(state);
    return computeProgress(state.xp);
  }

  state.daily.dailyPoints += pointsToAdd;
  state.xp += pointsToAdd;
  state.updatedAt = new Date().toISOString();
  saveState(state);

  const progress = computeProgress(state.xp);
  document.dispatchEvent(new CustomEvent('ai-progress:updated', { detail: progress }));
  return progress;
}

