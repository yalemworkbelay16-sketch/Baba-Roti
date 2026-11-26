import React from 'react';
import { X } from 'lucide-react';

const Modal = ({ open, isOpen, onClose, title, children, width, maxWidth }) => {
  const isVisible = Boolean(open !== undefined ? open : (isOpen !== undefined ? isOpen : true));
  if (!isVisible) return null;
  const resolvedWidth = maxWidth || width || 'max-w-lg';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-3 sm:px-4">
      <div className={`w-full ${resolvedWidth} rounded-xl bg-white shadow-xl`}>
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3.5">
          <h3 className="font-display text-lg text-ink-900">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1 text-ink-400 hover:bg-ink-50 cursor-pointer">
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[82vh] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
