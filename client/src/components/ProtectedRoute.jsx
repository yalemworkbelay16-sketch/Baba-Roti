import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ModuleLocked from './ui/ModuleLocked';

/**
 * ProtectedRoute:
 *  - roles: restrict to specific roles
 *  - capability: restrict to a workflow capability
 *  - module: restrict based on developer module licensing (e.g. 'subsystem')
 */
const ProtectedRoute = ({ children, roles, capability, module: moduleProp }) => {
  const { user, loading, can, isModuleLicensed, hasRole } = useAuth();
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

  if (!user) return <Navigate to="/login" replace />;

  // System Developer (Owner) has master bypass for all gates
  if (user.role === 'dev') {
    return children;
  }

  // Module licensing gate: dev role always bypasses
  if (moduleProp && !isModuleLicensed(moduleProp)) {
    return <ModuleLocked />;
  }

  const fallbackUrl = user?.role === 'waiter' ? '/pos' : '/';

  if (capability && !can(capability)) {
    return <Navigate to={fallbackUrl} replace />;
  }

  if (roles && !capability && !hasRole(...roles)) {
    return <Navigate to={fallbackUrl} replace />;
  }

  return children;
};

export default ProtectedRoute;

