import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import MobileBottomNav from './MobileBottomNav';
import AiChat from '../AiChat';

const titles = {
  '/': 'Dashboard',
  '/pos': 'POS Ordering',
  '/captain-order': 'Captain Order',
  '/cash-sales': 'Baba Consumption',
  '/menu': 'Digital Menu',
  '/materials': 'Raw Materials',
  '/production': 'Kitchen & Bar Production',
  '/products': 'Menu & Recipes',
  '/analytics': 'Analytics & Performance',
  '/expenses': 'Expenses & Petty Cash',
  '/transactions': 'Stock Movements',
  '/transactions/cash-grv': 'Cash GRV Entries',
  '/transactions/credit-grv': 'Credit GRV Entries',
  '/transactions/fresh-bazaar': 'Fresh Bazaar Entries',
  '/transactions/pos-adjustment': '+ve Adjustment Entries',
  '/transactions/disposal': 'Goods Disposal Entries',
  '/transactions/neg-adjustment': '−ve Adjustment Entries',
  '/sales-import': 'Sales & POS Import',
  '/purchases': 'Purchases',
  '/suppliers': 'Suppliers Directory',
  '/reports': 'Reports & Analytics',
  '/reports/summary': 'Overview Summary Report',
  '/reports/stock-balance': 'Stock Balance Sheet',
  '/reports/inventory-count': 'Inventory Count',
  '/reports/daily': 'Daily Movement Report',
  '/reports/cash-grv': 'Cash GRV Report',
  '/reports/credit-grv': 'Credit GRV Report',
  '/reports/fresh-bazaar': 'Fresh Bazaar Report',
  '/reports/pos-adjustment': '+ve Adjustment Report',
  '/reports/disposal': 'Goods Disposal Report',
  '/reports/neg-adjustment': '−ve Adjustment Report',
  '/reports/stock-levels': 'Stock Levels Report',
  '/reports/purchases': 'Purchases Report',
  '/users': 'Staff Accounts',
  '/employees': 'Employee Management',
  '/consumption': 'Consumption Management',
  '/activity-log': 'Activity & Audit Log',
  '/settings': 'System Settings',
  '/profile': 'User Profile',
  '/recycle-bin': 'Recycle Bin',
  '/stock-requests': 'Stock Issue & Request',
};

const DashboardLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);  // mobile overlay
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);  // desktop collapse
  const location = useLocation();
  const isPos = location.pathname === '/pos';
  const isDashboard = location.pathname === '/';
  const title = titles[location.pathname] || 'Baba Roti Café';

  return (
    <div className="flex h-screen overflow-hidden bg-[#f4f7fb]">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(c => !c)}
        onExpand={() => setSidebarCollapsed(false)}
      />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Topbar: hidden on mobile when viewing the mobile-optimized Dashboard or POS */}
        <div className={(isDashboard || isPos) ? 'hidden lg:block' : 'block'}>
          <Topbar
            onMenuClick={() => setSidebarOpen(true)}
            onToggleCollapse={() => setSidebarCollapsed(c => !c)}
            title={title}
          />
        </div>
        {isPos ? (
          <main className="flex-1 flex flex-col overflow-hidden min-h-0 bg-[#f4f7fb] pb-16 lg:pb-0">
            <Outlet />
          </main>
        ) : (
          <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-7 sm:py-6 flex flex-col justify-between pb-32 lg:pb-6 bg-[#f4f7fb]">
            <div className="w-full max-w-[1600px] mx-auto">
              <Outlet />
            </div>
            <footer className="w-full max-w-[1600px] mx-auto mt-10 pt-5 border-t border-slate-200/80 hidden lg:flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 pb-2">
              <p>© 2026 Baba Roti Café Management System · All rights reserved.</p>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span>Developed By <strong className="text-ink-800 font-semibold">Mega Tech Teams</strong></span>
              </div>
            </footer>
          </main>
        )}
      </div>

      {/* Fixed Mobile Bottom Navigation (Home, Orders, Inventory, Finance, More) */}
      <MobileBottomNav onOpenMenu={() => setSidebarOpen(true)} />

      {/* AI Chat — floats over every page */}
      <AiChat />
    </div>
  );
};

export default DashboardLayout;
