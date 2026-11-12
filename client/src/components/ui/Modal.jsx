import React from 'react';
import { X } from 'lucide-react';

const Modal = ({ open, isOpen, onClose, title, children, width = 'max-w-lg' }) => {
  const isVisible = Boolean(open !== undefined ? open : (isOpen !== undefined ? isOpen : true));
  if (!isVisible) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className={`w-full ${width} rounded-xl bg-white shadow-xl`}>
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <h3 className="font-display text-lg text-ink-900">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1 text-ink-400 hover:bg-ink-50">
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
