import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { authService, type User } from '../services/authService';

export interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<User | null>;
    logout: () => Promise<void>;
    refreshUserInfo: () => Promise<User | null>;
    hasRole: (role: string) => boolean;
    hasAnyRole: () => boolean;
    updateUser: (userData: any) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Función helper para decodificar JWT
function decodeJWT(token: string): any {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split('')
                .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
        return JSON.parse(jsonPayload);
    } catch (error) {
        return null;
    }
}

// Función para verificar si el token está por expirar (menos de 5 minutos)
function shouldRefreshToken(token: string | null): boolean {
    if (!token) return false;

    const payload = decodeJWT(token);
    if (!payload || !payload.exp) return false;

    const expirationTime = payload.exp * 1000;
    const currentTime = Date.now();
    const timeUntilExpiration = expirationTime - currentTime;

    // Renovar si quedan menos de 5 minutos (300000 ms)
    return timeUntilExpiration < 300000;
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    // Función para renovar el token si está por expirar
    const checkAndRefreshToken = async () => {
        const token = authService.getToken();

        if (shouldRefreshToken(token)) {
            try {
                console.log('Token por expirar, renovando...');
                const response = await authService.refreshToken();
                setUser(response.user);
                console.log('Token renovado exitosamente');
            } catch (error) {
                console.error('Error al renovar token:', error);
                // Si falla la renovación (token expirado), cerrar sesión
                console.log('Token expirado, cerrando sesión...');
                await logout();
                // Redirigir a login
                window.location.href = '/';
            }
        }
    };

    useEffect(() => {
        const initAuth = async () => {
            setIsLoading(true);
            try {
                if (authService.getToken()) {
                    const isValid = await authService.verifyToken();
                    if (isValid) {
                        const userInfo = await authService.refreshUserInfo();
                        setUser(userInfo);
                        setIsAuthenticated(true);

                        // Verificar si necesita refresh al iniciar
                        await checkAndRefreshToken();
                    } else {
                        authService.logout();
                        setUser(null);
                        setIsAuthenticated(false);
                    }
                } else {
                    setUser(null);
                    setIsAuthenticated(false);
                }
            } catch (error) {
                console.error('Error initializing auth:', error);
                setUser(null);
                setIsAuthenticated(false);
            } finally {
                setIsLoading(false);
            }
        };

        initAuth();
    }, []);

    const login = async (email: string, password: string): Promise<User | null> => {
        setIsLoading(true);
        try {
            const response = await authService.login(email, password);
            setUser(response.user);
            setIsAuthenticated(true);
            return response.user;
        } catch (error) {
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    const logout = async () => {
        setIsLoading(true);
        try {
            await authService.logout();
            setUser(null);
            setIsAuthenticated(false);
        } finally {
            setIsLoading(false);
        }
    };

    const refreshUserInfo = async () => {
        try {
            // Verificar y renovar token antes de refrescar info
            await checkAndRefreshToken();

            const userInfo = await authService.refreshUserInfo();
            setUser(userInfo);
            return userInfo;
        } catch (error) {
            console.error('Error refreshing user info:', error);
            // Si hay error al refrescar info, probablemente el token expiró
            if (error instanceof Error && error.message.includes('Token inválido')) {
                console.log('Token inválido, cerrando sesión...');
                await logout();
                window.location.href = '/';
            }
            return null;
        }
    };

    const hasRole = (role: string): boolean => {
        return user?.role === role;
    };

    const hasAnyRole = (): boolean => {
        return user?.role !== null && user?.role !== undefined;
    };

    const updateUser = (userData: any) => {
        setUser(userData);
    };

    return (
        <AuthContext.Provider value={{
            user,
            isAuthenticated,
            isLoading,
            login,
            logout,
            refreshUserInfo,
            hasRole,
            hasAnyRole,
            updateUser
        }}>
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
