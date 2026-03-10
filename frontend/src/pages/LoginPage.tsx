import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/components/AuthContext';
import { Card, Text } from '@tremor/react';
import { Loader2 } from 'lucide-react';
import { useAuth as useOidcAuth } from 'react-oidc-context';

export default function LoginPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { isAuthenticated } = useAuth();
    const auth = useOidcAuth();

    // The page the user was trying to visit before being redirected to login
    const from = location.state?.from?.pathname || '/dashboard';

    useEffect(() => {
        if (isAuthenticated) {
            navigate(from, { replace: true });
        } else if (!auth.isLoading && !auth.activeNavigator) {
            // If not authenticated and not currently loading/redirecting,
            // immediately trigger the Keycloak login page.
            auth.signinRedirect();
        }
    }, [isAuthenticated, navigate, from, auth]);

    return (
        <div className="min-h-screen bg-[#0f111a] flex items-center justify-center relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="relative z-10 w-full max-w-md p-6 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-white mb-2">Kubernetes Console</h2>
                <div className="text-indigo-200/60 font-medium">인증 서버로 이동 중입니다...</div>
            </div>
        </div>
    );
}
