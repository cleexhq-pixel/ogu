const FREE_DATE_KEY = "kkobi_m90s_free_date";
const FREE_COUNT_KEY = "kkobi_m90s_free_count";
const DAILY_LIMIT = 3;

export function checkFreeLimit() {
  if (typeof window === "undefined") return { canPlay: true, remaining: DAILY_LIMIT };

  const today = new Date().toISOString().slice(0, 10);
  const lastDate = localStorage.getItem(FREE_DATE_KEY);

  // 날짜가 바뀌면 카운트 리셋
  if (lastDate !== today) {
    localStorage.setItem(FREE_DATE_KEY, today);
    localStorage.setItem(FREE_COUNT_KEY, "0");
  }

  const count = parseInt(localStorage.getItem(FREE_COUNT_KEY) || "0");
  const remaining = DAILY_LIMIT - count;

  if (remaining <= 0) {
    return { canPlay: false, remaining: 0, count };
  }

  return { canPlay: true, remaining, count };
}

export function markOneUsed() {
  if (typeof window === "undefined") return;

  const today = new Date().toISOString().slice(0, 10);
  localStorage.setItem(FREE_DATE_KEY, today);

  const count = parseInt(localStorage.getItem(FREE_COUNT_KEY) || "0");
  localStorage.setItem(FREE_COUNT_KEY, String(count + 1));
}

export function getRemainingCount() {
  if (typeof window === "undefined") return DAILY_LIMIT;

  const today = new Date().toISOString().slice(0, 10);
  const lastDate = localStorage.getItem(FREE_DATE_KEY);

  if (lastDate !== today) return DAILY_LIMIT;

  const count = parseInt(localStorage.getItem(FREE_COUNT_KEY) || "0");
  return Math.max(0, DAILY_LIMIT - count);
}
