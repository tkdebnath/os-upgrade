import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function PermissionRoute({ children, permission, requireAll = false }) {
  const { user, loading, can } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Superusers always have access
  if (user.is_superuser) {
    return children;
  }

  // Check permissions
  const permissions = Array.isArray(permission) ? permission : [permission];
  const hasPermission = requireAll
    ? permissions.every(p => can(p))
    : permissions.some(p => can(p));

  if (!hasPermission) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md">
          <div className="text-red-500 text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-4">You don't have permission to access this page.</p>
          <p className="text-sm text-gray-500">
            This section requires explicit Zero Touch Provisioning permissions.
            Please contact your administrator if you need access.
          </p>
          <button
            onClick={() => window.history.back()}
            className="mt-6 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return children;
}

export default PermissionRoute;
