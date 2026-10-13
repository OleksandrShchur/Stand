import { Box, Typography } from '@mui/material';
import type { WizardStep } from '../wizardState';

const STEPS: { key: WizardStep; label: string }[] = [
    { key: 'date', label: 'Дата' },
    { key: 'location', label: 'Локація' },
    { key: 'time', label: 'Час' },
    { key: 'contact', label: 'Контакти' },
];

export default function WizardProgress({ current }: { current: WizardStep }) {
    const currentIndex = STEPS.findIndex((s) => s.key === current);

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 2, pt: 2 }}>
            {STEPS.map((s, i) => (
                <Box key={s.key} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                    <Box
                        sx={{
                            width: '100%',
                            height: 5,
                            borderRadius: 3,
                            backgroundColor: i <= currentIndex ? 'primary.main' : 'divider',
                            transition: 'background-color 0.3s ease',
                        }}
                    />
                    <Typography
                        variant="caption"
                        sx={{
                            color: i === currentIndex ? 'primary.main' : 'text.secondary',
                            fontWeight: i === currentIndex ? 700 : 500,
                        }}
                    >
                        {s.label}
                    </Typography>
                </Box>
            ))}
        </Box>
    );
}
