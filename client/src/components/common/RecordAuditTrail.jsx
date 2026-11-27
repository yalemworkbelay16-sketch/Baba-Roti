import React from 'react';
import { ShieldCheck, UserCheck, Clock, FileSpreadsheet, PenLine, ChefHat } from 'lucide-react';

const ROLE_LABELS = {
  admin: 'Admin',
  manager: 'Manager',
  operation_manager: 'Operation Manager',
  executive_chef: 'Executive Chef',
  finance: 'Finance',
  supervisor: 'Supervisor',
  storekeeper: 'Store Keeper',
  cashier: 'Cashier',
  waiter: 'Waiter',
  fb_team: 'F & B Team',
  dev: 'System Developer',
  system: 'System',
};

const SOURCE_CONFIG = {
  excel_import: {
    label: 'Imported via Excel',
    cls: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    Icon: FileSpreadsheet,
  },
  staff_sync: {
    label: 'Staff Account Sync',
    cls: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    Icon: UserCheck,
  },
  manual: {
    label: 'Registered Manually',
    cls: 'bg-blue-100 text-blue-800 border-blue-200',
    Icon: PenLine,
  },
};

function fmtDateTime(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function fmtRole(role) {
  if (!role) return '';
  return ROLE_LABELS[role] || role;
}

/**
 * Reusable Security & Audit Record panel displayed inside Detail/View modals.
 * Shows who registered/imported the record, exact timestamps, last modifier,
 * and (for products) who added/updated the recipe.
 */
export default function RecordAuditTrail({ record, showRecipeAudit = false }) {
  if (!record) return null;

  const sourceKey = record.registrationSource || 'manual';
  const sourceInfo = SOURCE_CONFIG[sourceKey] || SOURCE_CONFIG.manual;
  const SourceIcon = sourceInfo.Icon;

  const hasCreatorName = Boolean(record.createdByName && record.createdByName.trim());
  const creatorName = hasCreatorName
    ? record.createdByName
    : (sourceKey === 'excel_import' ? 'Excel Catalog Import (Pre-Audit)' : 'Pre-Audit Setup');
  const creatorRole = hasCreatorName ? fmtRole(record.createdByRole) : '';

  const hasUpdaterName = Boolean(record.updatedByName && record.updatedByName.trim());
  const hasTimestampUpdate = Boolean(
    record.updatedAt && record.createdAt && Math.abs(new Date(record.updatedAt) - new Date(record.createdAt)) > 2000
  );
  const hasUpdates = hasUpdaterName || hasTimestampUpdate;
  const updaterName = hasUpdaterName ? record.updatedByName : 'Updated (Pre-Audit Log)';
  const updaterRole = hasUpdaterName ? fmtRole(record.updatedByRole) : '';

  const hasRecipe = Array.isArray(record.ingredients) && record.ingredients.length > 0;
  const recipeAuthor = record.recipeAddedByName || record.updatedByName || record.createdByName || '';
  const recipeAuthorRole = record.recipeAddedByRole || (record.recipeAddedByName ? '' : (record.updatedByRole || record.createdByRole || ''));
  const recipeSourceLabel = record.recipeSource === 'excel_import' ? 'Imported via Excel' : 'Added Manually';

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/90 overflow-hidden text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 border-b border-slate-200 bg-slate-100/80">
        <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] text-slate-700">
          <ShieldCheck size={14} className="text-blue-600" />
          Security &amp; Audit Record
        </span>
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${sourceInfo.cls}`}>
          <SourceIcon size={11} />
          {sourceInfo.label}
        </span>
      </div>

      <div className="p-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Registered / Imported By */}
        <div className="rounded-lg bg-white border border-slate-200/80 p-2.5 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {sourceKey === 'excel_import' ? 'Imported By' : 'Registered By'}
          </p>
          <p className="font-semibold text-slate-900 flex items-center gap-1.5 flex-wrap">
            <span className={hasCreatorName ? 'text-slate-900' : 'text-slate-500 italic'}>{creatorName}</span>
            {creatorRole && (
              <span className="rounded bg-blue-50 border border-blue-200 px-1.5 py-0.2 text-[10px] font-bold text-blue-700">
                {creatorRole}
              </span>
            )}
          </p>
          <p className="text-[11px] text-slate-500 flex items-center gap-1">
            <Clock size={11} className="text-slate-400" />
            {fmtDateTime(record.createdAt)}
          </p>
        </div>

        {/* Last Modified By */}
        <div className="rounded-lg bg-white border border-slate-200/80 p-2.5 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Last Updated By
          </p>
          {hasUpdates ? (
            <>
              <p className="font-semibold text-slate-900 flex items-center gap-1.5 flex-wrap">
                <span className={hasUpdaterName ? 'text-slate-900' : 'text-slate-500 italic'}>{updaterName}</span>
                {updaterRole && (
                  <span className="rounded bg-amber-50 border border-amber-200 px-1.5 py-0.2 text-[10px] font-bold text-amber-800">
                    {updaterRole}
                  </span>
                )}
              </p>
              <p className="text-[11px] text-slate-500 flex items-center gap-1">
                <Clock size={11} className="text-slate-400" />
                {fmtDateTime(record.updatedAt)}
              </p>
            </>
          ) : (
            <p className="text-[11px] text-slate-400 italic pt-1">
              No edits since initial registration
            </p>
          )}
        </div>

        {/* Recipe Added / Updated By (Products only) */}
        {showRecipeAudit && (
          <div className="sm:col-span-2 rounded-lg bg-white border border-emerald-200/90 p-2.5 space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1">
                <ChefHat size={12} className="text-emerald-600" />
                Recipe Security Log
              </p>
              {hasRecipe && record.recipeSource && (
                <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  {recipeSourceLabel}
                </span>
              )}
            </div>
            {hasRecipe ? (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                <p className="font-semibold text-slate-900 flex items-center gap-1.5 flex-wrap">
                  <span>Added / Updated by:</span>
                  {recipeAuthor ? (
                    <>
                      <span className="text-emerald-800">{recipeAuthor}</span>
                      {recipeAuthorRole && (
                        <span className="rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 text-[10px] font-bold text-emerald-700">
                          {fmtRole(recipeAuthorRole)}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-slate-500 italic">Added prior to user audit tracking</span>
                  )}
                </p>
                <p className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Clock size={11} className="text-emerald-500" />
                  {fmtDateTime(record.recipeUpdatedAt || record.updatedAt || record.createdAt)}
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 italic">
                No recipe ingredients added yet.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
