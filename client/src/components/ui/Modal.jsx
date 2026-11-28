import React from 'react';
import { X } from 'lucide-react';

const Modal = ({ open, isOpen, onClose, title, children, width, maxWidth }) => {
  const isVisible = Boolean(open !== undefined ? open : (isOpen !== undefined ? isOpen : true));
  if (!isVisible) return null;
  const resolvedWidth = maxWidth || width || 'max-w-lg';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 dark:bg-black/75 backdrop-blur-[2px] px-3 sm:px-4">
      <div className={`w-full ${resolvedWidth} rounded-2xl border border-slate-200/80 dark:border-[#1e3363] bg-white dark:bg-[#08122b] shadow-2xl`}>
        <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-[#1b2f5e] px-5 py-4">
          <h3 className="font-display text-lg font-bold tracking-tight text-ink-900 dark:text-slate-100">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#11224a] hover:text-ink-800 dark:hover:text-white transition cursor-pointer">
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[82vh] overflow-y-auto px-5 py-4 sm:px-6">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
