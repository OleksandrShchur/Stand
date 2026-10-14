import { useState } from 'react';
import { AppBar, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Link, Stack, Toolbar, Typography } from '@mui/material';
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined';
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined';

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
            <Dialog
                open={supportOpen}
                onClose={() => setSupportOpen(false)}
                aria-labelledby="support-dialog-title"
                fullWidth
                maxWidth="xs"
                slotProps={{ paper: { sx: { border: '1px solid', borderColor: 'divider' } } }}
            >
                <DialogTitle id="support-dialog-title" sx={{ display: 'flex', alignItems: 'center', gap: 1.25, p: 2, bgcolor: 'background.default', color: 'primary.dark', borderBottom: '1px solid', borderColor: 'divider', fontWeight: 700 }}>
                    <HelpOutlineOutlinedIcon color="primary" />
                    Технічна підтримка
                </DialogTitle>
                <DialogContent sx={{ p: 2, '&.MuiDialogContent-root': { pt: 2 } }}>
                    <Stack spacing={0.5} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                        <Link href="tel:0682385502" underline="hover" sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 44, fontSize: '1.25rem', fontWeight: 700, alignSelf: 'flex-start' }}>
                            <PhoneOutlinedIcon fontSize="small" />
                            0682385502
                        </Link>
                        <Typography variant="body2" color="text.secondary">Ярослав Карлійчук</Typography>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 2, pt: 0, pb: 2 }}>
                    <Button variant="contained" fullWidth onClick={() => setSupportOpen(false)}>Закрити</Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
