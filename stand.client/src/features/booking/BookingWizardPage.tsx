import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Container, Fade, IconButton, Stack } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BrandHeader from '../../components/BrandHeader';
import WizardProgress from './components/WizardProgress';
import DateStep from './steps/DateStep';
import LocationStep from './steps/LocationStep';
import TimeStep from './steps/TimeStep';
import ContactStep from './steps/ContactStep';
import { clearWizardState, loadWizardState, saveWizardState, type WizardState } from './wizardState';
import type { LocationDto } from '../../api/types';

export default function BookingWizardPage() {
    const navigate = useNavigate();
    const [state, setState] = useState<WizardState>(() => loadWizardState());

    useEffect(() => {
        saveWizardState(state);
    }, [state]);

    const selectDate = (date: string) => setState({ step: 'location', date });

    const selectLocation = (location: LocationDto) =>
        setState((s) => ({
            ...s,
            step: 'time',
            locationId: location.id,
            locationName: location.name,
            locationAddress: location.address,
        }));

    const onHeld = (hold: {
        holdToken: string;
        expiresAtUtc: string;
        timeSlotId: number;
        startTime: string;
        endTime: string;
    }) =>
        setState((s) => ({
            ...s,
            step: 'contact',
            timeSlotId: hold.timeSlotId,
            startTime: hold.startTime,
            endTime: hold.endTime,
            holdToken: hold.holdToken,
            holdExpiresAtUtc: hold.expiresAtUtc,
        }));

    const backToDate = () => setState({ step: 'date' });
    const backToLocation = () => setState((s) => ({ step: 'location', date: s.date }));
    const backToTime = () =>
        setState((s) => ({
            step: 'time',
            date: s.date,
            locationId: s.locationId,
            locationName: s.locationName,
            locationAddress: s.locationAddress,
        }));

    const onConfirmed = (summary: { cancelToken: string }) => {
        clearWizardState();
        navigate(`/booking/${summary.cancelToken}`, { state: { justBooked: true } });
    };

    const canGoBack = state.step !== 'date';
    const handleBack = () => {
        if (state.step === 'location') backToDate();
        else if (state.step === 'time') backToLocation();
        else if (state.step === 'contact') backToTime();
    };

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
            <BrandHeader />
            <WizardProgress current={state.step} />

            <Container maxWidth="sm" sx={{ py: 2.5 }}>
                <Stack direction="row" sx={{
                    display: { xs: canGoBack ? 'flex' : 'none', sm: 'flex' },
                    mb: 1, minHeight: 40, alignItems: 'center',
                }}>
                    {canGoBack && (
                        <IconButton onClick={handleBack} aria-label="Назад" edge="start">
                            <ArrowBackIcon />
                        </IconButton>
                    )}
                </Stack>

                <Fade in key={state.step} timeout={250}>
                    <Box>
                        {state.step === 'date' && <DateStep onSelect={selectDate} />}

                        {state.step === 'location' && state.date && (
                            <LocationStep date={state.date} onSelect={selectLocation} />
                        )}

                        {state.step === 'time' && state.date && state.locationId && state.locationName && (
                            <TimeStep
                                date={state.date}
                                locationId={state.locationId}
                                locationName={state.locationName}
                                onHeld={onHeld}
                            />
                        )}

                        {state.step === 'contact' &&
                            state.date &&
                            state.locationName &&
                            state.startTime &&
                            state.endTime &&
                            state.holdToken &&
                            state.holdExpiresAtUtc && (
                                <ContactStep
                                    holdToken={state.holdToken}
                                    expiresAtUtc={state.holdExpiresAtUtc}
                                    date={state.date}
                                    locationName={state.locationName}
                                    locationAddress={state.locationAddress}
                                    startTime={state.startTime}
                                    endTime={state.endTime}
                                    onExpired={backToTime}
                                    onConfirmed={onConfirmed}
                                />
                            )}
                    </Box>
                </Fade>
            </Container>
        </Box>
    );
}
