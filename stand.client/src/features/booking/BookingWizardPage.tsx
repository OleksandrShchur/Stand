import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Container, Fade, IconButton, Stack } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BrandHeader from '../../components/BrandHeader';
import WizardProgress from './components/WizardProgress';
import DateStep from './steps/DateStep';
import LocationStep from './steps/LocationStep';
import TimeStep from './steps/TimeStep';
import ShiftDetailsStep from './steps/ShiftDetailsStep';
import { clearWizardState, loadWizardState, saveWizardState, type WizardState } from './wizardState';
import type { LocationDto, SlotAvailabilityDto } from '../../api/types';

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

    const selectTime = (slot: SlotAvailabilityDto) =>
        setState((s) => ({
            ...s,
            step: slot.isBookable ? 'contact' : 'details',
            timeSlotId: slot.timeSlotId,
            startTime: slot.startTime,
            endTime: slot.endTime,
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
        else if (state.step === 'contact' || state.step === 'details') backToTime();
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
                                onSelect={selectTime}
                            />
                        )}

                        {(state.step === 'contact' || state.step === 'details') &&
                            state.date &&
                            state.locationName &&
                            state.locationId &&
                            state.timeSlotId && (
                                <ShiftDetailsStep
                                    locationId={state.locationId}
                                    timeSlotId={state.timeSlotId}
                                    date={state.date}
                                    locationName={state.locationName}
                                    locationAddress={state.locationAddress}
                                    onUnavailable={backToTime}
                                    onConfirmed={state.step === 'contact' ? onConfirmed : undefined}
                                />
                            )}
                    </Box>
                </Fade>
            </Container>
        </Box>
    );
}
