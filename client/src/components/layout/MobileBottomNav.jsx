import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import SavingsRoundedIcon from '@mui/icons-material/SavingsRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';

/**
 * MobileBottomNav
 * Fixed bottom navigation bar for smartphones matching the reference design.
 * Features: Home, Orders, Inventory, Finance, and More.
 * Displayed exclusively on mobile viewports (lg:hidden).
 */
export default function MobileBottomNav({ onOpenMenu }) {
  const location = useLocation();
  const { user, canSeeNav, logout } = useAuth();
  const isWaiter = user?.role === 'waiter';

  const isHomeActive = location.pathname === '/';
  const isPosActive = location.pathname === '/pos';
  const isCaptainActive = location.pathname === '/captain-order';
  const isOrdersActive = ['/pos', '/captain-order', '/cash-sales'].some((p) =>
    location.pathname.startsWith(p)
  );
  const isInventoryActive = ['/materials', '/products', '/suppliers', '/consumption'].some((p) =>
    location.pathname.startsWith(p)
  );
  const isFinanceActive = ['/expenses', '/analytics', '/reports'].some((p) =>
    location.pathname.startsWith(p)
  );

  const hasExtraNav = Boolean(
    canSeeNav('dashboard') ||
    canSeeNav('consumption') ||
    canSeeNav('rawMaterials') ||
    canSeeNav('products') ||
    canSeeNav('stockMovements') ||
    canSeeNav('expenses') ||
    canSeeNav('suppliers')
  );

  // ── Waiter Mobile Phone Navigation (Only when strictly limited to Orders) ──
  if (isWaiter && !hasExtraNav) {
    return (
      <nav
        aria-label="Waiter Mobile Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-purple-200/80 px-4 py-1.5 flex items-center justify-around shadow-[0_-4px_25px_rgba(0,0,0,0.08)] lg:hidden"
        style={{
          paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
        }}
      >
        {/* Waiter 1: Take Order (POS) */}
        <NavLink
          to="/pos"
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all duration-200 cursor-pointer ${
            isPosActive
              ? 'text-purple-700 font-black scale-105'
              : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
        >
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
              isPosActive ? 'bg-purple-100 text-purple-700 shadow-sm' : 'text-slate-500'
            }`}
          >
            <ReceiptLongRoundedIcon sx={{ fontSize: 22 }} />
          </span>
          <span className="text-[10px] tracking-tight mt-0.5">Take Order</span>
        </NavLink>

        {/* Waiter 2: Active Orders / Tables */}
        <NavLink
          to="/captain-order"
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all duration-200 cursor-pointer ${
            isCaptainActive
              ? 'text-purple-700 font-black scale-105'
              : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
        >
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
              isCaptainActive ? 'bg-purple-100 text-purple-700 shadow-sm' : 'text-slate-500'
            }`}
          >
            <Inventory2RoundedIcon sx={{ fontSize: 22 }} />
          </span>
          <span className="text-[10px] tracking-tight mt-0.5">Tables & Orders</span>
        </NavLink>

        {/* Waiter 3: More (Opens Mobile Sidebar Drawer) */}
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Open More Menu"
          className="flex flex-col items-center justify-center flex-1 py-1 text-slate-500 hover:text-purple-700 font-medium transition-all duration-200 cursor-pointer"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 hover:bg-purple-50 hover:text-purple-700 transition-colors">
            <MoreHorizRoundedIcon sx={{ fontSize: 22 }} />
          </span>
          <span className="text-[10px] tracking-tight mt-0.5">More</span>
        </button>

        {/* Waiter 4: Sign Out */}
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Sign out from waiter account?')) {
              logout();
            }
          }}
          className="flex flex-col items-center justify-center flex-1 py-1 text-slate-500 hover:text-rose-600 font-medium transition-all duration-200 cursor-pointer"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors">
            <MoreHorizRoundedIcon sx={{ fontSize: 22 }} />
          </span>
          <span className="text-[10px] tracking-tight mt-0.5">Logout</span>
        </button>
      </nav>
    );
  }

  // ── Standard Mobile Navigation for Other Roles ───────────────────
  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200/80 px-3 py-1.5 flex items-center justify-around shadow-[0_-4px_25px_rgba(0,0,0,0.06)] lg:hidden"
      style={{
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
      }}
    >
      {/* 1. Home */}
      {canSeeNav('dashboard') && (
        <NavLink
          to="/"
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all duration-200 cursor-pointer ${
            isHomeActive
              ? 'text-blue-600 font-bold scale-105'
              : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
        >
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
              isHomeActive ? 'bg-blue-50 text-blue-600' : 'text-slate-500'
            }`}
          >
            <HomeRoundedIcon sx={{ fontSize: 22 }} />
          </span>
          <span className="text-[10px] tracking-tight mt-0.5">Home</span>
        </NavLink>
      )}

      {/* 2. Orders (Subsystem Suite) */}
      {canSeeNav('subsystem') && (
        <NavLink
          to="/pos"
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all duration-200 cursor-pointer ${
            isOrdersActive
              ? 'text-blue-600 font-bold scale-105'
              : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
        >
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
              isOrdersActive ? 'bg-blue-50 text-blue-600' : 'text-slate-500'
            }`}
          >
            <ReceiptLongRoundedIcon sx={{ fontSize: 22 }} />
          </span>
          <span className="text-[10px] tracking-tight mt-0.5">Orders</span>
        </NavLink>
      )}

      {/* 3. Inventory / Consumption */}
      {(canSeeNav('rawMaterials') || canSeeNav('products') || canSeeNav('suppliers') || canSeeNav('consumption')) && (
        <NavLink
          to={canSeeNav('consumption') && !canSeeNav('rawMaterials') ? '/consumption' : '/materials'}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all duration-200 cursor-pointer ${
            isInventoryActive
              ? 'text-blue-600 font-bold scale-105'
              : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
        >
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
              isInventoryActive ? 'bg-blue-50 text-blue-600' : 'text-slate-500'
            }`}
          >
            <Inventory2RoundedIcon sx={{ fontSize: 22 }} />
          </span>
          <span className="text-[10px] tracking-tight mt-0.5">
            {canSeeNav('consumption') && !canSeeNav('rawMaterials') ? 'Consumption' : 'Inventory'}
          </span>
        </NavLink>
      )}

      {/* 4. Finance & Expenses */}
      {(canSeeNav('expenses') || canSeeNav('analytics')) && (
        <NavLink
          to="/expenses"
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all duration-200 cursor-pointer ${
            isFinanceActive
              ? 'text-blue-600 font-bold scale-105'
              : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
        >
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
              isFinanceActive ? 'bg-blue-50 text-blue-600' : 'text-slate-500'
            }`}
          >
            <SavingsRoundedIcon sx={{ fontSize: 22 }} />
          </span>
          <span className="text-[10px] tracking-tight mt-0.5">Finance</span>
        </NavLink>
      )}

      {/* 5. More (Opens Mobile Sidebar Drawer) */}
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Open More Menu"
        className="flex flex-col items-center justify-center flex-1 py-1 text-slate-500 hover:text-slate-800 font-medium transition-all duration-200 cursor-pointer"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 transition-colors">
          <MoreHorizRoundedIcon sx={{ fontSize: 22 }} />
        </span>
        <span className="text-[10px] tracking-tight mt-0.5">More</span>
      </button>
    </nav>
  );
}
