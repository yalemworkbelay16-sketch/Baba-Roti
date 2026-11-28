import React from 'react';

const Card = ({ children, className = '', ...props }) => (
  <div className={`rounded-2xl border border-slate-200/85 bg-white p-5 sm:p-6 shadow-soft ${className}`} {...props}>
    {children}
  </div>
);

export default Card;
