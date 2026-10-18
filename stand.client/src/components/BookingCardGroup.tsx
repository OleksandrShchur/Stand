import type { ReactNode } from 'react';
import { Stack } from '@mui/material';
import { surfaceRadius, surfaceShadow } from '../surfaceStyles';

export default function BookingCardGroup({ children }: { children: ReactNode }) {
    return <Stack sx={{
        gap: '3px',
        borderRadius: 1,
        boxShadow: surfaceShadow,
        '& > .MuiCard-root': {
            borderRadius: 0,
            boxShadow: 'none',
            '&:first-of-type': {
                borderTopLeftRadius: `${surfaceRadius}px`,
                borderTopRightRadius: `${surfaceRadius}px`,
            },
            '&:last-of-type': {
                borderBottomLeftRadius: `${surfaceRadius}px`,
                borderBottomRightRadius: `${surfaceRadius}px`,
            },
        },
    }}>{children}</Stack>;
}
