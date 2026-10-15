import { Navigate, useLocation } from 'react-router-dom';
import { LoadingState } from '../../components/StateMessage';
import { usePublicAuth } from './PublicAuthContext';

export default function ProtectedPublicRoute({ children }: { children: React.ReactNode }) {
    const { user, loading } = usePublicAuth();
    const location = useLocation();

    if (loading) {
        return <LoadingState fullScreen label="Перевіряємо доступ..." />;
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return children;
}
