/**
 * Shared duplicate & missing-code detection helpers for Products, Raw Materials, and Production.
 */

export const normText = (val) =>
  String(val || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

export const normCode = (val) =>
  String(val || '')
    .trim()
    .toLowerCase();

/**
 * Simple Damerau/Levenshtein-style similarity check for catching accidental typos
 * (e.g., "Almunium" vs "Aluminum", or singular/plural variants).
 */
export function isSimilarName(a, b) {
  const s1 = normText(a);
  const s2 = normText(b);
  if (!s1 || !s2 || s1 === s2) return false;

  // Singular / plural (e.g. Tomato vs Tomatoes, Onion vs Onions)
  if (s1 + 's' === s2 || s2 + 's' === s1 || s1 + 'es' === s2 || s2 + 'es' === s1) {
    return true;
  }

  // Only run edit-distance on reasonably close lengths & length >= 5
  if (Math.min(s1.length, s2.length) < 5) return false;
  if (Math.abs(s1.length - s2.length) > 2) return false;

  const dp = Array.from({ length: s1.length + 1 }, () => new Array(s2.length + 1).fill(0));
  for (let i = 0; i <= s1.length; i++) dp[i][0] = i;
  for (let j = 0; j <= s2.length; j++) dp[0][j] = j;

  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[s1.length][s2.length] <= 2;
}

/**
 * Build fast lookup map of duplicate names, duplicate codes, and missing codes
 * across an item collection (`products`, `materials`, or `recipes`).
 */
export function buildConflictMap(items = []) {
  const nameGroups = new Map();
  const codeGroups = new Map();

  items.forEach((item) => {
    const n = normText(item?.name);
    const c = normCode(item?.code);
    if (n) {
      if (!nameGroups.has(n)) nameGroups.set(n, []);
      nameGroups.get(n).push(item);
    }
    if (c) {
      if (!codeGroups.has(c)) codeGroups.set(c, []);
      codeGroups.get(c).push(item);
    }
  });

  const byId = new Map();
  let flaggedCount = 0;

  items.forEach((item) => {
    const id = String(item?._id || '');
    if (!id) return;
    const n = normText(item?.name);
    const c = normCode(item?.code);

    const nameMatches = n ? (nameGroups.get(n) || []).filter((x) => String(x._id) !== id) : [];
    const codeMatches = c ? (codeGroups.get(c) || []).filter((x) => String(x._id) !== id) : [];

    const dupName = nameMatches.length > 0;
    const dupCode = codeMatches.length > 0;
    const missingCode = !c;
    const hasWarning = dupName || dupCode || missingCode;

    const reasons = [];
    if (dupName) reasons.push('Duplicate Name');
    if (dupCode) reasons.push('Duplicate Code');
    if (missingCode) reasons.push('Missing Code');

    if (hasWarning) flaggedCount++;
    byId.set(id, {
      dupName,
      dupCode,
      missingCode,
      nameMatches,
      codeMatches,
      hasWarning,
      reasons,
    });
  });

  return { byId, flaggedCount };
}

/**
 * Live modal check while typing Code or Name: returns exact conflicts + near-typo matches.
 */
export function findLiveConflicts(items = [], { code = '', name = '', excludeId = null } = {}) {
  const c = normCode(code);
  const n = normText(name);

  let codeConflict = null;
  let nameConflict = null;
  const similarNames = [];

  for (const item of items) {
    if (excludeId && String(item._id) === String(excludeId)) continue;
    if (c && normCode(item.code) === c && !codeConflict) {
      codeConflict = item;
    }
    if (n && normText(item.name) === n && !nameConflict) {
      nameConflict = item;
    } else if (n && isSimilarName(n, item.name) && similarNames.length < 3) {
      similarNames.push(item);
    }
  }

  return { codeConflict, nameConflict, similarNames };
}
