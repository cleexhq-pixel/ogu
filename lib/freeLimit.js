export const DAILY_LIMIT = {
  guest: 1,
  member: 3,
};

function getTodayString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getStorageKey(userId) {
  const today = getTodayString();
  return userId
    ? `kkobi_m90s_sessions_${userId}_${today}`
    : `kkobi_m90s_sessions_guest_${today}`;
}

export function getSessionsUsedToday(userId) {
  if (typeof window === "undefined") return 0;
  return parseInt(localStorage.getItem(getStorageKey(userId)) || "0", 10);
}

export function incrementSessionsUsed(userId) {
  if (typeof window === "undefined") return;
  const key = getStorageKey(userId);
  const current = parseInt(localStorage.getItem(key) || "0", 10);
  localStorage.setItem(key, String(current + 1));
}

export function hasReachedDailyLimit(userId, isPaid) {
  if (isPaid) return false;
  // 로컬 개발 환경에서는 횟수 제한 없음
  if (process.env.NODE_ENV === 'development') return false;
  const limit = userId ? DAILY_LIMIT.member : DAILY_LIMIT.guest;
  return getSessionsUsedToday(userId) >= limit;
}

export function getSessionsRemaining(userId, isPaid) {
  if (isPaid) return Infinity;
  // 로컬 개발 환경에서는 무제한
  if (process.env.NODE_ENV === 'development') return Infinity;
  const limit = userId ? DAILY_LIMIT.member : DAILY_LIMIT.guest;
  const used = getSessionsUsedToday(userId);
  return Math.max(0, limit - used);
}

/** @deprecated Legacy KO page; uses guest bucket only. Prefer getSessionsRemaining + auth. */
export function checkFreeLimit() {
  if (typeof window === "undefined") {
    return {
      canPlay: true,
      remaining: DAILY_LIMIT.member,
      count: 0,
    };
  }
  const remaining = getSessionsRemaining(null, false);
  const used = getSessionsUsedToday(null);
  return {
    canPlay: remaining > 0,
    remaining,
    count: used,
  };
}

/** @deprecated Legacy KO page; uses guest bucket only. */
export function markOneUsed() {
  incrementSessionsUsed(null);
}

/** @deprecated Legacy KO page; guest bucket only. */
export function getRemainingCount() {
  return getSessionsRemaining(null, false);
}
