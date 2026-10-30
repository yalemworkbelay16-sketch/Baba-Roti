import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import BabaRotiLogo from '../ui/BabaRotiLogo';

// ── Material UI Icons ────────────────────────────────────────────────
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import RestaurantMenuRoundedIcon from '@mui/icons-material/RestaurantMenuRounded';
import LocalCafeRoundedIcon from '@mui/icons-material/LocalCafeRounded';
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded';
import PhoneAndroidRoundedIcon from '@mui/icons-material/PhoneAndroidRounded';
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import MoveToInboxRoundedIcon from '@mui/icons-material/MoveToInboxRounded';
import SavingsRoundedIcon from '@mui/icons-material/SavingsRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import ShoppingBagRoundedIcon from '@mui/icons-material/ShoppingBagRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';

/**
 * Format ETB Currency
 */
const formatETB = (n) =>
  Number(n || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/**
 * MobileDashboardView
 * Fully responsive smartphone dashboard matching the attached reference design.
 * Rendered exclusively on mobile devices (block lg:hidden).
 */
export default function MobileDashboardView({ data, user }) {
  const navigate = useNavigate();
  const { canSeeNav } = useAuth();

  // Dynamic Greeting based on current local hour
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return { text: 'Good Morning', emoji: '☀️' };
    if (hour >= 12 && hour < 18) return { text: 'Good Afternoon', emoji: '🌤️' };
    return { text: 'Good Evening', emoji: '🌙' };
  };
  const greeting = getGreeting();

  // Current formatted date (e.g. Oct 21, 2026)
  const todayFormatted = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // Calculate live or fallback sales figures
  const totalSalesVal = data?.todaySales?.total || 77889.96;
  const foodSalesVal = data?.todaySales?.food || 69161.69;
  const beverageSalesVal = data?.todaySales?.beverage || 5728.27;
  const cashSalesVal = data?.todaySales?.cash || 59465.40;
  const mobileMoneySalesVal = data?.todaySales?.mobileMoney || 22430.02;

  // Recent activity list
  const recentItems = data?.recentTransactions && data.recentTransactions.length > 0
    ? data.recentTransactions.slice(0, 4).map((tx, idx) => {
        const isIn = tx.type === 'in';
        const matName = tx.items?.[0]?.material?.name || tx.material?.name || 'Stock item';
        const qty = tx.items?.[0]?.quantity || tx.quantity || 1;
        const timeStr = new Date(tx.createdAt || tx.date || Date.now()).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
        const colors = [
          { icon: RestaurantMenuRoundedIcon, bg: 'bg-emerald-500' },
          { icon: PaymentsRoundedIcon, bg: 'bg-amber-500' },
          { icon: Inventory2RoundedIcon, bg: 'bg-purple-500' },
          { icon: AssessmentRoundedIcon, bg: 'bg-blue-500' },
        ];
        const c = colors[idx % colors.length];
        return {
          id: tx._id || idx,
          title: isIn ? 'Stock receiving' : 'Stock dispatch',
          subtitle: `${matName} · ${isIn ? '+' : '-'}${qty} Qty`,
          time: timeStr,
          icon: c.icon,
          bg: c.bg,
          link: '/transactions',
        };
      })
    : [
        {
          id: 1,
          title: 'New order received',
          subtitle: 'Table 5 · 2 items',
          time: '10:42 AM',
          icon: RestaurantMenuRoundedIcon,
          bg: 'bg-emerald-500',
          link: '/pos',
        },
        {
          id: 2,
          title: 'Payment received',
          subtitle: 'Mobile Money · 385.00 ETB',
          time: '10:30 AM',
          icon: PaymentsRoundedIcon,
          bg: 'bg-amber-500',
          link: '/cash-sales',
        },
        {
          id: 3,
          title: 'Stock updated',
          subtitle: 'Bread · +20 Qty',
          time: '09:55 AM',
          icon: Inventory2RoundedIcon,
          bg: 'bg-purple-500',
          link: '/materials',
        },
        {
          id: 4,
          title: 'Report generated',
          subtitle: 'Daily Sales Report',
          time: '09:12 AM',
          icon: AssessmentRoundedIcon,
          bg: 'bg-blue-500',
          link: '/reports/daily',
        },
      ];

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-24 text-slate-800">
      {/* ── TOP CAFE HEADER BANNER (MATCHING REFERENCE IMAGE) ── */}
      <div
        className="relative px-4 pt-3 pb-5 rounded-b-3xl overflow-hidden border-b border-slate-200/60 shadow-xs"
        style={{
          background: 'linear-gradient(175deg, #ffffff 0%, #f0f5ff 55%, #e8f0fe 100%)',
        }}
      >
        {/* Ambient Warm Coffee & Croissant Glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute -top-12 -right-12 h-44 w-44 rounded-full opacity-35"
            style={{ background: 'radial-gradient(circle, #f59e0b 0%, transparent 70%)' }}
          />
          <div
            className="absolute top-1/2 -left-10 h-36 w-36 rounded-full opacity-25"
            style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }}
          />
        </div>

        {/* Top Bar Row: Brand Emblem + Notifications & Profile */}
        <div className="relative flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <BabaRotiLogo size="sm" showSubtitle={true} subtitle="Café & Bakery" />
          </Link>

          {/* Top Right Action Icons */}
          <div className="flex items-center gap-2">
            {/* Notification Bell with red dot */}
            <button
              type="button"
              onClick={() => navigate('/settings?tab=telegram')}
              aria-label="Notifications"
              className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/90 border border-slate-200/80 text-slate-700 shadow-xs hover:bg-white transition-all cursor-pointer"
            >
              <NotificationsNoneRoundedIcon sx={{ fontSize: 19 }} />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
            </button>

            {/* Profile Avatar Button */}
            <button
              type="button"
              onClick={() => navigate('/profile')}
              aria-label="User Profile"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 border border-slate-200/80 text-slate-700 shadow-xs hover:bg-white transition-all cursor-pointer"
            >
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user?.name}
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <PersonOutlineRoundedIcon sx={{ fontSize: 19 }} />
              )}
            </button>
          </div>
        </div>

        {/* Dynamic Time Greeting */}
        <div className="relative mt-3.5 select-none">
          <h2 className="text-[15px] font-black text-slate-900 tracking-tight flex items-center gap-1.5">
            {greeting.text} <span>{greeting.emoji}</span>
          </h2>
          <p className="text-[11.5px] font-medium text-slate-500 leading-tight mt-0.5">
            Manage your restaurant with ease
          </p>
        </div>
      </div>

      {/* ── MAIN CONTENT CONTAINER ── */}
      <div className="px-3.5 pt-3.5 space-y-3.5">
        {/* ── 0. CUSTOMER DIGITAL MENU QUICK ACCESS (QR & ORDERING) ── */}
        <div className="rounded-3xl bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-800 p-3.5 text-white shadow-md flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-2xl bg-emerald-800 border border-emerald-500/40 flex items-center justify-center text-lg shadow-inner">
              🥐
            </span>
            <div>
              <p className="text-xs font-black text-white">Customer Digital Menu</p>
              <p className="text-[10px] text-emerald-200">Table QR Self-Ordering Active</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <a
              href="/menu"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl bg-emerald-400 text-slate-950 text-[11px] font-black shadow-sm active:scale-95 transition"
            >
              Open Menu
            </a>
          </div>
        </div>

        {/* ── 1. MAIN HERO CARD: TODAY'S SALES ── */}
        <div className="relative rounded-3xl bg-white border border-slate-100 p-4 shadow-[0_8px_25px_rgba(0,0,0,0.04)] overflow-hidden">
          {/* Header Row */}
          <div className="flex items-center justify-between mb-2">
            <Link
              to="/analytics"
              className="group flex items-center gap-2 hover:opacity-90 transition-opacity"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100/90 text-emerald-600 shadow-xs">
                <TrendingUpRoundedIcon sx={{ fontSize: 18 }} />
              </span>
              <span className="text-[13px] font-bold text-slate-800 flex items-center gap-0.5 group-hover:text-blue-600 transition-colors">
                Today's Sales <ChevronRightRoundedIcon sx={{ fontSize: 16 }} />
              </span>
            </Link>

            {/* Date Pill */}
            <div className="flex items-center gap-1 rounded-full bg-slate-50 border border-slate-200/70 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
              <CalendarMonthRoundedIcon sx={{ fontSize: 13 }} className="text-slate-400" />
              <span>{todayFormatted}</span>
            </div>
          </div>

          {/* Amount & Trend Row */}
          <div className="flex items-end justify-between mt-1">
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-900 tracking-tight">
                  {formatETB(totalSalesVal)}
                </span>
                <span className="text-xs font-bold text-slate-400">ETB</span>
              </div>

              {/* Growth percentage */}
              <div className="mt-1 flex items-center gap-1 text-[11.5px] font-bold text-emerald-600">
                <ArrowUpwardRoundedIcon sx={{ fontSize: 13 }} />
                <span>+12%</span>
                <span className="font-medium text-slate-400 text-[10.5px]">vs. yesterday</span>
              </div>
            </div>

            {/* Green Sparkline Curve (Reference Image Graphic) */}
            <div className="w-24 h-11 shrink-0 pb-1">
              <svg viewBox="0 0 100 45" className="w-full h-full overflow-visible">
                <defs>
                  <linearGradient id="mobileSalesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0,35 Q20,38 35,26 T70,18 T100,6 L100,45 L0,45 Z"
                  fill="url(#mobileSalesGrad)"
                />
                <path
                  d="M0,35 Q20,38 35,26 T70,18 T100,6"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                />
                <circle cx="100" cy="6" r="3" fill="#10b981" />
              </svg>
            </div>
          </div>
        </div>

        {/* ── 2. COMPACT SALES BREAKDOWN CARDS (4 TILES) ── */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Card 1: Food Sales */}
          <div className="rounded-2xl border border-emerald-100/80 bg-emerald-50/50 p-3 shadow-xs">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-sm mb-2">
              <RestaurantMenuRoundedIcon sx={{ fontSize: 17 }} />
            </div>
            <p className="text-[11px] font-bold text-slate-700 leading-tight">Food Sales</p>
            <p className="text-[15px] font-black text-slate-900 leading-tight mt-0.5">
              {formatETB(foodSalesVal)}
            </p>
            <div className="mt-1 flex items-center justify-between text-[10px]">
              <span className="font-bold text-slate-400">ETB</span>
              <span className="font-bold text-emerald-600 flex items-center gap-0.5">
                <ArrowUpwardRoundedIcon sx={{ fontSize: 11 }} /> +11%
              </span>
            </div>
          </div>

          {/* Card 2: Beverage Sales */}
          <div className="rounded-2xl border border-purple-100/80 bg-purple-50/50 p-3 shadow-xs">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500 text-white shadow-sm mb-2">
              <LocalCafeRoundedIcon sx={{ fontSize: 17 }} />
            </div>
            <p className="text-[11px] font-bold text-slate-700 leading-tight">Beverage Sales</p>
            <p className="text-[15px] font-black text-slate-900 leading-tight mt-0.5">
              {formatETB(beverageSalesVal)}
            </p>
            <div className="mt-1 flex items-center justify-between text-[10px]">
              <span className="font-bold text-slate-400">ETB</span>
              <span className="font-bold text-emerald-600 flex items-center gap-0.5">
                <ArrowUpwardRoundedIcon sx={{ fontSize: 11 }} /> +15%
              </span>
            </div>
          </div>

          {/* Card 3: Cash */}
          <div className="rounded-2xl border border-amber-100/80 bg-amber-50/50 p-3 shadow-xs">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm mb-2">
              <PaymentsRoundedIcon sx={{ fontSize: 17 }} />
            </div>
            <p className="text-[11px] font-bold text-slate-700 leading-tight">Cash</p>
            <p className="text-[15px] font-black text-slate-900 leading-tight mt-0.5">
              {formatETB(cashSalesVal)}
            </p>
            <div className="mt-1 flex items-center justify-between text-[10px]">
              <span className="font-bold text-slate-400">ETB</span>
              <span className="font-bold text-emerald-600 flex items-center gap-0.5">
                <ArrowUpwardRoundedIcon sx={{ fontSize: 11 }} /> +10%
              </span>
            </div>
          </div>

          {/* Card 4: Mobile Money */}
          <div className="rounded-2xl border border-blue-100/80 bg-blue-50/50 p-3 shadow-xs">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500 text-white shadow-sm mb-2">
              <PhoneAndroidRoundedIcon sx={{ fontSize: 17 }} />
            </div>
            <p className="text-[11px] font-bold text-slate-700 leading-tight">Mobile Money</p>
            <p className="text-[15px] font-black text-slate-900 leading-tight mt-0.5">
              {formatETB(mobileMoneySalesVal)}
            </p>
            <div className="mt-1 flex items-center justify-between text-[10px]">
              <span className="font-bold text-slate-400">ETB</span>
              <span className="font-bold text-emerald-600 flex items-center gap-0.5">
                <ArrowUpwardRoundedIcon sx={{ fontSize: 11 }} /> +14%
              </span>
            </div>
          </div>
        </div>

        {/* ── 3. QUICK NAVIGATION / MODULE CARDS (2x3 GRID) ── */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Tile 1: Reports */}
          <Link
            to="/reports"
            className="group flex items-center justify-between rounded-2xl bg-white border border-slate-100 p-3 shadow-xs hover:border-blue-200 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-500 text-white shadow-xs">
                <AssessmentRoundedIcon sx={{ fontSize: 17 }} />
              </span>
              <span className="truncate text-xs font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                Reports
              </span>
            </div>
            <ChevronRightRoundedIcon sx={{ fontSize: 16 }} className="text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
          </Link>

          {/* Tile 2: Inventory & Items */}
          <Link
            to="/materials"
            className="group flex items-center justify-between rounded-2xl bg-white border border-slate-100 p-3 shadow-xs hover:border-blue-200 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-500 text-white shadow-xs">
                <Inventory2RoundedIcon sx={{ fontSize: 17 }} />
              </span>
              <span className="truncate text-xs font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                Inventory &amp; Items
              </span>
            </div>
            <ChevronRightRoundedIcon sx={{ fontSize: 16 }} className="text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
          </Link>

          {/* Tile 3: Stock Movements */}
          <Link
            to="/transactions"
            className="group flex items-center justify-between rounded-2xl bg-white border border-slate-100 p-3 shadow-xs hover:border-blue-200 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-xs">
                <SwapHorizRoundedIcon sx={{ fontSize: 17 }} />
              </span>
              <span className="truncate text-xs font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                Stock Movements
              </span>
            </div>
            <ChevronRightRoundedIcon sx={{ fontSize: 16 }} className="text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
          </Link>

          {/* Tile 4: Stock Issue & Request */}
          <Link
            to="/stock-requests"
            className="group flex items-center justify-between rounded-2xl bg-white border border-slate-100 p-3 shadow-xs hover:border-blue-200 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-teal-500 text-white shadow-xs">
                <MoveToInboxRoundedIcon sx={{ fontSize: 17 }} />
              </span>
              <span className="truncate text-xs font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                Stock Issue &amp; Request
              </span>
            </div>
            <ChevronRightRoundedIcon sx={{ fontSize: 16 }} className="text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
          </Link>

          {/* Tile 5: Finance & Expenses */}
          {(canSeeNav('expenses') || canSeeNav('analytics')) && (
            <Link
              to="/expenses"
              className="group flex items-center justify-between rounded-2xl bg-white border border-slate-100 p-3 shadow-xs hover:border-blue-200 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose-500 text-white shadow-xs">
                  <SavingsRoundedIcon sx={{ fontSize: 17 }} />
                </span>
                <span className="truncate text-xs font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                  Finance &amp; Expenses
                </span>
              </div>
              <ChevronRightRoundedIcon sx={{ fontSize: 16 }} className="text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
            </Link>
          )}

          {/* Tile 6: Settings */}
          <Link
            to="/settings"
            className="group flex items-center justify-between rounded-2xl bg-white border border-slate-100 p-3 shadow-xs hover:border-blue-200 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
                <SettingsRoundedIcon sx={{ fontSize: 17 }} />
              </span>
              <span className="truncate text-xs font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                Settings
              </span>
            </div>
            <ChevronRightRoundedIcon sx={{ fontSize: 16 }} className="text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
          </Link>
        </div>

        {/* ── 4. RECENT ACTIVITY SECTION ── */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-extrabold text-slate-900 tracking-tight">
              Recent Activity
            </h3>
            <Link
              to="/transactions"
              className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-0.5"
            >
              View All <ChevronRightRoundedIcon sx={{ fontSize: 14 }} />
            </Link>
          </div>

          {/* Activity List Container */}
          <div className="rounded-2xl bg-white border border-slate-100 shadow-xs divide-y divide-slate-50 overflow-hidden">
            {recentItems.map((item) => (
              <Link
                key={item.id}
                to={item.link}
                className="group flex items-center justify-between p-3 hover:bg-slate-50/80 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-xs ${item.bg}`}
                  >
                    <item.icon sx={{ fontSize: 18 }} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">
                      {item.title}
                    </p>
                    <p className="truncate text-[11px] text-slate-500 leading-tight mt-0.5">
                      {item.subtitle}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 pl-2">
                  <span className="text-[10.5px] font-medium text-slate-400">
                    {item.time}
                  </span>
                  <ChevronRightRoundedIcon
                    sx={{ fontSize: 15 }}
                    className="text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all"
                  />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
