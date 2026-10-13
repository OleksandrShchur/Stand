import { Chip } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import BlockIcon from '@mui/icons-material/Block';
import type React from 'react';

type Tone = 'available' | 'selected' | 'unavailable' | 'full' | 'mine' | 'warning';

export default function StateBadge({ label, tone, icon }: { label: string; tone: Tone; icon?: React.ReactElement }) {
    const sxByTone = {
        available: { bgcolor: 'var(--state-available-bg)', borderColor: 'var(--state-available-border)', color: 'var(--state-available-text)' },
        selected: { bgcolor: 'var(--state-selected-bg)', color: 'var(--state-selected-text)' },
        unavailable: { bgcolor: 'transparent', color: 'var(--state-unavailable-text)' },
        full: { bgcolor: 'var(--state-full-bg)', color: 'var(--state-full-text)' },
        mine: { bgcolor: 'transparent', borderColor: 'var(--state-mine-border)', color: 'var(--state-mine-text)' },
        warning: { bgcolor: '#FFF4D8', borderColor: '#B7791F', color: '#68420B' },
    } satisfies Record<Tone, object>;

    const fallbackIcon = tone === 'mine' ? <CheckIcon /> : tone === 'full' ? <BlockIcon /> : undefined;

    return (
        <Chip
            size="small"
            variant={tone === 'selected' || tone === 'full' ? 'filled' : 'outlined'}
            icon={icon ?? fallbackIcon}
            label={label}
            sx={{ minHeight: 28, fontSize: 12, fontWeight: 700, ...sxByTone[tone] }}
        />
    );
}
