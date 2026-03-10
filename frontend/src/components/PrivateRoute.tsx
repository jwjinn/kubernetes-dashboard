import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

export const PrivateRoute = ({ children }: { children: React.ReactElement }) => {
    const { isAuthenticated } = useAuth();
    const location = useLocation();

    if (!isAuthenticated) {
        // Trigger the OIDC login flow directly. 
        // We use window.location here or let AuthContext handle the redirect 
        // to prevent React Router from just hanging on a blank page.
        // The most robust way inside a component is to check if it's already loading.
        return <Navigate to="/login" replace />;
        // Note: we will update LoginPage to do the auto-redirect to avoid 
        // duplicate auth calls when React mounts multiple times in strict mode.
    }

    return children;
};
