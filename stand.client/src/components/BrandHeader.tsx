import { useState } from 'react';
import { AppBar, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Link, Stack, Toolbar, Typography } from '@mui/material';
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined';

export default function BrandHeader() {
    const [supportOpen, setSupportOpen] = useState(false);

    return (
        <>
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
                    <Button
                        color="inherit"
                        aria-label="Технічна підтримка"
                        aria-haspopup="dialog"
                        onClick={() => setSupportOpen(true)}
                        sx={{ ml: 'auto', p: 0, minWidth: 0, minHeight: 0, lineHeight: 1, gap: { xs: 0, sm: 1 } }}
                    >
                        <HelpOutlineOutlinedIcon sx={{ fontSize: 30 }} />
                        <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Підтримка</Box>
                    </Button>
                </Toolbar>
            </AppBar>
            <Dialog open={supportOpen} onClose={() => setSupportOpen(false)} aria-labelledby="support-dialog-title" fullWidth maxWidth="xs">
                <DialogTitle id="support-dialog-title">Технічна підтримка</DialogTitle>
                <DialogContent>
                    <Stack spacing={1}>
                        <Link href="tel:0682385502" sx={{ fontSize: '1.25rem', fontWeight: 600, alignSelf: 'flex-start' }}>0682385502</Link>
                        <Typography>Ярослав Карлійчук</Typography>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSupportOpen(false)}>Закрити</Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
