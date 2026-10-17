import { api } from './client';
import type {
    AdminMeDto,
    AdminUserDto,
    AuthorizedUserAdminDto,
    AvailableDateAdminDto,
    BookingAdminDto,
    BookingListResultDto,
    DashboardDto,
    DateTimeSlotExceptionAdminDto,
    LocationAdminDto,
    TimeSlotAdminDto,
    DayScheduleDto, SaveScheduleDto, ScheduleSaveResultDto,
} from './types';

export interface BookingFilters {
    date?: string;
    locationId?: number;
    timeSlotId?: number;
    phone?: string;
    isBooked?: boolean;
    page?: number;
    pageSize?: number;
}

function toQuery(params: object): string {
    const parts: string[] = [];
    for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
        if (value !== undefined && value !== null && value !== '') {
            parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
        }
    }
    return parts.length > 0 ? `?${parts.join('&')}` : '';
}

export const adminApi = {
    getSchedule: (date: string) => api.get<DayScheduleDto>(`/api/admin/schedule${toQuery({ date })}`),
    previewSchedule: (dto: SaveScheduleDto) => api.post<ScheduleSaveResultDto>('/api/admin/schedule/preview', dto),
    saveSchedule: (dto: SaveScheduleDto) => api.put<ScheduleSaveResultDto>('/api/admin/schedule', dto),
    // Auth
    login: (login: string, password: string) => api.post<AdminMeDto>('/api/admin/auth/login', { login, password }),
    logout: () => api.post<void>('/api/admin/auth/logout'),
    me: () => api.get<AdminMeDto>('/api/admin/auth/me'),

    // Locations
    listLocations: () => api.get<LocationAdminDto[]>('/api/admin/locations'),
    createLocation: (dto: Omit<LocationAdminDto, 'id'>) => api.post<LocationAdminDto>('/api/admin/locations', dto),
    updateLocation: (id: number, dto: Omit<LocationAdminDto, 'id'>) =>
        api.put<LocationAdminDto>(`/api/admin/locations/${id}`, dto),
    activateLocation: (id: number) => api.post<LocationAdminDto>(`/api/admin/locations/${id}/activate`),
    deactivateLocation: (id: number) => api.post<LocationAdminDto>(`/api/admin/locations/${id}/deactivate`),

    // Time slots
    listTimeSlots: (includeScheduleOnly = false) => api.get<TimeSlotAdminDto[]>(`/api/admin/timeslots${toQuery({ includeScheduleOnly })}`),
    createTimeSlot: (dto: Omit<TimeSlotAdminDto, 'id'>) => api.post<TimeSlotAdminDto>('/api/admin/timeslots', dto),
    updateTimeSlot: (id: number, dto: Omit<TimeSlotAdminDto, 'id'>) =>
        api.put<TimeSlotAdminDto>(`/api/admin/timeslots/${id}`, dto),
    activateTimeSlot: (id: number) => api.post<TimeSlotAdminDto>(`/api/admin/timeslots/${id}/activate`),
    deactivateTimeSlot: (id: number) => api.post<TimeSlotAdminDto>(`/api/admin/timeslots/${id}/deactivate`),

    // Available dates (whitelist)
    listDates: (from?: string, to?: string) =>
        api.get<AvailableDateAdminDto[]>(`/api/admin/dates${toQuery({ from, to })}`),
    setDate: (date: string, isActive: boolean) => api.put<AvailableDateAdminDto>('/api/admin/dates', { date, isActive }),
    bulkDates: (year: number, month: number, weekdays: number[], isActive: boolean) =>
        api.post<{ updated: number }>('/api/admin/dates/bulk', { year, month, weekdays, isActive }),

    // Per-date exceptions
    listExceptions: (date?: string) =>
        api.get<DateTimeSlotExceptionAdminDto[]>(`/api/admin/exceptions${toQuery({ date })}`),
    upsertException: (date: string, timeSlotId: number, isBlocked: boolean, note?: string) =>
        api.post<DateTimeSlotExceptionAdminDto>('/api/admin/exceptions', { date, timeSlotId, isBlocked, note }),
    deleteException: (id: number) => api.del<void>(`/api/admin/exceptions/${id}`),

    // Bookings
    listBookings: (filters: BookingFilters) =>
        api.get<BookingListResultDto>(`/api/admin/bookings${toQuery(filters)}`),
    cancelBooking: (id: number) => api.post<void>(`/api/admin/bookings/${id}/cancel`),
    exportCsvUrl: (filters: BookingFilters) => `/api/admin/bookings/export.csv${toQuery(filters)}`,

    // Dashboard
    getDashboard: () => api.get<DashboardDto>('/api/admin/dashboard'),

    // Admin users
    listUsers: () => api.get<AdminUserDto[]>('/api/admin/users'),
    createUser: (login: string, password: string) => api.post<AdminUserDto>('/api/admin/users', { login, password }),
    enableUser: (id: number) => api.post<AdminUserDto>(`/api/admin/users/${id}/enable`),
    disableUser: (id: number) => api.post<AdminUserDto>(`/api/admin/users/${id}/disable`),

    // Authorized site users
    listAuthorizedUsers: () => api.get<AuthorizedUserAdminDto[]>('/api/admin/authorized-users'),
    createAuthorizedUser: (data: { phone: string; firstName: string; lastName: string }) => api.post<AuthorizedUserAdminDto>('/api/admin/authorized-users', data),
    updateAuthorizedUser: (id: number, data: { phone: string; firstName: string; lastName: string }) => api.put<AuthorizedUserAdminDto>(`/api/admin/authorized-users/${id}`, data),
    deleteAuthorizedUser: (id: number) => api.del<void>(`/api/admin/authorized-users/${id}`),
    enableAuthorizedUser: (id: number) => api.post<AuthorizedUserAdminDto>(`/api/admin/authorized-users/${id}/enable`),
    disableAuthorizedUser: (id: number) => api.post<AuthorizedUserAdminDto>(`/api/admin/authorized-users/${id}/disable`),
};

export type { BookingAdminDto };
