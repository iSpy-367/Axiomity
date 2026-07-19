import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { login as loginApi, register as registerApi, getProfile } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const saveTokens = (access, refresh) => {
        localStorage.setItem('accessToken', access);
        localStorage.setItem('refreshToken', refresh);
    };

    const clearTokens = () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
    };

    const loadUser = useCallback(async () => {
        const token = localStorage.getItem('accessToken');
        if (!token) {
            setLoading(false);
            return;
        }
        try {
            const res = await getProfile();
            setUser(res.data);
        } catch {
            clearTokens();
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadUser();
    }, [loadUser]);

    const login = async (username, password) => {
        const res = await loginApi(username, password);
        saveTokens(res.data.access, res.data.refresh);
        const profile = await getProfile();
        setUser(profile.data);
        return profile.data;
    };

    const register = async (formData) => {
        const res = await registerApi(formData);
        saveTokens(res.data.access, res.data.refresh);
        setUser(res.data.user);
        return res.data.user;
    };

    const logout = () => {
        clearTokens();
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
}
