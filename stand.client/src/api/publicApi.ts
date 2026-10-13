import { api } from './client';
import type {
    BookingSummaryDto,
    CalendarDto,
    LocationDto,
    MyShiftDto,
    PublicUserMeDto,
    SlotAvailabilityDto,
} from './types';

export const publicApi = {
    login: (phone: string) => api.post<PublicUserMeDto>('/api/auth/login', { phone }),

    logout: () => api.post<void>('/api/auth/logout'),

    me: () => api.get<PublicUserMeDto>('/api/auth/me'),

    getCalendar: () => api.get<CalendarDto>('/api/calendar'),

    getLocations: (date?: string) => api.get<LocationDto[]>(date ? `/api/locations?date=${encodeURIComponent(date)}` : '/api/locations'),

    getSlots: (date: string, locationId: number) =>
        api.get<SlotAvailabilityDto[]>(`/api/slots?date=${encodeURIComponent(date)}&locationId=${locationId}`),

    book: (date: string, locationId: number, timeSlotId: number) =>
        api.post<BookingSummaryDto>('/api/bookings', { date, locationId, timeSlotId }),

    getByCancelToken: (cancelToken: string) =>
        api.get<BookingSummaryDto>(`/api/bookings/${cancelToken}`),

    cancel: (cancelToken: string) =>
        api.post<BookingSummaryDto>('/api/bookings/cancel', { cancelToken }),

    getMyUpcomingShifts: () => api.get<MyShiftDto[]>('/api/bookings/mine'),

    cancelMyShift: (cancelToken: string) =>
        api.post<BookingSummaryDto>('/api/bookings/cancel', { cancelToken }),
};
