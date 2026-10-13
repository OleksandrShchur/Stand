import { Navigate, Route, Routes } from 'react-router-dom';
import BookingWizardPage from './features/booking/BookingWizardPage';
import BookingStatusPage from './features/booking/BookingStatusPage';
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

function App() {
    return (
        <Routes>
            <Route path="/" element={<BookingWizardPage />} />
            <Route path="/booking/:cancelToken" element={<BookingStatusPage />} />

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
