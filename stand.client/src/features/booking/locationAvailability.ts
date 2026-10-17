import type { CalendarDto, LocationDto, SlotAvailabilityDto } from '../../api/types';
import { isSlotBookable } from './slotSelection';
import { getKyivDateTime, getSlotTimeStatus } from './slotTimeStatus';

interface AvailabilityApi {
    getLocations: (date: string, signal?: AbortSignal) => Promise<LocationDto[]>;
    getSlots: (date: string, locationId: number, signal?: AbortSignal) => Promise<SlotAvailabilityDto[]>;
}

export async function loadLocationsWithAvailability(date: string, api: AvailabilityApi, now = new Date(), signal?: AbortSignal): Promise<LocationDto[]> {
    const locations = await api.getLocations(date, signal);
    return Promise.all(locations.map(async (location) => {
        if (typeof location.hasAvailableBookings === 'boolean') return location;
        // Older servers omit this field. Use the same rules as time selection.
        const slots = await api.getSlots(date, location.id, signal);
        return {
            ...location,
            hasAvailableBookings: slots.some((slot) =>
                isSlotBookable(slot) && getSlotTimeStatus(date, slot, now) === 'upcoming'),
        };
    }));
}

export async function loadCalendarWithAvailability(
    api: AvailabilityApi & { getCalendar: (signal?: AbortSignal) => Promise<CalendarDto> },
    now = new Date(),
    signal?: AbortSignal,
): Promise<CalendarDto> {
    const calendar = await api.getCalendar(signal);
    const today = getKyivDateTime(now).date;
    if (!calendar.bookableDates.includes(today)) return calendar;

    // Current servers include today's read-only state and already check capacity.
    if (Array.isArray(calendar.readOnlyDates)) return calendar;
    // Compatibility only for older servers without authoritative calendar availability.
    const locations = await loadLocationsWithAvailability(today, api, now, signal);
    if (locations.some((location) => location.hasAvailableBookings === true)) return calendar;

    return {
        ...calendar,
        bookableDates: calendar.bookableDates.filter((date) => date !== today),
        readOnlyDates: [...new Set([...(calendar.readOnlyDates ?? []), today])],
    };
}
