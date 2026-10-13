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
        borderRadius: 14,
    },
    spacing: 8,
    components: {
        MuiButton: {
            defaultProps: { disableElevation: true },
            styleOverrides: {
                root: {
                    borderRadius: 12,
                    paddingTop: 10,
                    paddingBottom: 10,
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
                    borderRadius: 16,
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                rounded: {
                    borderRadius: 16,
                },
            },
        },
        MuiChip: {
            styleOverrides: {
                root: {
                    borderRadius: 10,
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
                },
            },
        },
    },
});

export default theme;
