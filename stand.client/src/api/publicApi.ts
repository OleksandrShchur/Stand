import { api } from './client';
import type {
    BookingSummaryDto,
    CalendarDto,
    HoldResponseDto,
    LocationDto,
    SlotAvailabilityDto,
} from './types';

export const publicApi = {
    getCalendar: () => api.get<CalendarDto>('/api/calendar'),

    getLocations: () => api.get<LocationDto[]>('/api/locations'),

    getSlots: (date: string, locationId: number) =>
        api.get<SlotAvailabilityDto[]>(`/api/slots?date=${encodeURIComponent(date)}&locationId=${locationId}`),

    hold: (date: string, locationId: number, timeSlotId: number) =>
        api.post<HoldResponseDto>('/api/bookings/hold', { date, locationId, timeSlotId }),

    confirm: (holdToken: string, firstName: string, lastName: string, phone: string, comment: string) =>
        api.post<BookingSummaryDto>('/api/bookings/confirm', { holdToken, firstName, lastName, phone, comment }),

    getByCancelToken: (cancelToken: string) =>
        api.get<BookingSummaryDto>(`/api/bookings/${cancelToken}`),

    cancel: (cancelToken: string) =>
        api.post<BookingSummaryDto>('/api/bookings/cancel', { cancelToken }),
};
