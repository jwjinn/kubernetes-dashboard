import React, { createContext, useContext, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useAuth as useOidcAuth } from 'react-oidc-context';
import { setAccessToken } from '@/auth/tokenStore';

interface AuthContextType {
    isAuthenticated: boolean;
    token: string | null;
    login: () => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const auth = useOidcAuth();

    // Map OIDC state to our existing AuthContext interface
    const isAuthenticated = auth.isAuthenticated;
    const token = auth.user?.access_token || null;

    // Keep an in-memory token available before child queries start.
    setAccessToken(token);

    useEffect(() => {
        // Automatically save token for easy testing if needed
        if (token) {
            localStorage.setItem('k8s_dashboard_token', token);
        } else {
            localStorage.removeItem('k8s_dashboard_token');
        }
    }, [token]);

    const login = () => {
        auth.signinRedirect();
    };

    const logout = () => {
        auth.signoutRedirect();
    };

    // If OIDC is still initializing/verifying from redirect, we might want to show a loader,
    // but for now we just pass down the state. PrivateRoute will handle redirects.
    if (auth.isLoading) {
        return <div>Loading authentication...</div>;
    }

    if (auth.error) {
        return <div>Auth Error: {auth.error.message}</div>;
    }

    return (
        <AuthContext.Provider value={{ isAuthenticated, token, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
