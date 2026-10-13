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
import BookingHomePage from './BookingHomePage';
import { clearWizardState, initialWizardState, loadWizardState, saveWizardState, type WizardState, type WizardStep } from './wizardState';
import type { LocationDto, SlotAvailabilityDto } from '../../api/types';
import { bookingCopy } from './bookingCopy';

export default function BookingWizardPage() {
    const navigate = useNavigate();
    const [showHome, setShowHome] = useState(() => loadWizardState().step === 'date' && !loadWizardState().date);
    const [state, setState] = useState<WizardState>(() => loadWizardState());
    const [conflictMessage, setConflictMessage] = useState<string | null>(null);

    useEffect(() => {
        saveWizardState(state);
    }, [state]);

    const start = () => {
        setState(initialWizardState);
        setShowHome(false);
    };

    const selectDate = (date: string) => {
        setConflictMessage(null);
        setState({ step: 'location', date });
    };

    const selectLocation = (location: LocationDto) =>
        setState((s) => ({
            ...s,
            step: 'time',
            locationId: location.id,
            locationName: location.name,
            locationAddress: location.address,
            timeSlotId: undefined,
            startTime: undefined,
            endTime: undefined,
        }));

    const selectTime = (slot: SlotAvailabilityDto) =>
        setState((s) => ({
            ...s,
            step: slot.isBookable ? 'contact' : 'details',
            timeSlotId: slot.timeSlotId,
            startTime: slot.startTime,
            endTime: slot.endTime,
        }));

    const backToDate = () => setState({ step: 'date', date: state.date });
    const backToLocation = () => setState((s) => ({ step: 'location', date: s.date }));
    const backToTime = (message?: string) => {
        setConflictMessage(message ?? null);
        setState((s) => ({
            step: 'time',
            date: s.date,
            locationId: s.locationId,
            locationName: s.locationName,
            locationAddress: s.locationAddress,
            timeSlotId: s.timeSlotId,
        }));
    };

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

    const goToStep = (step: WizardStep) => {
        if (step === 'date') backToDate();
        if (step === 'location' && state.date) backToLocation();
        if (step === 'time' && state.date && state.locationId) backToTime();
    };

    if (showHome) return <BookingHomePage onStart={start} />;

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
            <BrandHeader />
            <WizardProgress current={state.step} onNavigate={goToStep} />

            <Container maxWidth="sm" sx={{ py: 2.5 }}>
                <Stack direction="row" sx={{
                    display: { xs: canGoBack ? 'flex' : 'none', sm: 'flex' },
                    mb: 1,
                    minHeight: 44,
                    alignItems: 'center',
                }}>
                    {canGoBack && (
                        <IconButton onClick={handleBack} aria-label={bookingCopy.back} edge="start" sx={{ minWidth: 44, minHeight: 44, color: 'primary.dark' }}>
                            <ArrowBackIcon />
                        </IconButton>
                    )}
                </Stack>

                <Fade in key={state.step} timeout={250}>
                    <Box>
                        {state.step === 'date' && <DateStep selectedDate={state.date} onSelect={selectDate} />}

                        {state.step === 'location' && state.date && (
                            <LocationStep date={state.date} onSelect={selectLocation} />
                        )}

                        {state.step === 'time' && state.date && state.locationId && state.locationName && (
                            <TimeStep
                                date={state.date}
                                locationId={state.locationId}
                                locationName={state.locationName}
                                selectedSlotId={state.timeSlotId}
                                conflictMessage={conflictMessage}
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
