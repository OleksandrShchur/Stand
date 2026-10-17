import { lazy, Suspense } from 'react';
import { CircularProgress } from '@mui/material';
import { Navigate, Route, Routes } from 'react-router-dom';
import BookingWizardPage from './features/booking/BookingWizardPage';
import BookingStatusPage from './features/booking/BookingStatusPage';
import MyShiftsPage from './features/booking/MyShiftsPage';
import { PublicAuthProvider } from './features/auth/PublicAuthContext';
import ProtectedPublicRoute from './features/auth/ProtectedPublicRoute';
import UserLoginPage from './features/auth/UserLoginPage';

const AdminRoutes = lazy(() => import('./features/admin/AdminRoutes'));

function App() {
    return (
        <Suspense fallback={<CircularProgress aria-label="Завантаження…" sx={{ display: 'block', mx: 'auto', mt: 4 }} />}>
            <Routes>
                <Route
                    path="/"
                    element={
                        <PublicAuthProvider>
                            <ProtectedPublicRoute>
                                <BookingWizardPage />
                            </ProtectedPublicRoute>
                        </PublicAuthProvider>
                    }
                />
                <Route
                    path="/my-shifts"
                    element={
                        <PublicAuthProvider>
                            <ProtectedPublicRoute>
                                <MyShiftsPage />
                            </ProtectedPublicRoute>
                        </PublicAuthProvider>
                    }
                />
                <Route
                    path="/booking/:cancelToken"
                    element={
                        <PublicAuthProvider>
                            <ProtectedPublicRoute>
                                <BookingStatusPage />
                            </ProtectedPublicRoute>
                        </PublicAuthProvider>
                    }
                />
                <Route
                    path="/login"
                    element={
                        <PublicAuthProvider>
                            <UserLoginPage />
                        </PublicAuthProvider>
                    }
                />

                <Route path="/admin/*" element={<AdminRoutes />} />

                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Suspense>
    );
}

export default App;
