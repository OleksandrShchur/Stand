import { useEffect, useState } from 'react';
import { Box, LinearProgress, Typography } from '@mui/material';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';

const TOTAL_HOLD_SECONDS = 120;

export default function HoldCountdown({
    expiresAtUtc,
    onExpire,
}: {
    expiresAtUtc: string;
    onExpire: () => void;
}) {
    const [secondsLeft, setSecondsLeft] = useState(() => computeSecondsLeft(expiresAtUtc));

    useEffect(() => {
        const interval = setInterval(() => {
            const left = computeSecondsLeft(expiresAtUtc);
            setSecondsLeft(left);
            if (left <= 0) {
                clearInterval(interval);
                onExpire();
            }
        }, 1000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [expiresAtUtc]);

    const minutes = Math.floor(Math.max(0, secondsLeft) / 60);
    const seconds = Math.max(0, secondsLeft) % 60;
    const label = `${minutes}:${String(seconds).padStart(2, '0')}`;
    const progress = Math.max(0, Math.min(100, (secondsLeft / TOTAL_HOLD_SECONDS) * 100));
    const urgent = secondsLeft <= 30;

    return (
        <Box
            sx={{
                p: 1.5,
                borderRadius: 2,
                bgcolor: urgent ? 'error.main' : 'primary.main',
                color: 'common.white',
                transition: 'background-color 0.4s ease',
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                <TimerOutlinedIcon fontSize="small" />
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Місце утримується: {label}
                </Typography>
            </Box>
            <LinearProgress
                variant="determinate"
                value={progress}
                sx={{
                    height: 6,
                    borderRadius: 3,
                    bgcolor: 'rgba(255,255,255,0.3)',
                    '& .MuiLinearProgress-bar': { bgcolor: 'common.white' },
                }}
            />
        </Box>
    );
}

function computeSecondsLeft(expiresAtUtc: string): number {
    const ms = new Date(expiresAtUtc).getTime() - Date.now();
    return Math.max(0, Math.round(ms / 1000));
}
