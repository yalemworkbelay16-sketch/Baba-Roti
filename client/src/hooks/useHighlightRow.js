import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

const defaultMatchVoucher = (item, voucher) => {
  if (!item || !voucher) return false;
  return (
    item.voucherNo === voucher ||
    item.poNumber === voucher ||
    item.referenceNo === voucher ||
    item.employeeId === voucher
  );
};

/**
 * Reads `?highlight=<id>` or `?voucher=<no>` from URL search params,
 * clears filters via optional `onEnsureVisible`, switches pagination page if needed,
 * scrolls the matching <tr> smoothly into center view, and highlights the line for 8 seconds.
 */
export default function useHighlightRow({
  items = [],
  displayed = [],
  pageSize = 10,
  setPage,
  onEnsureVisible,
  matchVoucher = defaultMatchVoucher,
} = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeId, setActiveId] = useState(null);
  const rowRefs = useRef(new Map());
  const handledRef = useRef('');
  const ensuredRef = useRef('');

  const highlightParam = searchParams.get('highlight') || '';
  const voucherParam = searchParams.get('voucher') || '';
  const targetKey = highlightParam || voucherParam;

  const isMatch = useCallback((item) => {
    if (!item || !activeId) return false;
    return String(item._id) === String(activeId) || matchVoucher(item, activeId);
  }, [activeId, matchVoucher]);

  useEffect(() => {
    if (!targetKey) return;
    if (handledRef.current === targetKey) return;

    const matchInDisplayed = (displayed || []).findIndex(
      (x) => String(x?._id) === targetKey || matchVoucher(x, targetKey)
    );
    const matchInAll = (items || []).find(
      (x) => String(x?._id) === targetKey || matchVoucher(x, targetKey)
    );

    if (matchInDisplayed === -1 && typeof onEnsureVisible === 'function' && ensuredRef.current !== targetKey) {
      ensuredRef.current = targetKey;
      onEnsureVisible();
      return;
    }

    const found = matchInDisplayed >= 0 ? displayed[matchInDisplayed] : matchInAll;
    if (!found) return;

    handledRef.current = targetKey;
    const foundId = String(found._id || targetKey);
    setActiveId(foundId);

    if (matchInDisplayed >= 0 && typeof setPage === 'function' && pageSize > 0) {
      const targetPage = Math.floor(matchInDisplayed / pageSize) + 1;
      setPage(targetPage);
    }

    const next = new URLSearchParams(searchParams);
    next.delete('highlight');
    next.delete('voucher');
    setSearchParams(next, { replace: true });
  }, [targetKey, items, displayed, pageSize, setPage, onEnsureVisible, matchVoucher, searchParams, setSearchParams]);

  useEffect(() => {
    if (!activeId) return;
    const scrollTimer = setTimeout(() => {
      const el = rowRefs.current.get(String(activeId));
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);
    const clearTimer = setTimeout(() => {
      setActiveId(null);
      handledRef.current = '';
    }, 8000);
    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(clearTimer);
    };
  }, [activeId]);

  const setRowRef = useCallback((item) => (el) => {
    const id = item?._id ? String(item._id) : '';
    if (!id) return;
    if (el) rowRefs.current.set(id, el);
    else rowRefs.current.delete(id);
  }, []);

  const rowClass = useCallback(
    (item, baseCls = '') =>
      isMatch(item)
        ? `${baseCls} !bg-amber-50 ring-2 ring-inset ring-amber-400 shadow-xs transition-all duration-300`
        : baseCls,
    [isMatch]
  );

  return { activeId, isMatch, setRowRef, rowClass };
}
