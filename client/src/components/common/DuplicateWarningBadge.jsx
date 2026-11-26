import React from 'react';
import { AlertTriangle, Pencil } from 'lucide-react';

/**
 * Clickable warning flag displayed on table rows with duplicate name,
 * duplicate code, or missing code. Clicking opens Edit directly.
 */
export function RowWarningFlag({ conflict, onEdit, canEdit = true }) {
  if (!conflict || !conflict.hasWarning) return null;

  const isCritical = conflict.dupCode || conflict.dupName;
  const label = conflict.reasons.join(' & ');

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (canEdit && typeof onEdit === 'function') onEdit();
      }}
      title={canEdit ? `${label} — Click to edit & fix` : label}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border transition ${
        isCritical
          ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
          : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
      } ${canEdit ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <AlertTriangle size={10} className={isCritical ? 'text-rose-600' : 'text-amber-600'} />
      <span>{label}</span>
      {canEdit && (
        <span className="inline-flex items-center gap-0.5 underline ml-0.5">
          <Pencil size={9} /> Edit
        </span>
      )}
    </button>
  );
}

/**
 * Live warning banner displayed inside Add/Edit modals when typed code or name
 * matches (or closely resembles) an existing item, with a 1-click "Edit" action.
 */
export function LiveConflictAlert({ live, onEditExisting, canEdit = true }) {
  if (!live) return null;
  const { codeConflict, nameConflict, similarNames = [] } = live;
  if (!codeConflict && !nameConflict && similarNames.length === 0) return null;

  const isBlocking = Boolean(codeConflict || nameConflict);

  return (
    <div
      className={`rounded-xl border p-2.5 text-xs space-y-1.5 ${
        isBlocking
          ? 'bg-rose-50 border-rose-200 text-rose-800'
          : 'bg-amber-50 border-amber-200 text-amber-900'
      }`}
    >
      {codeConflict && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle size={13} className="text-rose-600 shrink-0" />
            Code <strong className="font-mono">{codeConflict.code}</strong> is already used by{' '}
            <strong>"{codeConflict.name}"</strong>.
          </span>
          {canEdit && typeof onEditExisting === 'function' && (
            <button
              type="button"
              onClick={() => onEditExisting(codeConflict)}
              className="inline-flex items-center gap-1 rounded-lg bg-white border border-rose-300 px-2 py-0.5 text-[11px] font-bold text-rose-700 hover:bg-rose-100 transition cursor-pointer"
            >
              <Pencil size={10} /> Edit Existing
            </button>
          )}
        </div>
      )}

      {nameConflict && String(nameConflict._id) !== String(codeConflict?._id) && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle size={13} className="text-rose-600 shrink-0" />
            Name <strong>"{nameConflict.name}"</strong> already exists
            {nameConflict.code ? ` (Code: ${nameConflict.code})` : ''}.
          </span>
          {canEdit && typeof onEditExisting === 'function' && (
            <button
              type="button"
              onClick={() => onEditExisting(nameConflict)}
              className="inline-flex items-center gap-1 rounded-lg bg-white border border-rose-300 px-2 py-0.5 text-[11px] font-bold text-rose-700 hover:bg-rose-100 transition cursor-pointer"
            >
              <Pencil size={10} /> Edit Existing
            </button>
          )}
        </div>
      )}

      {!nameConflict && similarNames.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-amber-800">
            <AlertTriangle size={13} className="text-amber-600 shrink-0" />
            <span>Similar existing item(s) found — check before adding a duplicate:</span>
          </div>
          <div className="flex flex-wrap gap-1.5 pl-5">
            {similarNames.map((sim) => (
              <button
                key={sim._id}
                type="button"
                onClick={() => canEdit && typeof onEditExisting === 'function' && onEditExisting(sim)}
                className="inline-flex items-center gap-1 rounded-lg bg-white border border-amber-300 px-2 py-0.5 text-[11px] font-medium text-amber-900 hover:bg-amber-100 transition cursor-pointer"
              >
                <span>{sim.name}</span>
                {sim.code && <span className="font-mono text-[10px] text-amber-700">({sim.code})</span>}
                {canEdit && typeof onEditExisting === 'function' && <Pencil size={9} className="text-amber-700" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
