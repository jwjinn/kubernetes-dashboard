import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { getEnv } from '@/config/env';

interface AuthContextType {
    isAuthenticated: boolean;
    token: string | null;
    login: (token: string) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// In a real application, you might want this to be configurable via env
// const useSecureCookies = getEnv('VITE_SECURE_AUTH') === 'true';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    // Initialize token from localStorage if available
    const [token, setToken] = useState<string | null>(() => {
        return localStorage.getItem('k8s_dashboard_token');
    });

    const isAuthenticated = !!token;

    // Persist token changes
    useEffect(() => {
        if (token) {
            localStorage.setItem('k8s_dashboard_token', token);
        } else {
            localStorage.removeItem('k8s_dashboard_token');
        }
    }, [token]);

    const login = (newToken: string) => {
        setToken(newToken);
    };

    const logout = () => {
        setToken(null);
    };

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
