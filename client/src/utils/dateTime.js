/**
 * Standard Gregorian Calendar (GC) local system date & time utilities.
 */

export function getLocalDateKey(val = new Date()) {
  const d = val instanceof Date ? val : new Date(val);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getLocalDateTimeInputValue(val = new Date()) {
  const d = val instanceof Date ? val : new Date(val);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

export function localDateTimeInputToIso(localStr) {
  const raw = String(localStr || '').trim();
  if (!raw) return new Date().toISOString();
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

export function shiftDateKey(dateKey, deltaDays) {
  const [y, m, d] = String(dateKey || '').split('-').map(Number);
  const dt = (y && m && d) ? new Date(y, m - 1, d) : new Date();
  dt.setDate(dt.getDate() + deltaDays);
  return getLocalDateKey(dt);
}
