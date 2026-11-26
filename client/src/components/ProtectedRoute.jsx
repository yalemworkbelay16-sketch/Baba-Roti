import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ModuleLocked from './ui/ModuleLocked';

/**
 * ProtectedRoute:
 *  - roles: restrict to specific roles
 *  - capability: restrict to a workflow capability
 *  - navKey: restrict based on Page Visibility settings (string or array of keys)
 *  - module: restrict based on developer module licensing (e.g. 'subsystem')
 */
const ProtectedRoute = ({ children, roles, capability, navKey, module: moduleProp }) => {
  const { user, loading, can, canSeeNav, isModuleLicensed, hasRole, getDefaultLandingUrl } = useAuth();
  const [safetyTimeoutPassed, setSafetyTimeoutPassed] = React.useState(false);

  React.useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => setSafetyTimeoutPassed(true), 1200);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  if (loading && !safetyTimeoutPassed) {
    return (
      <div className="flex h-screen items-center justify-center bg-ink-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-200 border-t-brass-400" />
      </div>
    );
  }

  if (!user) {
    const currentPath = typeof window !== 'undefined' ? (window.location.pathname + window.location.search) : '/';
    return <Navigate to="/login" replace state={{ from: currentPath }} />;
  }

  // System Developer (Owner) has master bypass for all gates
  if (user.role === 'dev') {
    return children;
  }

  // Module licensing gate: dev role always bypasses
  if (moduleProp && !isModuleLicensed(moduleProp)) {
    return <ModuleLocked />;
  }

  let fallbackUrl = getDefaultLandingUrl ? getDefaultLandingUrl() : (user?.role === 'waiter' ? '/pos' : '/');
  if (typeof window !== 'undefined' && fallbackUrl === window.location.pathname) {
    fallbackUrl = '/profile';
  }

  if (navKey) {
    const keys = Array.isArray(navKey) ? navKey : [navKey];
    const allowed = keys.some((k) => canSeeNav(k));
    if (!allowed) {
      return <Navigate to={fallbackUrl} replace />;
    }
  }

  if (capability && !can(capability)) {
    return <Navigate to={fallbackUrl} replace />;
  }

  if (roles && !capability && !hasRole(...roles)) {
    return <Navigate to={fallbackUrl} replace />;
  }

  return children;
};

export default ProtectedRoute;

