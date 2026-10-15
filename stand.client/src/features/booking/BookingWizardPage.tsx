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
import { todayIso } from '../../utils/date';
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
            step: slot.isBookable && s.date && s.date >= todayIso() ? 'contact' : 'details',
            timeSlotId: slot.timeSlotId,
            startTime: slot.startTime,
            endTime: slot.endTime,
        }));

    const backToDate = () => setState({ step: 'date', date: state.date });
    const backToLocation = () => setState((s) => ({ ...s, step: 'location' }));
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
                                selectedSlotId={state.timeSlotId}
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
                                    date={state.date}
                                    locationName={state.locationName}
                                    locationAddress={state.locationAddress}
                                    onUnavailable={backToTime}
                                    onConfirmed={state.step === 'contact' && state.date >= todayIso() ? onConfirmed : undefined}
                                />
                            )}
                    </Box>
                </Fade>
            </Container>
        </Box>
    );
}
