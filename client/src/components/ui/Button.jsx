import React from 'react';

const variants = {
  primary: 'bg-ink-900 text-white hover:bg-ink-800',
  brass: 'bg-brass-400 text-ink-900 hover:bg-brass-500',
  ghost: 'bg-transparent text-ink-600 hover:bg-ink-50',
  danger: 'bg-red-50 text-red-600 hover:bg-red-100',
};

const Button = ({ children, variant = 'primary', className = '', ...props }) => (
  <button
    className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
    {...props}
  >
    {children}
  </button>
);

export default Button;
