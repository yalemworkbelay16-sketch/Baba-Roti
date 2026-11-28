import React from 'react';

const Card = ({ children, className = '', ...props }) => (
  <div className={`rounded-2xl border border-slate-200/85 dark:border-[#1b2f5e] bg-white dark:bg-[#08122b] p-5 sm:p-6 shadow-soft ${className}`} {...props}>
    {children}
  </div>
);

export default Card;
