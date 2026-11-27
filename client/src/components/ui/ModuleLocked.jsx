import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ShieldAlert, ArrowLeft, Phone, Mail, KeyRound } from 'lucide-react';
import Button from './Button';

export default function ModuleLocked({
  moduleName = 'Subsystem Suite (POS Ordering, Captain Order & Baba Consumption)',
  description = 'This advanced Point of Sale & Captain Order Subsystem is a premium licensed feature. It has been locked by the software developer / system owner for this installation.',
}) {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[75vh] items-center justify-center p-4">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-blue-500/20 bg-gradient-to-b from-[#0c1533] via-[#091129] to-[#050b1a] p-8 text-center shadow-2xl shadow-blue-900/30 backdrop-blur-xl">
        {/* Glow ambient background */}
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-48 w-48 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/2 -translate-x-1/2 h-48 w-48 rounded-full bg-indigo-500/15 blur-3xl" />

        {/* Floating Lock Icon with pulsing ring */}
        <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center">
          <div className="absolute inset-0 animate-ping rounded-full bg-red-500/10" style={{ animationDuration: '3s' }} />
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-rose-500/20 to-amber-500/20 border border-rose-500/30" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-rose-600 to-amber-600 shadow-lg shadow-rose-900/50 text-white">
            <Lock size={30} strokeWidth={2.5} />
          </div>
        </div>

        {/* Badges */}
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-bold text-rose-300">
          <ShieldAlert size={13} />
          Feature Locked by System Developer
        </div>

        {/* Title */}
        <h2 className="mb-2 text-2xl font-black tracking-tight text-white font-display">
          Module Not Licensed
        </h2>

        <p className="mb-2 text-sm font-semibold text-blue-300">
          {moduleName}
        </p>

        <p className="mb-6 text-xs text-ink-300 leading-relaxed max-w-md mx-auto">
          {description}
        </p>

        {/* Developer Contact Box */}
        <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-left">
          <div className="flex items-center gap-2 mb-2 text-xs font-bold text-amber-300">
            <KeyRound size={14} />
            To Activate This Module:
          </div>
          <p className="text-xs text-ink-300 mb-3">
            Please contact your system provider or software developer to purchase the license key or enable this module for your business.
          </p>
          <div className="flex flex-wrap gap-3 text-[11px] text-ink-200">
            <span className="inline-flex items-center gap-1 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
              <Mail size={12} className="text-blue-400" /> developer@system.com
            </span>
            <span className="inline-flex items-center gap-1 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
              <Phone size={12} className="text-emerald-400" /> Software Vendor Support
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-5 py-2.5 text-xs font-bold text-white hover:bg-white/20 transition cursor-pointer"
          >
            <ArrowLeft size={14} /> Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
