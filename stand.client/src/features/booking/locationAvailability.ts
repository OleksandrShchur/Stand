import type { CalendarDto, LocationDto, SlotAvailabilityDto } from '../../api/types';
import { isSlotBookable } from './slotSelection';
import { getKyivDateTime, getSlotTimeStatus } from './slotTimeStatus';

interface AvailabilityApi {
    getLocations: (date: string) => Promise<LocationDto[]>;
    getSlots: (date: string, locationId: number) => Promise<SlotAvailabilityDto[]>;
}

export async function loadLocationsWithAvailability(date: string, api: AvailabilityApi, now = new Date()): Promise<LocationDto[]> {
    const locations = await api.getLocations(date);
    return Promise.all(locations.map(async (location) => {
        if (typeof location.hasAvailableBookings === 'boolean') return location;
        // Older servers omit this field. Use the same rules as time selection.
        const slots = await api.getSlots(date, location.id);
        return {
            ...location,
            hasAvailableBookings: slots.some((slot) =>
                isSlotBookable(slot) && getSlotTimeStatus(date, slot, now) === 'upcoming'),
        };
    }));
}

export async function loadCalendarWithAvailability(
    api: AvailabilityApi & { getCalendar: () => Promise<CalendarDto> },
    now = new Date(),
): Promise<CalendarDto> {
    const calendar = await api.getCalendar();
    const today = getKyivDateTime(now).date;
    if (!calendar.bookableDates.includes(today)) return calendar;

    // Verify today's remaining availability even when the calendar comes from an older server.
    const locations = await loadLocationsWithAvailability(today, api, now);
    if (locations.some((location) => location.hasAvailableBookings === true)) return calendar;

    return {
        ...calendar,
        bookableDates: calendar.bookableDates.filter((date) => date !== today),
        readOnlyDates: [...new Set([...(calendar.readOnlyDates ?? []), today])],
    };
}
