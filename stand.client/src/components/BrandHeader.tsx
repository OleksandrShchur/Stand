import { AppBar, Box, Toolbar, Typography } from '@mui/material';
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';

export default function BrandHeader() {
    return (
        <AppBar position="sticky" elevation={0}>
            <Toolbar sx={{ py: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                    <VolunteerActivismIcon fontSize="medium" />
                    <Box>
                        <Typography variant="subtitle1" component="div" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
                            Стенди
                        </Typography>
                        <Typography variant="caption" component="div" sx={{ opacity: 0.85, lineHeight: 1 }}>
                            Запис
                        </Typography>
                    </Box>
                </Box>
            </Toolbar>
        </AppBar>
    );
}
