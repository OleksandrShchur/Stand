import { createTheme } from '@mui/material/styles';

// Calm, civic/volunteer-appropriate green palette. Deliberately avoids saturated
// purple/violet "generic AI" tones; favours muted, trustworthy greens with warm neutrals.
const theme = createTheme({
    palette: {
        mode: 'light',
        primary: {
            main: '#2F6E52',
            light: '#5C9A7D',
            dark: '#1E4A37',
            contrastText: '#FFFFFF',
        },
        secondary: {
            main: '#8A7A4F',
            light: '#B3A47A',
            dark: '#5E5233',
            contrastText: '#FFFFFF',
        },
        success: {
            main: '#3C8F5C',
        },
        warning: {
            main: '#C78A2E',
        },
        error: {
            main: '#C14A4A',
        },
        background: {
            default: '#F5F8F5',
            paper: '#FFFFFF',
        },
        text: {
            primary: '#1F2A24',
            secondary: '#54635B',
        },
        divider: '#DCE6DF',
    },
    typography: {
        fontFamily: [
            '-apple-system',
            'BlinkMacSystemFont',
            '"Segoe UI"',
            'Roboto',
            '"Helvetica Neue"',
            'Arial',
            'sans-serif',
        ].join(','),
        h1: { fontWeight: 700 },
        h2: { fontWeight: 700 },
        h3: { fontWeight: 700 },
        h4: { fontWeight: 700, fontSize: '1.5rem' },
        h5: { fontWeight: 600, fontSize: '1.25rem' },
        h6: { fontWeight: 600, fontSize: '1.05rem' },
        button: { fontWeight: 600, textTransform: 'none' },
    },
    shape: {
        borderRadius: 8,
    },
    spacing: 8,
    components: {
        MuiButton: {
            defaultProps: { disableElevation: true },
            styleOverrides: {
                root: {
                    borderRadius: 8,
                    paddingTop: 10,
                    paddingBottom: 10,
                    minHeight: 44,
                },
                sizeLarge: {
                    paddingTop: 14,
                    paddingBottom: 14,
                    fontSize: '1.05rem',
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    borderRadius: 8,
                },
            },
        },
        MuiCardContent: {
            styleOverrides: {
                root: {
                    padding: 16,
                    '&:last-child': { paddingBottom: 16 },
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                rounded: {
                    borderRadius: 8,
                },
            },
        },
        MuiChip: {
            styleOverrides: {
                root: {
                    borderRadius: 8,
                    fontWeight: 600,
                },
            },
        },
        MuiAppBar: {
            styleOverrides: {
                root: {
                    backgroundColor: '#2F6E52',
                },
            },
        },
        MuiCssBaseline: {
            styleOverrides: {
                body: {
                    backgroundColor: '#F5F8F5',
                    '--state-available-bg': '#EAF6EF',
                    '--state-available-border': '#2F7D57',
                    '--state-available-text': '#173B2A',
                    '--state-selected-bg': '#1E4A37',
                    '--state-selected-text': '#FFFFFF',
                    '--state-unavailable-text': '#6B7280',
                    '--state-full-bg': '#EEF1EF',
                    '--state-full-border': '#CBD5CF',
                    '--state-full-text': '#4B5563',
                    '--state-mine-border': '#207A4F',
                    '--state-mine-text': '#155C3A',
                },
                '*:focus-visible': {
                    outline: '3px solid #7FB69A',
                    outlineOffset: 2,
                },
                '@media (prefers-reduced-motion: reduce)': {
                    '*, *::before, *::after': {
                        animationDuration: '0.01ms !important',
                        animationIterationCount: '1 !important',
                        scrollBehavior: 'auto !important',
                        transitionDuration: '0.01ms !important',
                    },
                },
            },
        },
    },
});

export default theme;
