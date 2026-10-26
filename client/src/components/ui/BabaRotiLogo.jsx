import React from 'react';

/**
 * Baba Roti Café Official Badge Icon / Emblem
 * Features the authentic signature Mexican Coffee Bun, butter drip & coffee beans
 */
export const BabaRotiIcon = ({ size = 36, className = '', alt = 'Baba Roti Café' }) => {
  const px = typeof size === 'number' ? `${size}px` : size;
  return (
    <div
      style={{ width: px, height: px, minWidth: px, minHeight: px }}
      className={`relative inline-flex items-center justify-center shrink-0 rounded-full overflow-hidden bg-[#450f0f] shadow-md ring-2 ring-amber-400/50 transition-transform duration-200 hover:scale-105 ${className}`}
      title="Baba Roti Café"
    >
      <img
        src="/baba-roti-logo.png"
        alt={alt}
        className="w-full h-full object-cover select-none"
        loading="eager"
        onError={(e) => {
          if (e.target.src.indexOf('baba-roti-logo.png') !== -1) {
            e.target.src = '/logo.png';
          }
        }}
      />
    </div>
  );
};

/**
 * Full Baba Roti Café Brand Component (used in Sidebar, Mobile Header, etc.)
 */
export default function BabaRotiLogo({
  collapsed = false,
  size = 'md', // 'sm' | 'md' | 'lg'
  showSubtitle = true,
  subtitle = 'Café & Bakery',
  className = '',
  isLight = false,
  textColor = '',
}) {
  const iconSizes = {
    sm: 32,
    md: 40,
    lg: 52,
  };

  const iconPx = typeof size === 'number' ? size : iconSizes[size] || 40;

  if (collapsed) {
    return (
      <div className={`flex items-center justify-center ${className}`} title="Baba Roti Café">
        <BabaRotiIcon size={iconPx} />
      </div>
    );
  }

  const brandTextColor = textColor || (isLight ? 'text-slate-900' : 'text-white');
  const subTextColor = isLight ? 'text-slate-500' : 'text-amber-200/80';

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Icon Emblem */}
      <div className="relative group transition-transform duration-200 hover:scale-105">
        <BabaRotiIcon size={iconPx} className="ring-2 ring-amber-400/60 shadow-lg" />
      </div>

      {/* Brand Typography */}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`font-extrabold tracking-tight leading-none text-[15px] transition-colors ${brandTextColor}`}>
            Baba Roti
          </span>
          <span className="rounded-md bg-gradient-to-r from-amber-400 to-amber-500 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-950 shadow-sm">
            Café
          </span>
        </div>

        {showSubtitle && (
          <p className={`mt-1 flex items-center gap-1.5 text-[10px] font-medium tracking-wide leading-none transition-colors ${subTextColor}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
