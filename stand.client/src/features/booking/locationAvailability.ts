import type { LocationDto, SlotAvailabilityDto } from '../../api/types';
import { isSlotBookable } from './slotSelection';
import { getSlotTimeStatus } from './slotTimeStatus';

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
