import { useState } from 'react';
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
    AppBar,
    BottomNavigation,
    BottomNavigationAction,
    Box,
    Drawer,
    IconButton,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Toolbar,
    Paper,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import PersonAddAltOutlinedIcon from '@mui/icons-material/PersonAddAltOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAdminAuth } from './AdminAuthContext';
import { LoadingState } from '../../components/StateMessage';
import { pagePadding } from '../../layoutSpacing';

const DRAWER_WIDTH = 248;

const NAV_ITEMS = [
    { to: '/admin', label: 'Огляд', icon: <DashboardOutlinedIcon />, end: true },
    { to: '/admin/schedule', label: 'Розклад', icon: <CalendarMonthOutlinedIcon /> },
    { to: '/admin/bookings', label: 'Записи', icon: <ListAltOutlinedIcon /> },
    { to: '/admin/locations', label: 'Локації', icon: <PlaceOutlinedIcon /> },
    { to: '/admin/authorized-users', label: 'Користувачі сайту', icon: <PersonAddAltOutlinedIcon /> },
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
        return <LoadingState fullScreen label="Перевіряємо сесію…" />;
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
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Стенди Адмін</Typography>
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
        <Box sx={{ display: 'flex', width: '100%', minWidth: 0, minHeight: '100dvh', bgcolor: 'background.default' }}>
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

            <Box sx={{ flex: '1 1 0%', width: 0, minWidth: 0 }}>
                {!isDesktop && (
                    <AppBar position="sticky" elevation={0}>
                        <Toolbar>
                            <IconButton aria-label="Відкрити меню адміністратора" color="inherit" edge="start" onClick={() => setMobileOpen(true)} sx={{ mr: 1 }}>
                                <MenuIcon />
                            </IconButton>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Адмін-панель</Typography>
                        </Toolbar>
                    </AppBar>
                )}

                <Box component="main" sx={{ ...pagePadding, width: '100%', minWidth: 0, pb: { xs: 'calc(80px + env(safe-area-inset-bottom))', md: 4 } }}>
                    <Box key={location.pathname} className="content-enter" sx={{ minWidth: 0 }}><Outlet /></Box>
                </Box>
            </Box>
            {!isDesktop && <Paper elevation={4} sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: theme.zIndex.appBar, pb: 'env(safe-area-inset-bottom)' }}>
                <BottomNavigation showLabels value={['/admin', '/admin/schedule', '/admin/bookings'].includes(location.pathname) ? location.pathname : false} sx={{ '& .MuiBottomNavigationAction-root': { maxWidth: 'none' } }}>
                    <BottomNavigationAction component={NavLink} to="/admin" value="/admin" label="Огляд" icon={<DashboardOutlinedIcon />} />
                    <BottomNavigationAction component={NavLink} to="/admin/schedule" value="/admin/schedule" label="Розклад" icon={<CalendarMonthOutlinedIcon />} />
                    <BottomNavigationAction component={NavLink} to="/admin/bookings" value="/admin/bookings" label="Записи" icon={<ListAltOutlinedIcon />} />
                </BottomNavigation>
            </Paper>}
        </Box>
    );
}
