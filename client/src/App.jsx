import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import DashboardLayout from './components/layout/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import RawMaterials from './pages/RawMaterials';
import StockTransactions from './pages/StockTransactions';
import Suppliers from './pages/Suppliers';
import Reports from './pages/Reports';
import Purchases from './pages/Purchases';
import StockIssueRequest from './pages/StockIssueRequest';
import Users from './pages/Users';
import Products from './pages/Products';
import Production from './pages/Production';
import Settings from './pages/Settings';
import SalesImport from './pages/SalesImport';
import Analytics from './pages/Analytics';
import RecycleBin from './pages/RecycleBin';
import Consumption from './pages/Consumption';
import Employees from './pages/Employees';
import Expenses from './pages/Expenses';
import ActivityLog from './pages/ActivityLog';
import POS from './pages/POS';
import CaptainOrder from './pages/CaptainOrder';
import CashSales from './pages/CashSales';
import DigitalMenu from './pages/DigitalMenu';
import ErrorBoundary from './components/ErrorBoundary';
import { SessionTimeoutProvider } from './context/SessionTimeoutContext';
import SessionTimeoutModal from './components/common/SessionTimeoutModal';

function HomeRoute() {
  const { user, canSeeNav, getDefaultLandingUrl } = useAuth();
  if (user && !canSeeNav('dashboard')) {
    return <Navigate to={getDefaultLandingUrl()} replace />;
  }
  return <Dashboard />;
}

function App() {
  return (
    <ErrorBoundary>
      <SessionTimeoutProvider>
        <SessionTimeoutModal />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/menu" element={<DigitalMenu />} />

          <Route
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<HomeRoute />} />
            <Route path="/dashboard" element={<HomeRoute />} />
            <Route path="/pos" element={<ProtectedRoute module="subsystem" navKey="pos"><POS /></ProtectedRoute>} />
            <Route path="/captain-order" element={<ProtectedRoute module="subsystem" navKey="captainOrder"><CaptainOrder /></ProtectedRoute>} />
            <Route path="/cash-sales" element={<ProtectedRoute module="subsystem" navKey="cashSales" roles={['admin', 'manager', 'supervisor', 'cashier', 'storekeeper', 'dev']}><CashSales /></ProtectedRoute>} />
            <Route path="/materials" element={<ProtectedRoute navKey={['rawMaterials', 'mainStore', 'kitchenStore', 'barStore']}><RawMaterials /></ProtectedRoute>} />
            <Route path="/materials/*" element={<ProtectedRoute navKey={['rawMaterials', 'mainStore', 'kitchenStore', 'barStore']}><RawMaterials /></ProtectedRoute>} />
            <Route path="/production" element={<ProtectedRoute navKey="production"><Production /></ProtectedRoute>} />
            <Route path="/production/*" element={<ProtectedRoute navKey="production"><Production /></ProtectedRoute>} />
            <Route path="/products" element={<ProtectedRoute navKey="products"><Products /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute module="finance" navKey="analytics" capability="viewReports"><Analytics /></ProtectedRoute>} />
            <Route path="/transactions" element={<ProtectedRoute navKey="stockMovements"><StockTransactions /></ProtectedRoute>} />
            <Route path="/transactions/cash-grv" element={<ProtectedRoute navKey="stockMovements"><StockTransactions defaultVoucher="cash_grv" /></ProtectedRoute>} />
            <Route path="/transactions/credit-grv" element={<ProtectedRoute navKey="stockMovements"><StockTransactions defaultVoucher="credit_grv" /></ProtectedRoute>} />
            <Route path="/transactions/fresh-bazaar" element={<ProtectedRoute navKey="stockMovements"><StockTransactions defaultVoucher="fresh_bazaar" /></ProtectedRoute>} />
            <Route path="/transactions/pos-adjustment" element={<ProtectedRoute navKey="stockMovements"><StockTransactions defaultVoucher="pos_adjustment" /></ProtectedRoute>} />
            <Route path="/transactions/disposal" element={<ProtectedRoute navKey="stockMovements"><StockTransactions defaultVoucher="disposal" /></ProtectedRoute>} />
            <Route path="/transactions/neg-adjustment" element={<ProtectedRoute navKey="stockMovements"><StockTransactions defaultVoucher="neg_adjustment" /></ProtectedRoute>} />
            <Route path="/sales-import" element={<ProtectedRoute navKey="stockMovements"><SalesImport /></ProtectedRoute>} />
            <Route
              path="/stock-requests"
              element={
                <ProtectedRoute navKey="stockRequests">
                  <StockIssueRequest />
                </ProtectedRoute>
              }
            />
            <Route
              path="/purchases"
              element={
                <ProtectedRoute roles={['admin', 'manager', 'supervisor', 'dev']}>
                  <Purchases />
                </ProtectedRoute>
              }
            />
            <Route
              path="/suppliers"
              element={
                <ProtectedRoute navKey="suppliers">
                  <Suppliers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute navKey="reports" capability="viewReports">
                  <Reports />
                </ProtectedRoute>
              }
            />
            <Route path="/reports/summary" element={<ProtectedRoute navKey="reports" capability="viewReports"><Reports defaultTab="summary" /></ProtectedRoute>} />
            <Route path="/reports/stock-balance" element={<ProtectedRoute navKey="reports" capability="viewReports"><Reports defaultTab="stock_balance" /></ProtectedRoute>} />
            <Route path="/reports/inventory-count" element={<ProtectedRoute navKey="reports" capability="viewReports"><Reports defaultTab="inventory_count" /></ProtectedRoute>} />
            <Route path="/reports/daily" element={<ProtectedRoute navKey="reports" capability="viewReports"><Reports defaultTab="daily" /></ProtectedRoute>} />
            <Route path="/reports/cash-grv" element={<ProtectedRoute navKey="reports" capability="viewReports"><Reports defaultTab="cash_grv" /></ProtectedRoute>} />
            <Route path="/reports/credit-grv" element={<ProtectedRoute navKey="reports" capability="viewReports"><Reports defaultTab="credit_grv" /></ProtectedRoute>} />
            <Route path="/reports/fresh-bazaar" element={<ProtectedRoute navKey="reports" capability="viewReports"><Reports defaultTab="fresh_bazaar" /></ProtectedRoute>} />
            <Route path="/reports/pos-adjustment" element={<ProtectedRoute navKey="reports" capability="viewReports"><Reports defaultTab="pos_adjustment" /></ProtectedRoute>} />
            <Route path="/reports/disposal" element={<ProtectedRoute navKey="reports" capability="viewReports"><Reports defaultTab="disposal" /></ProtectedRoute>} />
            <Route path="/reports/neg-adjustment" element={<ProtectedRoute navKey="reports" capability="viewReports"><Reports defaultTab="neg_adjustment" /></ProtectedRoute>} />
            <Route path="/reports/stock-levels" element={<ProtectedRoute navKey="reports" capability="viewReports"><Reports defaultTab="stock" /></ProtectedRoute>} />
            <Route path="/reports/purchases" element={<ProtectedRoute navKey="reports" capability="viewReports"><Reports defaultTab="purchases" /></ProtectedRoute>} />
            <Route
              path="/users"
              element={
                <ProtectedRoute navKey="staffAccounts" capability="manageAccounts">
                  <Users />
                </ProtectedRoute>
              }
            />
            <Route
              path="/activity-log"
              element={
                <ProtectedRoute navKey="staffAccounts" roles={['admin', 'manager', 'supervisor', 'dev']}>
                  <ActivityLog />
                </ProtectedRoute>
              }
            />
            <Route path="/settings" element={<Settings />} />
            <Route path="/profile" element={<Settings />} />
            <Route
              path="/consumption"
              element={
                <ProtectedRoute navKey="consumption">
                  <Consumption />
                </ProtectedRoute>
              }
            />
            <Route
              path="/recycle-bin"
              element={
                <ProtectedRoute roles={['admin', 'manager', 'supervisor', 'dev']}>
                  <RecycleBin />
                </ProtectedRoute>
              }
            />
            <Route
              path="/employees"
              element={
                <ProtectedRoute navKey="staffAccounts">
                  <Employees />
                </ProtectedRoute>
              }
            />
            <Route
              path="/expenses"
              element={
                <ProtectedRoute module="finance" navKey="expenses">
                  <Expenses />
                </ProtectedRoute>
              }
            />
            {/* Catch-all route to gracefully redirect unrecognized sub-paths back to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </SessionTimeoutProvider>
    </ErrorBoundary>
  );
}

export default App;
