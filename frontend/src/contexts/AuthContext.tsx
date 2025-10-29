import React, { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import { authService, type User } from '../services/authService';

interface AuthContextType {
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

// Constantes para el sistema de renovación de token
const TOKEN_REFRESH_INTERVAL = 240000; // 4 minutos (240 segundos) - renovar antes de que expire a los 5
const ACTIVITY_TIMEOUT = 300000; // 5 minutos (300 segundos) sin actividad = dejar que el token expire

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    
    // Referencias para los intervalos y actividad
    const refreshIntervalRef = useRef<number | null>(null);
    const inactivityTimeoutRef = useRef<number | null>(null);
    const lastActivityRef = useRef<number>(Date.now());

    // Función para renovar el token
    const renewToken = async () => {
        try {
            // Solo renovar si hay actividad reciente (últimos 5 minutos)
            const timeSinceLastActivity = Date.now() - lastActivityRef.current;
            
            if (timeSinceLastActivity > ACTIVITY_TIMEOUT) {
                console.log('No hay actividad reciente. No se renovará el token.');
                // No renovar el token - dejar que expire naturalmente o que el timeout cierre sesión
                return;
            }

            console.log('Actividad detectada. Renovando token...');
            const response = await authService.refreshToken();
            setUser(response.user);
            console.log('Token renovado exitosamente');
        } catch (error) {
            console.error('Error al renovar token:', error);
            // Si falla la renovación (ej: token expirado), cerrar sesión
            await logout();
        }
    };

    // Función para registrar actividad del usuario y reiniciar el timeout de inactividad
    const recordActivity = () => {
        lastActivityRef.current = Date.now();
        
        // Reiniciar el timeout de inactividad
        if (inactivityTimeoutRef.current) {
            clearTimeout(inactivityTimeoutRef.current);
        }
        
        // Configurar nuevo timeout: si no hay actividad por 5 minutos, cerrar sesión
        inactivityTimeoutRef.current = window.setTimeout(async () => {
            console.log('Usuario inactivo por 5 minutos. Cerrando sesión automáticamente...');
            await logout();
        }, ACTIVITY_TIMEOUT);
    };

    // Iniciar el sistema de renovación de token
    const startTokenRefresh = () => {
        // Limpiar cualquier intervalo existente
        if (refreshIntervalRef.current) {
            clearInterval(refreshIntervalRef.current);
        }

        // Iniciar nuevo intervalo de renovación
        refreshIntervalRef.current = setInterval(renewToken, TOKEN_REFRESH_INTERVAL);
        
        // Registrar actividad inicial
        recordActivity();
    };

    // Detener el sistema de renovación de token
    const stopTokenRefresh = () => {
        if (refreshIntervalRef.current) {
            clearInterval(refreshIntervalRef.current);
            refreshIntervalRef.current = null;
        }
        
        if (inactivityTimeoutRef.current) {
            clearTimeout(inactivityTimeoutRef.current);
            inactivityTimeoutRef.current = null;
        }
    };

    // Detectar actividad del usuario
    useEffect(() => {
        if (!isAuthenticated) return;

        const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
        
        const handleActivity = () => {
            recordActivity();
        };

        // Agregar listeners para detectar actividad
        events.forEach(event => {
            document.addEventListener(event, handleActivity);
        });

        return () => {
            // Limpiar listeners
            events.forEach(event => {
                document.removeEventListener(event, handleActivity);
            });
        };
    }, [isAuthenticated]);

    useEffect(() => {
        const initAuth = async () => {
            setIsLoading(true);
            try {
                // Check if we have a token stored
                if (authService.getToken()) {
                    const isValid = await authService.verifyToken();
                    if (isValid) {
                        const userInfo = await authService.refreshUserInfo();
                        setUser(userInfo);
                        setIsAuthenticated(true);
                        startTokenRefresh(); // Iniciar renovación automática
                    } else {
                        // Token invalid, clean up
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

        // Cleanup al desmontar
        return () => {
            stopTokenRefresh();
        };
    }, []);

    const login = async (email: string, password: string): Promise<User | null> => {
        setIsLoading(true);
        try {
            const response = await authService.login(email, password);
            setUser(response.user);
            setIsAuthenticated(true);
            startTokenRefresh(); // Iniciar renovación automática al hacer login
            return response.user; // Return the user object
        } catch (error) {
            throw error; // Re-throw the error for the login component to handle
        } finally {
            setIsLoading(false);
        }
    };

    const logout = async () => {
        setIsLoading(true);
        try {
            stopTokenRefresh(); // Detener renovación al cerrar sesión
            await authService.logout();
            setUser(null);
            setIsAuthenticated(false);
        } finally {
            setIsLoading(false);
        }
    };

    const refreshUserInfo = async () => {
        try {
            const userInfo = await authService.refreshUserInfo();
            setUser(userInfo);
            return userInfo;
        } catch (error) {
            console.error('Error refreshing user info:', error);
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
