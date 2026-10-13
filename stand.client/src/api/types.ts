// ---- Public DTOs (mirrors Stand.Server/Dtos/Public/PublicDtos.cs) ----

export interface LocationDto {
    id: number;
    name: string;
    address?: string | null;
    capacity: number;
}

export interface CalendarDayAvailabilityDto {
    date: string;
    remaining: number;
    capacity: number;
}

export interface LocationAvailabilityDto {
    locationId: number;
    remaining: number;
    capacity: number;
    isLastUsed?: boolean;
}

export interface MyShiftDto {
    id: number;
    date: string;
    locationName: string;
    locationAddress?: string | null;
    startTime: string;
    endTime: string;
    cancelToken?: string;
}

export interface SlotAvailabilityDto {
    timeSlotId: number;
    startTime: string;
    endTime: string;
    capacity: number;
    booked: number;
    remaining: number;
    isFull: boolean;
    isBlocked: boolean;
    /** Slot starts sooner than the configured min lead time (e.g. +1 hour). */
    isTooSoon: boolean;
    isBookable: boolean;
    participants: { firstName: string | null; lastName: string | null }[];
}

export interface CalendarDto {
    bookableDates: string[];
    earliestBookableDate: string;
    latestBookableDate: string;
}

export interface BookingSummaryDto {
    publicNumber: string;
    cancelToken: string;
    status: 'Held' | 'Confirmed' | 'Cancelled';
    date: string;
    locationName: string;
    locationAddress?: string | null;
    startTime: string;
    endTime: string;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    comment?: string | null;
    createdAtUtc: string;
    confirmedAtUtc?: string | null;
    cancelledAtUtc?: string | null;
}

export interface PublicUserMeDto {
    id: number;
    phone: string;
}

// ---- Admin DTOs (mirrors Stand.Server/Dtos/Admin/AdminDtos.cs) ----

export interface AdminMeDto {
    id: number;
    login: string;
}

export interface AdminUserDto {
    id: number;
    login: string;
    isActive: boolean;
    createdAtUtc: string;
    lastLoginAtUtc?: string | null;
}

export interface AuthorizedUserAdminDto {
    id: number;
    phone: string;
    firstName: string;
    lastName: string;
    isActive: boolean;
    createdAtUtc: string;
    lastLoginAtUtc?: string | null;
}

export interface LocationAdminDto {
    id: number;
    name: string;
    address?: string | null;
    capacity: number;
    sortOrder: number;
    isActive: boolean;
}

export interface TimeSlotAdminDto {
    id: number;
    startTime: string;
    endTime: string;
    sortOrder: number;
    isActive: boolean;
}

export interface AvailableDateAdminDto {
    id: number;
    date: string;
    isActive: boolean;
}

export interface DateTimeSlotExceptionAdminDto {
    id: number;
    date: string;
    timeSlotId: number;
    startTime: string;
    endTime: string;
    isBlocked: boolean;
    note?: string | null;
}

export interface BookingAdminDto {
    id: number;
    publicNumber: string;
    date: string;
    locationId: number;
    locationName: string;
    timeSlotId: number;
    startTime: string;
    endTime: string;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    comment?: string | null;
    status: 'Held' | 'Confirmed' | 'Cancelled';
    createdAtUtc: string;
    confirmedAtUtc?: string | null;
    cancelledAtUtc?: string | null;
}

export interface BookingListResultDto {
    items: BookingAdminDto[];
    totalCount: number;
    page: number;
    pageSize: number;
}

export interface LocationFillRateDto {
    locationId: number;
    locationName: string;
    capacity: number;
    confirmed: number;
    held: number;
    fillRatePercent: number;
}

export interface DashboardDto {
    todayConfirmedCount: number;
    upcomingConfirmedCount: number;
    upcomingHeldCount: number;
    todayByLocation: LocationFillRateDto[];
    upcomingByLocation: LocationFillRateDto[];
}

export interface ProblemDetailsResponse {
    title?: string;
    status?: number;
    errorCode?: string;
    detail?: string;
}
