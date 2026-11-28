/**
 * Helpers for persisting user-registered dropdown options (categories, units, descriptions, etc.)
 * cleanly in localStorage so newly typed values stay selectable on future forms.
 */

export function getStoredCustomOptions(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return Array.from(
      new Set(
        parsed
          .map((item) => String(item || '').trim())
          .filter(Boolean)
      )
    );
  } catch {
    return [];
  }
}

export function saveStoredCustomOption(storageKey, value, builtInList = []) {
  const clean = String(value || '').trim();
  const current = getStoredCustomOptions(storageKey);
  if (!clean) return current;

  const builtInSet = new Set(builtInList.map((v) => String(v || '').trim().toLowerCase()));
  if (builtInSet.has(clean.toLowerCase())) return current;

  if (current.some((v) => v.toLowerCase() === clean.toLowerCase())) {
    return current;
  }

  const next = [...current, clean];
  try {
    localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors
  }
  return next;
}
