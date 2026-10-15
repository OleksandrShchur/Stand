import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Container, Fade } from '@mui/material';
import BrandHeader from '../../components/BrandHeader';
import WizardProgress from './components/WizardProgress';
import DateStep from './steps/DateStep';
import LocationStep from './steps/LocationStep';
import TimeStep from './steps/TimeStep';
import ShiftDetailsStep from './steps/ShiftDetailsStep';
import BookingHomePage from './BookingHomePage';
import { clearWizardState, initialWizardState, loadWizardState, saveWizardState, type WizardState, type WizardStep } from './wizardState';
import type { LocationDto, SlotAvailabilityDto } from '../../api/types';
import { pagePadding } from '../../layoutSpacing';

export default function BookingWizardPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const startBooking = Boolean((location.state as { startBooking?: boolean } | null)?.startBooking);
    const [showHome, setShowHome] = useState(() => !startBooking && loadWizardState().step === 'date' && !loadWizardState().date);
    const [state, setState] = useState<WizardState>(() => startBooking ? initialWizardState : loadWizardState());
    const [conflictMessage, setConflictMessage] = useState<string | null>(null);

    useEffect(() => {
        saveWizardState(state);
    }, [state]);

    useEffect(() => {
        if (startBooking) {
            navigate(location.pathname, { replace: true, state: null });
        }
    }, [startBooking, location.pathname, navigate]);

    const start = () => {
        setConflictMessage(null);
        setState(initialWizardState);
        setShowHome(false);
    };

    const returnHome = () => {
        setState(initialWizardState);
        setConflictMessage(null);
        clearWizardState();
        setShowHome(true);
    };

    const selectDate = (date: string) => {
        setConflictMessage(null);
        setState({ step: 'date', date });
    };

    const selectLocation = (location: LocationDto) => {
        setConflictMessage(null);
        setState((s) => ({
            ...s,
            step: 'time',
            locationId: location.id,
            locationName: location.name,
            locationAddress: location.address,
            timeSlotId: undefined,
            timeSlotIds: undefined,
            startTime: undefined,
            endTime: undefined,
        }));
    };

    const selectTime = (slots: SlotAvailabilityDto[]) => {
        if (!slots.length) return;
        setConflictMessage(null);
        setState((s) => ({
            ...s,
            step: 'contact',
            timeSlotId: slots[0].timeSlotId,
            timeSlotIds: slots.map((slot) => slot.timeSlotId),
            startTime: slots[0].startTime,
            endTime: slots[slots.length - 1].endTime,
        }));
    };

    const backToDate = () => {
        setConflictMessage(null);
        setState({ step: 'date', date: state.date });
    };
    const backToLocation = () => {
        setConflictMessage(null);
        setState((s) => ({ ...s, step: 'location' }));
    };
    const backToTime = (message?: string) => {
        setConflictMessage(message ?? null);
        setState((s) => ({
            step: 'time',
            date: s.date,
            locationId: s.locationId,
            locationName: s.locationName,
            locationAddress: s.locationAddress,
            timeSlotId: s.timeSlotId,
            timeSlotIds: s.timeSlotIds,
        }));
    };

    const onConfirmed = (summaries: { cancelToken: string }[]) => {
        clearWizardState();
        navigate('/my-shifts', { state: { justBookedCount: summaries.length } });
    };

    const goToStep = (step: WizardStep) => {
        if (step === 'date') backToDate();
        if (step === 'location' && state.date) backToLocation();
        if (step === 'time' && state.date && state.locationId) backToTime();
    };

    if (showHome) return <BookingHomePage onStart={start} />;

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
            <BrandHeader onHome={returnHome} title="Запис" />
            <WizardProgress current={state.step} onNavigate={goToStep} />

            <Container maxWidth="sm" sx={pagePadding}>
                <Fade in key={state.step} timeout={250}>
                    <Box>
                        {state.step === 'date' && (
                            <DateStep
                                selectedDate={state.date}
                                onSelect={selectDate}
                                onBack={returnHome}
                                onContinue={() => {
                                    if (state.date) setState((s) => ({ ...s, step: 'location' }));
                                }}
                            />
                        )}

                        {state.step === 'location' && state.date && (
                            <LocationStep date={state.date} selectedLocationId={state.locationId} onSelect={selectLocation} onBack={backToDate} />
                        )}

                        {state.step === 'time' && state.date && state.locationId && state.locationName && (
                            <TimeStep
                                date={state.date}
                                locationId={state.locationId}
                                locationName={state.locationName}
                                selectedSlotIds={state.timeSlotIds ?? (state.timeSlotId ? [state.timeSlotId] : [])}
                                conflictMessage={conflictMessage}
                                onSelect={selectTime}
                                onBack={backToLocation}
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
                                    timeSlotIds={state.timeSlotIds}
                                    date={state.date}
                                    locationName={state.locationName}
                                    locationAddress={state.locationAddress}
                                    onUnavailable={backToTime}
                                    onBack={() => backToTime()}
                                    onConfirmed={state.step === 'contact' ? onConfirmed : undefined}
                                />
                            )}
                    </Box>
                </Fade>
            </Container>
        </Box>
    );
}
