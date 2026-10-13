import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { publicApi } from '../../api/publicApi';
import type { PublicUserMeDto } from '../../api/types';

interface PublicAuthContextValue {
    user: PublicUserMeDto | null;
    loading: boolean;
    login: (phone: string) => Promise<void>;
    logout: () => Promise<void>;
}

const PublicAuthContext = createContext<PublicAuthContextValue | null>(null);

export function PublicAuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<PublicUserMeDto | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        publicApi
            .me()
            .then(setUser)
            .catch(() => setUser(null))
            .finally(() => setLoading(false));
    }, []);

    const login = useCallback(async (phone: string) => {
        const me = await publicApi.login(phone);
        setUser(me);
    }, []);

    const logout = useCallback(async () => {
        await publicApi.logout();
        setUser(null);
    }, []);

    return (
        <PublicAuthContext.Provider value={{ user, loading, login, logout }}>
            {children}
        </PublicAuthContext.Provider>
    );
}

export function usePublicAuth(): PublicAuthContextValue {
    const ctx = useContext(PublicAuthContext);
    if (!ctx) throw new Error('usePublicAuth must be used within PublicAuthProvider');
    return ctx;
}
