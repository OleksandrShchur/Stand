import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { AppBar, Box, Button, IconButton, Link, Stack, Toolbar, Typography } from '@mui/material';
import AppDialog from './AppDialog';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined';
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined';

export default function BrandHeader({ onHome, title = 'Головна' }: { onHome?: () => void; title?: string }) {
    const [supportOpen, setSupportOpen] = useState(false);

    return (
        <>
            <AppBar position="sticky" elevation={0}>
                <Toolbar sx={{ py: 1, display: 'grid', gridTemplateColumns: '1fr auto 1fr' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                        <IconButton
                            component={RouterLink}
                            to="/"
                            color="inherit"
                            aria-label="На головну"
                            onClick={(event) => {
                                if (onHome) {
                                    event.preventDefault();
                                    onHome();
                                }
                            }}
                        >
                            <HomeOutlinedIcon sx={{ fontSize: 30 }} />
                        </IconButton>
                    </Box>
                    <Typography variant="h6" component="div" sx={{ fontWeight: 700, textAlign: 'center' }}>
                        {title}
                    </Typography>
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
            <AppDialog
                open={supportOpen}
                onClose={() => setSupportOpen(false)}
                title="Технічна підтримка"
                icon={<HelpOutlineOutlinedIcon color="primary" />}
                actions={<Button variant="contained" fullWidth onClick={() => setSupportOpen(false)}>Закрити</Button>}
            >
                <Stack spacing={0.5} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Link href="tel:0682385502" underline="hover" sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 44, fontSize: '1.25rem', fontWeight: 700, alignSelf: 'flex-start' }}>
                        <PhoneOutlinedIcon fontSize="small" />
                        0682385502
                    </Link>
                    <Typography variant="body2" color="text.secondary">Ярослав Карлійчук</Typography>
                </Stack>
            </AppDialog>
        </>
    );
}
