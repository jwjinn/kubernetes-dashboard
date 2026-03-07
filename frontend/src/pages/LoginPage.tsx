import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/components/AuthContext';
import { Card, Text, TextInput } from '@tremor/react';
import { Box, Lock, User, Loader2 } from 'lucide-react';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useAuth();

    // The page the user was trying to visit before being redirected to login
    const from = location.state?.from?.pathname || '/dashboard';

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            // Simulate API call for now (Mock Login)
            await new Promise(resolve => setTimeout(resolve, 1000));

            if (username === 'admin' && password === 'admin') {
                // Mock JWT Token
                const mockToken = btoa(JSON.stringify({ user: 'admin', exp: Date.now() + 3600000 }));
                login(mockToken);
                navigate(from, { replace: true });
            } else {
                setError('아이디 또는 비밀번호가 올바르지 않습니다.');
            }
        } catch (err) {
            setError('로그인 처리 중 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0f111a] flex items-center justify-center relative overflow-hidden">
            {/* Background Ambient Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="relative z-10 w-full max-w-md p-6">
                <div className="text-center mb-10">
                    <div className="flex justify-center mb-6">
                        <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
                            <Box className="w-8 h-8 text-white" />
                        </div>
                    </div>
                    <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">Kubernetes Console</h1>
                    <p className="text-indigo-200/60 font-medium">관리자 계정으로 로그인하여 계속하세요.</p>
                </div>

                <Card className="p-8 bg-white/5 border-white/10 backdrop-blur-xl shadow-2xl rounded-2xl ring-1 ring-white/10">
                    <form onSubmit={handleLogin} className="space-y-6">
                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm font-medium text-center">
                                {error}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-indigo-100/80 pl-1">이메일 또는 아이디</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-indigo-300/50">
                                        <User className="w-4 h-4" />
                                    </div>
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 bg-black/20 border border-white/10 rounded-xl text-white placeholder-indigo-200/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all font-medium"
                                        placeholder="admin"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-indigo-100/80 pl-1">비밀번호</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-indigo-300/50">
                                        <Lock className="w-4 h-4" />
                                    </div>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 bg-black/20 border border-white/10 rounded-xl text-white placeholder-indigo-200/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all font-medium"
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`w-full py-3 px-4 rounded-xl text-white font-bold text-[15px] shadow-lg transition-all flex items-center justify-center gap-2
                                ${isLoading
                                    ? 'bg-indigo-600/50 cursor-not-allowed shadow-none'
                                    : 'bg-indigo-600 hover:bg-indigo-500 hover:shadow-indigo-500/25 active:scale-[0.98]'
                                }
                            `}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    인증 중...
                                </>
                            ) : (
                                '로그인'
                            )}
                        </button>

                        <div className="text-center mt-6">
                            <Text className="text-xs text-indigo-200/40">
                                SSO 연동(Dex/Keycloak)은 운영 환경에서 지원될 예정입니다.
                            </Text>
                        </div>
                    </form>
                </Card>
            </div>

            {/* Version / Copyright */}
            <div className="absolute bottom-6 text-center w-full text-indigo-100/30 text-xs font-medium tracking-wider font-mono">
                v1.2.0-beta | Kube Console Next
            </div>
        </div>
    );
}
