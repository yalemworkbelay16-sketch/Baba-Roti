import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, X, Check } from 'lucide-react';

/**
 * SearchableSelect - Searchable combobox dropdown for selecting materials or items.
 * Allows quick typing, instant filtering, arrow navigation, and form validation.
 */
export default function SearchableSelect({
  options = [],
  value = '',
  onChange,
  placeholder = 'Select material...',
  required = false,
  disabled = false,
  className = '',
  id,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Normalize options: supports both { value, label, sublabel } and raw materials { _id, name, currentStock, unit }
  const normalizedOptions = useMemo(() => {
    return options.map((opt) => {
      if (typeof opt === 'object' && opt !== null) {
        const val = opt.value ?? opt._id ?? '';
        const rawName = opt.label ?? opt.name ?? '';
        const trimmed = String(rawName || '').trim();
        const name = (trimmed && trimmed !== '-' && trimmed !== '.')
          ? trimmed
          : (opt.sku ? `Material (${opt.sku})` : (opt.category ? `${opt.category} Item` : 'Unnamed Material'));
        const stockQty = opt.mainStoreStock !== undefined ? opt.mainStoreStock : opt.currentStock;
        const stockInfo =
          opt.sublabel ??
          (stockQty !== undefined
            ? `${stockQty} ${opt.unit || ''} in stock`
            : '');
        return {
          id: val || Math.random().toString(),
          value: val,
          label: name,
          sublabel: stockInfo,
          currentStock: opt.currentStock,
          unit: opt.unit,
          raw: opt,
        };
      }
      return { id: opt, value: opt, label: String(opt), sublabel: '', raw: opt };
    });
  }, [options]);

  // Selected item object
  const selectedItem = useMemo(() => {
    return normalizedOptions.find((opt) => String(opt.value) === String(value));
  }, [normalizedOptions, value]);

  // Filter options based on user input
  const filteredOptions = useMemo(() => {
    if (!search.trim()) return normalizedOptions;
    const q = search.toLowerCase();
    return normalizedOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(q))
    );
  }, [normalizedOptions, search]);

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
        className={`flex w-full items-center justify-between gap-1.5 rounded-lg border bg-white px-2.5 py-2 text-left text-sm transition outline-none ${isOpen
          ? 'border-blue-500 ring-2 ring-blue-500/10'
          : 'border-ink-200 hover:border-ink-300 focus:border-blue-500'
          } ${disabled ? 'opacity-60 cursor-not-allowed bg-ink-50' : 'cursor-pointer'}`}
      >
        <div className="flex-1 min-w-0 pr-1">
          {selectedItem ? (
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-medium text-ink-900 truncate">
                {selectedItem.label}
              </span>
              {selectedItem.sublabel && (
                <span className="text-[11px] text-ink-400 font-normal truncate">
                  ({selectedItem.sublabel})
                </span>
              )}
            </div>
          ) : (
            <span className="text-ink-400 select-none">{placeholder}</span>
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
        <div className="absolute left-0 top-[calc(100%+4px)] z-50 w-full min-w-[280px] rounded-xl border border-ink-200 bg-white p-2 shadow-xl animate-in fade-in zoom-in-95">
          {/* Search box inside dropdown */}
          <div className="relative mb-2">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400"
            />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type to search material name or stock..."
              className="w-full rounded-lg border border-ink-200 bg-ink-50/50 py-1.5 pl-8 pr-7 text-xs outline-none focus:border-blue-500 focus:bg-white"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Results count header */}
          <div className="flex items-center justify-between px-1.5 py-1 text-[10px] font-semibold text-ink-400 uppercase tracking-wider border-b border-ink-100 mb-1">
            <span>Available Materials</span>
            <span>
              {filteredOptions.length} of {normalizedOptions.length}
            </span>
          </div>

          {/* Options list */}
          <div className="max-h-56 overflow-y-auto space-y-0.5">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-xs text-ink-400">
                No materials matching "<span className="font-semibold text-ink-600">{search}</span>"
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = String(opt.value) === String(value);
                const isOutOfStock =
                  opt.currentStock !== undefined && Number(opt.currentStock) <= 0;

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelect(opt)}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition ${isSelected
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'hover:bg-ink-50 text-ink-800'
                      }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-ink-900 truncate">
                        {opt.label}
                      </div>
                      {opt.sublabel && (
                        <div
                          className={`text-[10px] mt-0.5 ${isOutOfStock
                            ? 'text-red-500 font-semibold'
                            : 'text-ink-500'
                            }`}
                        >
                          {opt.sublabel}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isSelected && <Check size={14} className="text-blue-600" />}
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
