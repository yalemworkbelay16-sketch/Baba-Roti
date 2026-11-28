import React from 'react';

const toneMap = {
  ink: 'bg-ink-900 text-white',
  brass: 'bg-brass-400 text-ink-900',
  light: 'bg-white text-ink-900 border border-ink-100',
};

const StatCard = ({ label, value, sub, icon: Icon, tone = 'light' }) => (
  <div className={`rounded-2xl p-5 shadow-soft ${toneMap[tone]}`}>
    <div className="flex items-start justify-between">
      <p className={`text-sm font-medium ${tone === 'light' ? 'text-ink-500' : 'opacity-90'}`}>{label}</p>
      {Icon && (
        <span className={`rounded-xl p-2 ${tone === 'light' ? 'bg-slate-100 text-ink-600' : 'bg-white/15'}`}>
          <Icon size={16} strokeWidth={2.25} />
        </span>
      )}
    </div>
    <p className="tabular mt-3 text-3xl font-extrabold leading-none">{value}</p>
    {sub && <p className={`mt-2 text-xs font-medium ${tone === 'light' ? 'text-ink-500' : 'opacity-80'}`}>{sub}</p>}
  </div>
);

export default StatCard;
