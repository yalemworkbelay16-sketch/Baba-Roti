import React, { useState, useMemo } from 'react';
import {
  INTERNATIONAL_UNIT_GROUPS,
  getUnitFamily,
  normalizeUnit,
} from '../../utils/units';

/**
 * Standardized International Unit of Measurement selector with optional custom unit input.
 * When `baseUnit` is supplied (e.g. from a selected Raw Material), compatible convertible units
 * are promoted to the top group so users immediately see exact conversion options.
 */
export default function UnitSelect({
  value = '',
  onChange,
  baseUnit = '',
  placeholder = 'Unit',
  required = false,
  className = '',
  compact = false,
  title = 'Select International Unit of Measurement',
}) {
  const [customMode, setCustomMode] = useState(false);

  const allStandardValues = useMemo(
    () => INTERNATIONAL_UNIT_GROUPS.flatMap((g) => g.options.map((o) => o.value)),
    []
  );

  // Match case-insensitively or canonical-equivalent if possible, otherwise keep raw option
  const matchedValue = useMemo(() => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (allStandardValues.includes(raw)) return raw;
    const normRaw = normalizeUnit(raw);
    const equiv = allStandardValues.find((v) => normalizeUnit(v) === normRaw);
    // Preserve exact legacy DB string unless user picks a standard option; add an extra option if not in list
    return equiv && raw.toLowerCase() === equiv.toLowerCase() ? equiv : raw;
  }, [value, allStandardValues]);

  const isKnownOption = !matchedValue || allStandardValues.includes(matchedValue);

  const groupedOptions = useMemo(() => {
    if (!baseUnit) return INTERNATIONAL_UNIT_GROUPS;
    const baseFam = getUnitFamily(baseUnit);
    if (baseFam === 'other' || baseFam === 'packaging') return INTERNATIONAL_UNIT_GROUPS;

    const compatibleGroup = INTERNATIONAL_UNIT_GROUPS.find((g) => g.family === baseFam);
    if (!compatibleGroup) return INTERNATIONAL_UNIT_GROUPS;

    const rest = INTERNATIONAL_UNIT_GROUPS.filter((g) => g.family !== baseFam);
    return [
      {
        ...compatibleGroup,
        group: `✓ Compatible with "${baseUnit}"`,
      },
      ...rest,
    ];
  }, [baseUnit]);

  if (customMode) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="text"
          required={required}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Custom unit"
          title={title}
          className={
            className ||
            'w-24 rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-xs font-semibold text-ink-900 outline-none focus:border-blue-500'
          }
        />
        <button
          type="button"
          onClick={() => setCustomMode(false)}
          title="Back to standard international units"
          className="rounded-md border border-ink-200 bg-ink-50 px-1.5 py-1 text-[10px] font-bold text-ink-600 hover:bg-ink-100 cursor-pointer shrink-0"
        >
          List
        </button>
      </div>
    );
  }

  return (
    <select
      required={required}
      value={matchedValue}
      title={title}
      onChange={(e) => {
        if (e.target.value === '__custom__') {
          setCustomMode(true);
          onChange('');
        } else {
          onChange(e.target.value);
        }
      }}
      className={
        className ||
        `${compact ? 'w-24 sm:w-28 py-1.5 px-1.5 text-xs' : 'w-full py-2 px-2.5 text-xs'} rounded-lg border border-ink-200 bg-white font-semibold text-ink-900 outline-none focus:border-blue-500 cursor-pointer`
      }
    >
      <option value="">{placeholder}</option>
      {!isKnownOption && (
        <option value={matchedValue}>{matchedValue}</option>
      )}
      {groupedOptions.map((grp) => (
        <optgroup key={grp.group} label={grp.group}>
          {grp.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {compact ? opt.value : opt.label}
            </option>
          ))}
        </optgroup>
      ))}
      <option value="__custom__">✏️ Custom unit…</option>
    </select>
  );
}
