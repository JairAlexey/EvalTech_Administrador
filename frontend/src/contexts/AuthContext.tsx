import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService, User } from '../services/authService';

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<User | null>;
    logout: () => Promise<void>;
    refreshUserInfo: () => Promise<User | null>;
    hasRole: (role: string) => boolean;
    hasAnyRole: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(true);

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
    }, []);

    const login = async (email: string, password: string): Promise<User | null> => {
        setIsLoading(true);
        try {
            const response = await authService.login(email, password);
            setUser(response.user);
            setIsAuthenticated(true);
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

    return (
        <AuthContext.Provider value={{
            user,
            isAuthenticated,
            isLoading,
            login,
            logout,
            refreshUserInfo,
            hasRole,
            hasAnyRole
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
