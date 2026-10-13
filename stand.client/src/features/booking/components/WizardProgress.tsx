import { Box, ButtonBase, Typography } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import type { WizardStep } from '../wizardState';

const STEPS: { key: WizardStep; label: string }[] = [
    { key: 'date', label: 'Дата' },
    { key: 'location', label: 'Локація' },
    { key: 'time', label: 'Час' },
    { key: 'contact', label: 'Підтвердження' },
];

export default function WizardProgress({ current, onNavigate }: { current: WizardStep; onNavigate?: (step: WizardStep) => void }) {
    const currentIndex = STEPS.findIndex((s) => s.key === (current === 'details' ? 'contact' : current));

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 2, pt: 1, maxWidth: 600, mx: 'auto' }}>
            {STEPS.map((s, i) => {
                const completed = i < currentIndex;
                const active = i === currentIndex;
                const clickable = completed && Boolean(onNavigate);

                return (
                    <ButtonBase
                        key={s.key}
                        disabled={!clickable}
                        onClick={() => onNavigate?.(s.key)}
                        aria-current={active ? 'step' : undefined}
                        sx={{
                            flex: 1,
                            minHeight: 44,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 0.5,
                            cursor: clickable ? 'pointer' : 'default',
                        }}
                    >
                        <Box
                            sx={{
                                width: '100%',
                                height: active ? 7 : 5,
                                borderRadius: 3,
                                backgroundColor: i <= currentIndex ? 'primary.main' : 'divider',
                            }}
                        />
                        <Typography
                            variant="caption"
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.25,
                                color: active || completed ? 'primary.dark' : 'text.secondary',
                                fontWeight: active ? 800 : 700,
                                fontSize: 12,
                            }}
                        >
                            {completed && <CheckIcon sx={{ fontSize: 13 }} />}
                            {s.label}
                        </Typography>
                    </ButtonBase>
                );
            })}
        </Box>
    );
}
