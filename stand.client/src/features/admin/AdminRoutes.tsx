import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminAuthProvider } from './AdminAuthContext';

const AdminLoginPage = lazy(() => import('./AdminLoginPage'));
const AdminLayout = lazy(() => import('./AdminLayout'));
const AdminDashboardPage = lazy(() => import('./AdminDashboardPage'));
const AdminLocationsPage = lazy(() => import('./AdminLocationsPage'));
const AdminSchedulePage = lazy(() => import('./AdminSchedulePage'));
const AdminBookingsPage = lazy(() => import('./AdminBookingsPage'));
const AdminUsersPage = lazy(() => import('./AdminUsersPage'));
const AdminAuthorizedUsersPage = lazy(() => import('./AdminAuthorizedUsersPage'));

export default function AdminRoutes() {
    return (
        <AdminAuthProvider>
            <Routes>
                <Route path="login" element={<AdminLoginPage />} />
                <Route path="" element={<AdminLayout />}>
                    <Route index element={<AdminDashboardPage />} />
                    <Route path="bookings" element={<AdminBookingsPage />} />
                    <Route path="locations" element={<AdminLocationsPage />} />
                    <Route path="schedule" element={<AdminSchedulePage />} />
                    <Route path="timeslots" element={<Navigate to="/admin/schedule" replace />} />
                    <Route path="dates" element={<Navigate to="/admin/schedule" replace />} />
                    <Route path="exceptions" element={<Navigate to="/admin/schedule" replace />} />
                    <Route path="authorized-users" element={<AdminAuthorizedUsersPage />} />
                    <Route path="users" element={<AdminUsersPage />} />
                </Route>
            </Routes>
        </AdminAuthProvider>
    );
}
