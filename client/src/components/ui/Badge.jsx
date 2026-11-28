import React from 'react';

const styles = {
  green: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
  emerald: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
  blue: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200',
  indigo: 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200',
  purple: 'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-200',
  teal: 'bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-200',
  amber: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
  ink: 'bg-ink-50 text-ink-600 ring-1 ring-inset ring-ink-200',
  brass: 'bg-brass-50 text-brass-700 ring-1 ring-inset ring-brass-200',
};

const Badge = ({ children, color = 'ink' }) => (
  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[color]}`}>
    {children}
  </span>
);

export default Badge;
