import { Navigate, Route, Routes } from 'react-router-dom';
import BookingWizardPage from './features/booking/BookingWizardPage';
import BookingStatusPage from './features/booking/BookingStatusPage';
import MyShiftsPage from './features/booking/MyShiftsPage';
import { AdminAuthProvider } from './features/admin/AdminAuthContext';
import AdminLoginPage from './features/admin/AdminLoginPage';
import AdminLayout from './features/admin/AdminLayout';
import AdminDashboardPage from './features/admin/AdminDashboardPage';
import AdminLocationsPage from './features/admin/AdminLocationsPage';
import AdminTimeSlotsPage from './features/admin/AdminTimeSlotsPage';
import AdminDatesPage from './features/admin/AdminDatesPage';
import AdminExceptionsPage from './features/admin/AdminExceptionsPage';
import AdminBookingsPage from './features/admin/AdminBookingsPage';
import AdminUsersPage from './features/admin/AdminUsersPage';
import AdminAuthorizedUsersPage from './features/admin/AdminAuthorizedUsersPage';
import { PublicAuthProvider } from './features/auth/PublicAuthContext';
import ProtectedPublicRoute from './features/auth/ProtectedPublicRoute';
import UserLoginPage from './features/auth/UserLoginPage';

function App() {
    return (
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

            <Route
                path="/admin/*"
                element={
                    <AdminAuthProvider>
                        <Routes>
                            <Route path="login" element={<AdminLoginPage />} />
                            <Route path="" element={<AdminLayout />}>
                                <Route index element={<AdminDashboardPage />} />
                                <Route path="bookings" element={<AdminBookingsPage />} />
                                <Route path="locations" element={<AdminLocationsPage />} />
                                <Route path="timeslots" element={<AdminTimeSlotsPage />} />
                                <Route path="dates" element={<AdminDatesPage />} />
                                <Route path="exceptions" element={<AdminExceptionsPage />} />
                                <Route path="authorized-users" element={<AdminAuthorizedUsersPage />} />
                                <Route path="users" element={<AdminUsersPage />} />
                            </Route>
                        </Routes>
                    </AdminAuthProvider>
                }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

export default App;
