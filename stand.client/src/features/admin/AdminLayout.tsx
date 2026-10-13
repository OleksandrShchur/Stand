import { useState } from 'react';
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
    AppBar,
    Box,
    Drawer,
    IconButton,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Toolbar,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';
import { useAdminAuth } from './AdminAuthContext';
import { LoadingState } from '../../components/StateMessage';

const DRAWER_WIDTH = 248;

const NAV_ITEMS = [
    { to: '/admin', label: 'Дашборд', icon: <DashboardOutlinedIcon />, end: true },
    { to: '/admin/bookings', label: 'Записи', icon: <ListAltOutlinedIcon /> },
    { to: '/admin/locations', label: 'Локації', icon: <PlaceOutlinedIcon /> },
    { to: '/admin/timeslots', label: 'Часові інтервали', icon: <AccessTimeOutlinedIcon /> },
    { to: '/admin/dates', label: 'Доступні дати', icon: <CalendarMonthOutlinedIcon /> },
    { to: '/admin/exceptions', label: 'Винятки за датою', icon: <EventBusyOutlinedIcon /> },
    { to: '/admin/users', label: 'Адміністратори', icon: <GroupOutlinedIcon /> },
];

export default function AdminLayout() {
    const { user, loading, logout } = useAdminAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const theme = useTheme();
    const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
    const [mobileOpen, setMobileOpen] = useState(false);

    if (loading) {
        return <LoadingState label="Перевіряємо сесію…" />;
    }

    if (!user) {
        return <Navigate to="/admin/login" state={{ from: location }} replace />;
    }

    const handleLogout = () => {
        logout().then(() => navigate('/admin/login', { replace: true }));
    };

    const drawerContent = (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Toolbar sx={{ gap: 1 }}>
                <VolunteerActivismIcon color="primary" />
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Стенди</Typography>
            </Toolbar>
            <List sx={{ flex: 1 }}>
                {NAV_ITEMS.map((item) => (
                    <ListItemButton
                        key={item.to}
                        component={NavLink}
                        to={item.to}
                        end={item.end}
                        onClick={() => setMobileOpen(false)}
                        sx={{
                            mx: 1,
                            my: 0.25,
                            borderRadius: 2,
                            '&.active': {
                                bgcolor: 'primary.main',
                                color: 'common.white',
                                '& .MuiListItemIcon-root': { color: 'common.white' },
                            },
                        }}
                    >
                        <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                        <ListItemText primary={item.label} />
                    </ListItemButton>
                ))}
            </List>
            <List>
                <ListItemButton onClick={handleLogout} sx={{ mx: 1, mb: 1, borderRadius: 2 }}>
                    <ListItemIcon sx={{ minWidth: 40 }}><LogoutIcon /></ListItemIcon>
                    <ListItemText primary={`Вийти (${user.login})`} />
                </ListItemButton>
            </List>
        </Box>
    );

    return (
        <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
            {isDesktop ? (
                <Drawer
                    variant="permanent"
                    sx={{ width: DRAWER_WIDTH, flexShrink: 0, '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', border: 'none' } }}
                >
                    {drawerContent}
                </Drawer>
            ) : (
                <Drawer
                    variant="temporary"
                    open={mobileOpen}
                    onClose={() => setMobileOpen(false)}
                    ModalProps={{ keepMounted: true }}
                    sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}
                >
                    {drawerContent}
                </Drawer>
            )}

            <Box sx={{ flex: 1, minWidth: 0 }}>
                {!isDesktop && (
                    <AppBar position="sticky" elevation={0}>
                        <Toolbar>
                            <IconButton color="inherit" edge="start" onClick={() => setMobileOpen(true)} sx={{ mr: 1 }}>
                                <MenuIcon />
                            </IconButton>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Адмін-панель</Typography>
                        </Toolbar>
                    </AppBar>
                )}

                <Box sx={{ p: { xs: 2, md: 3 } }}>
                    <Outlet />
                </Box>
            </Box>
        </Box>
    );
}
