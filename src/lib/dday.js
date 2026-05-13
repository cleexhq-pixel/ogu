/**
 * @param {string | null | undefined} fansignDate YYYY-MM-DD
 * @returns {number | null} calendar day difference (target − today); positive = days until fansign
 */
export function calculateDday(fansignDate) {
  if (!fansignDate || typeof fansignDate !== "string") return null;
  const m = fansignDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(y, mo, d);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

/**
 * @param {number | null} diffDays from calculateDday
 * @returns {string | null}
 */
export function formatDday(diffDays) {
  if (diffDays === null || diffDays === undefined) return null;
  if (diffDays > 0) return `D-${diffDays}`;
  if (diffDays === 0) return "D-DAY";
  return `D+${Math.abs(diffDays)}`;
}
