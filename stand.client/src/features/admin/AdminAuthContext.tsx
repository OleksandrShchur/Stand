import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { adminApi } from '../../api/adminApi';
import type { AdminMeDto } from '../../api/types';

interface AdminAuthContextValue {
    user: AdminMeDto | null;
    loading: boolean;
    login: (login: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AdminMeDto | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        adminApi
            .me()
            .then(setUser)
            .catch(() => setUser(null))
            .finally(() => setLoading(false));
    }, []);

    const login = useCallback(async (loginValue: string, password: string) => {
        const me = await adminApi.login(loginValue, password);
        setUser(me);
    }, []);

    const logout = useCallback(async () => {
        await adminApi.logout();
        setUser(null);
    }, []);

    return (
        <AdminAuthContext.Provider value={{ user, loading, login, logout }}>
            {children}
        </AdminAuthContext.Provider>
    );
}

export function useAdminAuth(): AdminAuthContextValue {
    const ctx = useContext(AdminAuthContext);
    if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
    return ctx;
}
