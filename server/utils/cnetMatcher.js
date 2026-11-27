/**
 * Shared CNET / Excel Normalization & Matching Utilities
 * Ensures strict, consistent matching by Code and Name across Sales Import,
 * Product Excel Import, and Raw Material Excel Import without partial-substring false matches.
 */

function normalizeCode(code) {
  if (code === null || code === undefined) return '';
  return String(code)
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
    .trim()
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/-+$/, '')
    .toLowerCase();
}

function compactCode(code) {
  const norm = normalizeCode(code);
  if (!norm) return '';
  return norm.replace(/[^a-z0-9]/g, '');
}

function normalizeName(name) {
  if (name === null || name === undefined) return '';
  return String(name)
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/&/g, ' and ')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[-–—_.,:;]+$/g, '')
    .trim()
    .toLowerCase();
}

function buildLookupMaps(records = []) {
  const byCode = new Map();
  const byCompactCode = new Map();
  const byName = new Map();
  const ambiguousCompact = new Set();

  for (const rec of records) {
    if (!rec) continue;
    const normC = normalizeCode(rec.code);
    const compC = compactCode(rec.code);
    const normN = normalizeName(rec.name);

    if (normC && !byCode.has(normC)) {
      byCode.set(normC, rec);
    }
    if (compC) {
      if (!byCompactCode.has(compC)) {
        byCompactCode.set(compC, rec);
      } else if (String(byCompactCode.get(compC)._id) !== String(rec._id)) {
        ambiguousCompact.add(compC);
      }
    }
    if (normN && !byName.has(normN)) {
      byName.set(normN, rec);
    }
  }

  for (const amb of ambiguousCompact) {
    byCompactCode.delete(amb);
  }

  return { byCode, byCompactCode, byName };
}

/**
 * Matches an incoming Excel/CNET row strictly by normalized code and normalized name.
 * Never uses substring `.includes()` matching so "P-1" never hits "P-10" and "Tea" never hits "Ginger Tea".
 */
function matchCatalogItem(maps, { code = '', name = '' } = {}) {
  const normC = normalizeCode(code);
  const compC = compactCode(code);
  const normN = normalizeName(name);

  const codeMatch = (normC ? maps.byCode.get(normC) : null) ||
    (compC ? maps.byCompactCode.get(compC) : null) ||
    null;
  const nameMatch = normN ? maps.byName.get(normN) || null : null;

  if (codeMatch && nameMatch) {
    if (String(codeMatch._id) === String(nameMatch._id)) {
      return { item: codeMatch, matchBy: 'exact_both', mismatchWarning: null, nameConflictItem: null };
    }
    // Code matched one record while Name matched a different record
    return {
      item: codeMatch,
      matchBy: 'code_with_name_conflict',
      nameConflictItem: nameMatch,
      mismatchWarning: `Code "${code}" matched "${codeMatch.name}" (${codeMatch.code}), while Name matched different item "${nameMatch.name}" (${nameMatch.code || '—'}).`,
    };
  }

  if (codeMatch) {
    const dbNormN = normalizeName(codeMatch.name);
    const mismatchWarning = (normN && dbNormN && dbNormN !== normN)
      ? `Code "${code}" matched "${codeMatch.name}" (Excel name: "${name}").`
      : null;
    return { item: codeMatch, matchBy: 'code', mismatchWarning, nameConflictItem: null };
  }

  if (nameMatch) {
    const dbNormC = normalizeCode(nameMatch.code);
    const mismatchWarning = (normC && dbNormC && dbNormC !== normC)
      ? `Name "${name}" matched "${nameMatch.name}" (${nameMatch.code}), but Excel code is "${code}".`
      : null;
    return { item: nameMatch, matchBy: 'name', mismatchWarning, nameConflictItem: null };
  }

  return { item: null, matchBy: null, mismatchWarning: null, nameConflictItem: null };
}

module.exports = {
  normalizeCode,
  compactCode,
  normalizeName,
  buildLookupMaps,
  matchCatalogItem,
};
