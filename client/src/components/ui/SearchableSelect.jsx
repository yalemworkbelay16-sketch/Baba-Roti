import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, X, Check } from 'lucide-react';

/**
 * SearchableSelect - Standardized searchable combobox dropdown for the entire system.
 * Allows instant search filtering, keyboard navigation (Up/Down/Enter/Escape),
 * rich metadata badges (stock, cost, UOM), and native HTML5 form validation.
 */
export default function SearchableSelect({
  options = [],
  value = '',
  onChange,
  placeholder = 'Search & select item...',
  required = false,
  disabled = false,
  className = '',
  size = 'md', // 'sm' | 'md'
  id,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const optionsListRef = useRef(null);

  // Normalize options: handles RawMaterials, Products, Suppliers, Employees, Recipes, or standard objects
  const normalizedOptions = useMemo(() => {
    return options.map((opt) => {
      if (typeof opt === 'object' && opt !== null) {
        const val = opt.value ?? opt._id ?? '';
        let rawName = opt.label ?? opt.name;
        if (!rawName && (opt.firstName || opt.lastName)) {
          rawName = `${opt.firstName || ''} ${opt.lastName || ''}`.trim();
        }
        const trimmed = String(rawName || '').trim();
        const name = (trimmed && trimmed !== '-' && trimmed !== '.')
          ? trimmed
          : (opt.sku || opt.code ? `Item (${opt.sku || opt.code})` : (opt.category ? `${opt.category} Item` : 'Unnamed Item'));

        let stockInfo = opt.sublabel;
        if (stockInfo === undefined) {
          if (opt.isProduced) {
            const stName = opt.productionStation === 'bar' ? 'Bar' : 'Kitchen';
            const costStr = opt.unitCost ? ` • Cost: ETB ${Number(opt.unitCost).toFixed(2)}` : '';
            stockInfo = `★ Prepared in ${stName}${costStr}`;
          } else if (opt.mainStoreStock !== undefined || opt.kitchenStock !== undefined || opt.barStock !== undefined || opt.currentStock !== undefined) {
            const parts = [];
            if (opt.unitCost !== undefined && opt.unitCost > 0) {
              parts.push(`ETB ${Number(opt.unitCost).toFixed(2)}`);
            }
            if (opt.kitchenStock !== undefined && Number(opt.kitchenStock) > 0) parts.push(`Kitchen: ${opt.kitchenStock}`);
            if (opt.barStock !== undefined && Number(opt.barStock) > 0) parts.push(`Bar: ${opt.barStock}`);
            if (opt.mainStoreStock !== undefined) parts.push(`Main: ${opt.mainStoreStock}`);
            const stockQty = opt.mainStoreStock !== undefined ? opt.mainStoreStock : opt.currentStock;
            stockInfo = parts.length > 0 ? parts.join(' | ') : `${stockQty} ${opt.unit || ''} in stock`;
          } else if (opt.uom && opt.sellingPrice !== undefined) {
            stockInfo = `Price: ETB ${Number(opt.sellingPrice).toFixed(2)} / ${opt.uom}`;
          } else if (opt.phone) {
            stockInfo = `Phone: ${opt.phone}`;
          } else if (opt.department || opt.position) {
            stockInfo = [opt.department, opt.position].filter(Boolean).join(' • ');
          } else if (opt.yieldQuantity && opt.yieldUnit) {
            stockInfo = `Yield: ${opt.yieldQuantity} ${opt.yieldUnit}${opt.station ? ` (${opt.station})` : ''}`;
          }
        }

        return {
          id: val || Math.random().toString(),
          value: val,
          label: name,
          sublabel: stockInfo,
          category: opt.category || '',
          code: opt.code || opt.sku || '',
          currentStock: opt.currentStock,
          unit: opt.unit,
          raw: opt,
        };
      }
      return { id: opt, value: opt, label: String(opt), sublabel: '', category: '', code: '', raw: opt };
    });
  }, [options]);

  // Selected item object
  const selectedItem = useMemo(() => {
    return normalizedOptions.find((opt) => String(opt.value) === String(value));
  }, [normalizedOptions, value]);

  // Filter options based on user input (search label, sublabel, category, or code)
  const filteredOptions = useMemo(() => {
    if (!search.trim()) return normalizedOptions;
    const q = search.toLowerCase();
    return normalizedOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(q)) ||
        (opt.category && opt.category.toLowerCase().includes(q)) ||
        (opt.code && opt.code.toLowerCase().includes(q))
    );
  }, [normalizedOptions, search]);

  // Reset highlighted index when filtered options change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredOptions]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setHighlightedIndex(0);
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 50);
    }
  }, [isOpen]);

  const handleSelect = (opt) => {
    if (onChange) {
      onChange(opt ? opt.value : '', opt ? opt.raw : null);
    }
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    if (onChange) {
      onChange('', null);
    }
  };

  // Keyboard navigation inside search input
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % (filteredOptions.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + filteredOptions.length) % (filteredOptions.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredOptions[highlightedIndex]) {
        handleSelect(filteredOptions[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  const isSmall = size === 'sm';

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Hidden input to support native HTML5 form required validation */}
      <input
        type="text"
        required={required}
        value={value || ''}
        onChange={() => { }}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* Main trigger button */}
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`flex w-full items-center justify-between gap-1.5 rounded-xl border bg-white text-left transition outline-none cursor-pointer shadow-2xs ${isSmall ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-xs font-semibold'
          } ${isOpen
            ? 'border-blue-500 ring-2 ring-blue-500/20'
            : 'border-ink-200 hover:border-ink-300 focus:border-blue-500'
          } ${disabled ? 'opacity-60 cursor-not-allowed bg-ink-50' : ''}`}
      >
        <div className="flex-1 min-w-0 pr-1">
          {selectedItem ? (
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-bold text-ink-900 truncate">
                {selectedItem.label}
              </span>
              {selectedItem.sublabel && (
                <span className="text-[10.5px] text-ink-500 font-medium truncate">
                  ({selectedItem.sublabel})
                </span>
              )}
            </div>
          ) : (
            <span className="text-ink-400 font-medium select-none">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0 text-ink-400">
          {selectedItem && !disabled && (
            <span
              role="button"
              onClick={handleClear}
              title="Clear selection"
              className="p-0.5 hover:text-red-500 rounded transition"
            >
              <X size={13} />
            </span>
          )}
          <ChevronDown
            size={14}
            className={`transition-transform duration-150 ${isOpen ? 'rotate-180 text-blue-600' : ''
              }`}
          />
        </div>
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-[100] w-full min-w-[280px] rounded-2xl border border-ink-200/90 bg-white p-2 shadow-2xl animate-in fade-in zoom-in-95">
          {/* Search box inside dropdown */}
          <div className="relative mb-2">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400"
            />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type to search material name, cost, category..."
              className="w-full rounded-xl border border-ink-200 bg-ink-50/70 py-1.5 pl-8 pr-7 text-xs outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600 cursor-pointer"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Results count header */}
          <div className="flex items-center justify-between px-2 py-1 text-[10px] font-bold text-ink-400 uppercase tracking-wider border-b border-ink-100 mb-1">
            <span>Available Options</span>
            <span className="font-semibold text-ink-500">
              {filteredOptions.length} of {normalizedOptions.length}
            </span>
          </div>

          {/* Options list */}
          <div ref={optionsListRef} className="max-h-56 overflow-y-auto space-y-0.5 pr-0.5">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-xs text-ink-400">
                No items matching "<span className="font-semibold text-ink-600">{search}</span>"
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = String(opt.value) === String(value);
                const isHighlighted = idx === highlightedIndex;
                const isOutOfStock =
                  opt.currentStock !== undefined && Number(opt.currentStock) <= 0;

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelect(opt)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-left text-xs transition cursor-pointer ${isSelected
                        ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200'
                        : isHighlighted
                          ? 'bg-ink-100/70 text-ink-900 font-semibold'
                          : 'hover:bg-ink-50 text-ink-800'
                      }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-ink-900 truncate flex items-center gap-1.5">
                        <span>{opt.label}</span>
                        {opt.category && (
                          <span className="text-[9.5px] font-semibold text-ink-400 px-1 py-0.2 rounded bg-ink-100 shrink-0">
                            {opt.category}
                          </span>
                        )}
                      </div>
                      {opt.sublabel && (
                        <div
                          className={`text-[10px] mt-0.5 truncate ${isOutOfStock
                              ? 'text-red-500 font-semibold'
                              : 'text-ink-500 font-medium'
                            }`}
                        >
                          {opt.sublabel}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isSelected && <Check size={14} className="text-blue-600 stroke-[2.5]" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
