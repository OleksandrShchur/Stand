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
import MainContent from '../../components/MainContent';
import { surfaceShadow } from '../../surfaceStyles';

const DRAWER_WIDTH = 248;

const PRIMARY_NAV_ITEMS = [
    { to: '/admin', label: 'Огляд', icon: <DashboardOutlinedIcon />, end: true },
    { to: '/admin/schedule', label: 'Розклад', icon: <CalendarMonthOutlinedIcon /> },
    { to: '/admin/bookings', label: 'Записи', icon: <ListAltOutlinedIcon /> },
    { to: '/admin/locations', label: 'Локації', icon: <PlaceOutlinedIcon /> },
    { to: '/admin/authorized-users', label: 'Користувачі сайту', bottomLabel: 'Користувачі', icon: <PersonAddAltOutlinedIcon /> },
];

const SIDE_NAV_ITEMS = [
    { to: '/admin/users', label: 'Адміністратори', icon: <GroupOutlinedIcon /> },
];

export default function AdminLayout() {
    const { user, loading, logout } = useAdminAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const theme = useTheme();
    const hasSideNav = useMediaQuery(theme.breakpoints.up('sm'));
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
    const selectedNavIndex = PRIMARY_NAV_ITEMS.findIndex(item => item.to === location.pathname);
    const headerTitle = location.pathname === '/admin/schedule' ? 'Розклад'
        : location.pathname === '/admin/bookings' ? 'Записи'
        : location.pathname === '/admin/locations' ? 'Локації'
        : location.pathname === '/admin/authorized-users' ? 'Користувачі сайту'
        : location.pathname === '/admin' ? 'Огляд' : 'Адмін-панель';
    const sideNavItems = hasSideNav ? [...PRIMARY_NAV_ITEMS, ...SIDE_NAV_ITEMS] : SIDE_NAV_ITEMS;

    const drawerContent = (
        <Box component="nav" aria-label="Меню адміністратора" id="admin-menu" sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Toolbar sx={{ gap: 1 }}>
                <Typography component="div" id="admin-menu-title" variant="subtitle1" sx={{ fontWeight: 700 }}>Стенди Адмін</Typography>
            </Toolbar>
            <List component="div" sx={{ flex: 1 }}>
                {sideNavItems.map((item) => (
                    <ListItemButton
                        key={item.to}
                        component={NavLink}
                        to={item.to}
                        end={item.to === '/admin'}
                        onClick={() => setMobileOpen(false)}
                        sx={{
                            mx: 1,
                            my: 0.25,
                            borderRadius: 1,
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
            <List component="div">
                <ListItemButton component="button" onClick={handleLogout} sx={{ mx: 1, mb: 1, borderRadius: 1, width: 'calc(100% - 16px)', textAlign: 'left' }}>
                    <ListItemIcon sx={{ minWidth: 40 }}><LogoutIcon /></ListItemIcon>
                    <ListItemText primary={`Вийти (${user.login})`} />
                </ListItemButton>
            </List>
        </Box>
    );

    return (
        <Box sx={{ '--admin-navigation-clearance': { xs: 'calc(92px + env(safe-area-inset-bottom))', sm: '12px' },
            '--admin-sidebar-width': `${DRAWER_WIDTH}px`, display: 'flex', width: '100%', minWidth: 0, minHeight: '100dvh', bgcolor: 'background.default' }}>
            {hasSideNav ? (
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
                    slotProps={{ paper: { 'aria-labelledby': 'admin-menu-title' } }}
                    sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}
                >
                    {drawerContent}
                </Drawer>
            )}

            <Box sx={{ flex: '1 1 0%', width: 0, minWidth: 0 }}>
                {!hasSideNav && (
                    <AppBar position="sticky" elevation={0}>
                        <Toolbar sx={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr' }}>
                            <IconButton aria-label="Відкрити меню адміністратора" aria-expanded={mobileOpen} aria-controls="admin-menu" color="inherit" edge="start" onClick={() => setMobileOpen(true)} sx={{ justifySelf: 'start' }}>
                                <MenuIcon />
                            </IconButton>
                            <Typography component="div" variant="subtitle1" sx={{ fontWeight: 700, textAlign: 'center' }}>{headerTitle}</Typography>
                        </Toolbar>
                    </AppBar>
                )}

                <MainContent sx={{ ...pagePadding, width: '100%', minWidth: 0, pb: { xs: 'calc(var(--admin-navigation-clearance) + 16px)', sm: 4 } }}>
                    <Box key={location.pathname} className="content-enter" sx={{ minWidth: 0 }}><Outlet /></Box>
                </MainContent>
            </Box>
            {!hasSideNav && <Box sx={{ position: 'fixed', bottom: 'calc(12px + env(safe-area-inset-bottom))', left: 0, right: 0,
                zIndex: theme.zIndex.appBar, px: { xs: 1, sm: 2 }, pointerEvents: 'none' }}>
            <Paper elevation={0} sx={{ maxWidth: 600, mx: 'auto', borderRadius: 1, pointerEvents: 'auto',
                bgcolor: 'rgba(249, 253, 250, 0.94)', border: '1px solid rgba(255, 255, 255, 0.85)',
                backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.45), rgba(232,244,237,0.18))',
                boxShadow: '0 -4px 24px rgba(31, 42, 36, 0.28), 0 8px 32px rgba(31, 42, 36, 0.2)',
                '@supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))': {
                    bgcolor: 'rgba(249, 253, 250, 0.74)', backdropFilter: 'blur(20px) saturate(160%)', WebkitBackdropFilter: 'blur(20px) saturate(160%)',
                } }}>
                <BottomNavigation component="nav" aria-label="Основна навігація адміністратора" showLabels
                    value={selectedNavIndex >= 0 ? location.pathname : false}
                    sx={{ position: 'relative', isolation: 'isolate', height: 68, p: 0.75, bgcolor: 'transparent', borderRadius: 'inherit',
                        '&::before': { content: '""', position: 'absolute', zIndex: -1, top: 6, bottom: 6, left: 6,
                            width: `calc((100% - 12px) / ${PRIMARY_NAV_ITEMS.length})`, borderRadius: 1,
                            background: 'linear-gradient(145deg, rgba(255,255,255,0.95), rgba(202,229,214,0.65))',
                            border: '1px solid rgba(255,255,255,0.9)', boxShadow: surfaceShadow,
                            opacity: selectedNavIndex < 0 ? 0 : 1, transform: `translateX(${Math.max(0, selectedNavIndex) * 100}%)`,
                            transition: 'transform 420ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease',
                        },
                        '& .MuiBottomNavigationAction-root': { flex: '1 1 0%', minWidth: 0, maxWidth: 'none', px: 0.25, py: 0.5, gap: 0.25,
                            borderRadius: 1, color: 'text.secondary', transform: 'scale(1)',
                            transition: 'transform 300ms cubic-bezier(0.22, 1, 0.36, 1), color 200ms ease',
                            '&.Mui-selected': { color: 'primary.dark', transform: 'translateY(-1px) scale(1.04)' },
                            '&:active': { transform: 'scale(0.96)' },
                            '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -3 },
                        },
                        '& .MuiSvgIcon-root': { fontSize: 23, transition: 'transform 300ms cubic-bezier(0.22, 1, 0.36, 1)' },
                        '& .Mui-selected .MuiSvgIcon-root': { transform: 'scale(1.08)' },
                        '& .MuiBottomNavigationAction-label, & .MuiBottomNavigationAction-label.Mui-selected': { fontSize: { xs: '0.625rem', sm: '0.75rem' } },
                        '& .MuiBottomNavigationAction-label.Mui-selected': { fontWeight: 700 },
                        '@media (prefers-reduced-motion: reduce)': {
                            '&::before, & .MuiBottomNavigationAction-root, & .MuiSvgIcon-root, & .MuiBottomNavigationAction-label': { transition: 'none' },
                        },
                    }}>
                    {PRIMARY_NAV_ITEMS.map(item => <BottomNavigationAction key={item.to} component={NavLink} to={item.to} end={item.end}
                        value={item.to} label={item.bottomLabel ?? item.label} aria-label={item.label} icon={item.icon} />)}
                </BottomNavigation>
            </Paper>
            </Box>}
        </Box>
    );
}
