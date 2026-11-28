/**
 * Ethiopian Time (Africa/Addis_Ababa, UTC+3) helpers.
 * Guarantees accurate date & time calculations even if a terminal PC's
 * Windows timezone or local clock differs from Ethiopia time.
 */

export const ETHIOPIA_TZ = 'Africa/Addis_Ababa';

let serverClockOffsetMs = 0;

export function syncServerClock(serverDateHeader) {
  if (!serverDateHeader) return;
  const parsed = Date.parse(serverDateHeader);
  if (!Number.isNaN(parsed)) {
    const diff = parsed - Date.now();
    // Apply offset whenever client clock drifts by > 15 seconds
    if (Math.abs(diff) > 15000) {
      serverClockOffsetMs = diff;
    } else {
      serverClockOffsetMs = 0;
    }
  }
}

export function getEthiopiaNow() {
  return new Date(Date.now() + serverClockOffsetMs);
}

function getEthiopiaParts(val = getEthiopiaNow()) {
  const d = val instanceof Date ? val : new Date(val);
  if (Number.isNaN(d.getTime())) return null;

  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: ETHIOPIA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = {};
  for (const p of fmt.formatToParts(d)) {
    if (p.type !== 'literal') parts[p.type] = p.value;
  }
  const hour = parts.hour === '24' ? '00' : parts.hour;
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour,
    minute: parts.minute,
    second: parts.second,
  };
}

/** Returns 'YYYY-MM-DD' in Ethiopia (Africa/Addis_Ababa) time */
export function getEthiopiaDateKey(val = getEthiopiaNow()) {
  const p = getEthiopiaParts(val);
  if (!p) return '';
  return `${p.year}-${p.month}-${p.day}`;
}

/** Returns 'YYYY-MM-DDTHH:mm' in Ethiopia time for <input type="datetime-local"> */
export function getEthiopiaDateTimeLocalValue(val = getEthiopiaNow()) {
  const p = getEthiopiaParts(val);
  if (!p) return '';
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** Converts a 'YYYY-MM-DDTHH:mm' Ethiopian local value into an ISO string with +03:00 offset */
export function ethiopiaLocalToIsoWithOffset(localStr) {
  const raw = String(localStr || '').trim();
  if (!raw) return getEthiopiaNow().toISOString();
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)) return raw;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) {
    return `${raw}:00+03:00`;
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(raw)) {
    return `${raw}+03:00`;
  }
  return raw;
}

/** Shifts a 'YYYY-MM-DD' key by deltaDays without timezone drift */
export function shiftDateKey(dateKey, deltaDays) {
  const [y, m, d] = String(dateKey || '').split('-').map(Number);
  const dt = (y && m && d) ? new Date(Date.UTC(y, m - 1, d, 12, 0, 0)) : new Date();
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return getEthiopiaDateKey(dt);
}

/** Formats any Date/ISO string in Ethiopia local time */
export function formatEthiopiaDateTime(val) {
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    timeZone: ETHIOPIA_TZ,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

/** Formats current Ethiopia weekday & date (e.g. "Saturday, November 28, 2026") */
export function formatEthiopiaLongDate(val = getEthiopiaNow()) {
  const d = val instanceof Date ? val : new Date(val);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {
    timeZone: ETHIOPIA_TZ,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}
