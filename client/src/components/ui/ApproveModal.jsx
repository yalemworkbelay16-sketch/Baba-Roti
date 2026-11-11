import React, { useState } from 'react';
import {
  CheckCircle, ShieldCheck, PackageCheck, PackageOpen,
  XCircle, Eye, EyeOff, AlertTriangle, Lock, Clock, FileText,
} from 'lucide-react';
import Modal from './Modal';
import Button from './Button';

// ── Action config ─────────────────────────────────────────────────────
const ACTION_CONFIG = {
  check: {
    label: 'Check',
    description: 'Mark this document as checked. You confirm the details are correct.',
    icon: CheckCircle,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    btnCls: 'bg-blue-600 hover:bg-blue-700',
    isDangerous: false,
  },
  approve: {
    label: 'Approve',
    description: 'Approve this document. Once approved it can be received / posted.',
    icon: ShieldCheck,
    color: 'text-violet-600',
    bg: 'bg-violet-50',
    btnCls: 'bg-violet-600 hover:bg-violet-700',
    isDangerous: false,
  },
  receive: {
    label: 'Receive',
    description: 'Confirm goods received. Stock levels will be updated immediately.',
    icon: PackageCheck,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    btnCls: 'bg-emerald-600 hover:bg-emerald-700',
    isDangerous: false,
  },
  post: {
    label: 'Post',
    description: 'Post and lock this voucher. The document will be filed.',
    icon: PackageOpen,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    btnCls: 'bg-emerald-600 hover:bg-emerald-700',
    isDangerous: false,
  },
  cancel: {
    label: 'Cancel',
    description: 'Cancel this purchase. This action cannot be undone.',
    icon: XCircle,
    color: 'text-red-600',
    bg: 'bg-red-50',
    btnCls: 'bg-red-600 hover:bg-red-700',
    isDangerous: true,
  },
  void: {
    label: 'Void',
    description: 'Void this voucher and reverse all stock changes. Cannot be undone.',
    icon: XCircle,
    color: 'text-red-600',
    bg: 'bg-red-50',
    btnCls: 'bg-red-600 hover:bg-red-700',
    isDangerous: true,
  },
};
// ── Workflow steps per mode ───────────────────────────────────────────
const PURCHASE_STEPS = ['draft', 'checked', 'approved', 'received'];
const TXN_STEPS = ['pending', 'checked', 'approved', 'posted'];
const STEP_ICON = {
  draft: FileText,
  pending: Clock,
  checked: CheckCircle,
  approved: ShieldCheck,
  received: PackageCheck,
  posted: PackageOpen,
};
// ── Workflow stepper ──────────────────────────────────────────────────
function WorkflowStepper({ currentStatus, mode }) {
  const steps = mode === 'purchase' ? PURCHASE_STEPS : TXN_STEPS;
  const currentIdx = steps.indexOf(currentStatus);

  return (
    <div className="flex items-center">
      {steps.map((step, idx) => {
        const done = idx < currentIdx;
        const active = idx === currentIdx;
        const upcoming = idx > currentIdx;
        const Icon = STEP_ICON[step] ?? CheckCircle;

        return (
          <React.Fragment key={step}>
            <div className="flex flex-col items-center gap-1 min-w-[56px]">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all
                ${done ? 'border-emerald-500 bg-emerald-500 text-white' : ''}
                ${active ? 'border-blue-600 bg-blue-600 text-white shadow-md' : ''}
                ${upcoming ? 'border-ink-200 bg-white text-ink-300' : ''}`}>
                <Icon size={14} />
              </div>
              <span className={`text-xs font-medium capitalize leading-none text-center
                ${done ? 'text-emerald-600' : ''}
                ${active ? 'text-blue-700 font-semibold' : ''}
                ${upcoming ? 'text-ink-400' : ''}`}>
                {step}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`mb-5 h-0.5 w-6 flex-shrink-0
                ${idx < currentIdx ? 'bg-emerald-400' : 'bg-ink-200'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
// ── Audit trail timeline ──────────────────────────────────────────────
export function TrailTimeline({ trail = [] }) {
  if (!trail.length) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Audit Trail</p>
      <div className="relative border-l-2 border-ink-100 pl-4 space-y-3">
        {trail.map((entry, i) => (
          <div key={i} className="relative">
            <span className="absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2 border-white bg-ink-300" />
            <p className="text-xs font-semibold capitalize text-ink-700">{entry.action}</p>
            <p className="text-xs text-ink-400">
              {entry.byName ?? '—'}
              {entry.byRole ? ` (${entry.byRole})` : ''}
              {entry.at ? ` · ${new Date(entry.at).toLocaleString()}` : ''}
            </p>
            {entry.note && (
              <p className="mt-0.5 text-xs italic text-ink-400">"{entry.note}"</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
// ── Main ApproveModal ─────────────────────────────────────────────────
export default function ApproveModal({
  open, onClose, onConfirm,
  action, entityLabel,
  loading = false, error = null,
  currentStatus, mode = 'purchase',
  trail = [],
}) {
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [note, setNote] = useState('');

  const cfg = ACTION_CONFIG[action] ?? ACTION_CONFIG.check;
  const Icon = cfg.icon;

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onConfirm(password, note);
    setPassword('');
    setNote('');
  };

  const handleClose = () => {
    setPassword(''); setNote(''); onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title={`${cfg.label}: ${entityLabel ?? ''}`} width="max-w-lg">
      <div className="space-y-5">

        {/* Workflow stepper */}
        {currentStatus && (
          <div className="flex justify-center py-2 overflow-x-auto">
            <WorkflowStepper currentStatus={currentStatus} mode={mode} />
          </div>
        )}

        {/* Action description */}
        <div className={`flex items-start gap-3 rounded-xl p-3 ${cfg.bg}`}>
          <Icon size={20} className={`mt-0.5 flex-shrink-0 ${cfg.color}`} />
          <div>
            <p className={`font-semibold text-sm ${cfg.color}`}>{cfg.label}</p>
            <p className="text-xs text-ink-600 mt-0.5">{cfg.description}</p>
          </div>
        </div>

        {/* Danger warning */}
        {cfg.isDangerous && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-red-500" />
            <p className="text-xs font-medium text-red-700">
              This action is irreversible. Enter your password to confirm you authorise this.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Password */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-600">
              Your password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
              <input
                type={showPw ? 'text' : 'password'}
                required
                autoFocus
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your login password…"
                className="w-full rounded-lg border border-ink-200 py-2 pl-9 pr-10 text-sm outline-none focus:border-blue-500"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-300 hover:text-ink-600"
              >
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-600">
              Note <span className="font-normal text-ink-400">(optional)</span>
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Add a remark for the audit trail…"
              className="w-full resize-none rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertTriangle size={14} className="flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <button
              type="submit"
              disabled={loading || !password}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white
                disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${cfg.btnCls}`}
            >
              {loading ? 'Verifying…' : `Confirm ${cfg.label}`}
            </button>
          </div>
        </form>

        {/* Audit trail */}
        {trail.length > 0 && (
          <div className="border-t border-ink-100 pt-4">
            <TrailTimeline trail={trail} />
          </div>
        )}
      </div>
    </Modal>
  );
}
