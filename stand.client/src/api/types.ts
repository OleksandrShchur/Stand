// ---- Public DTOs (mirrors Stand.Server/Dtos/Public/PublicDtos.cs) ----

export interface LocationDto {
    id: number;
    name: string;
    address?: string | null;
    capacity: number;
    hasAvailableBookings?: boolean | null;
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

export interface ShiftParticipantDto {
    firstName: string | null;
    lastName: string | null;
}

export interface MyShiftDto {
    id: number;
    date: string;
    locationName: string;
    locationAddress?: string | null;
    startTime: string;
    endTime: string;
    cancelToken: string;
    participants: ShiftParticipantDto[];
}

export interface SlotAvailabilityDto {
    timeSlotId: number;
    isBookedByMe: boolean;
    startTime: string;
    endTime: string;
    capacity: number;
    booked: number;
    remaining: number;
    isFull: boolean;
    isBlocked: boolean;
    /** Slot has already started (including finished slots). */
    isTooSoon: boolean;
    isBookable: boolean;
    participants: ShiftParticipantDto[];
}

export interface CalendarDto {
    bookableDates: string[];
    pastDates?: string[];
    /** Dates still viewable when no remaining shift can be booked. */
    readOnlyDates?: string[];
    earliestBookableDate: string;
    latestBookableDate: string;
}

export interface BookingSummaryDto {
    publicNumber: string;
    cancelToken: string;
    participants: ShiftParticipantDto[];
    isBooked: boolean;
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
    bookedAtUtc?: string | null;
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

export interface ScheduleRangeDto { startTime: string; endTime: string; capacity: number }
export interface ScheduleLocationDto { locationId: number; slots: ScheduleRangeDto[] }
export interface DayScheduleDto {
    date: string;
    isActive: boolean;
    isCustom: boolean;
    locations: ScheduleLocationDto[];
    bookings: { id: number; locationId: number; locationName: string; startTime: string; endTime: string }[];
    horizonDays: number;
    minLeadTimeMinutes: number;
}
export interface SaveScheduleDto {
    dates: string[];
    isActive: boolean;
    locations: ScheduleLocationDto[];
    acknowledgeExistingBookings?: boolean;
}
export interface ScheduleSaveResultDto { updatedDates: number; preservedBookings: number }

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
    isBooked: boolean;
    createdAtUtc: string;
    bookedAtUtc?: string | null;
    cancelledAtUtc?: string | null;
}

export interface BookingListResultDto {
    items: BookingAdminDto[];
    totalCount: number;
    page: number;
    pageSize: number;
}

export interface FeedbackAdminDto {
    id: number;
    firstName: string;
    lastName: string;
    phone: string;
    comment: string;
    createdAtUtc: string;
}

export interface FeedbackListResultDto {
    items: FeedbackAdminDto[];
    totalCount: number;
    page: number;
    pageSize: number;
}

export interface LocationFillRateDto {
    locationId: number;
    locationName: string;
    capacity: number;
    booked: number;
    fillRatePercent: number;
}

export interface DashboardDto {
    today: string;
    horizonEnd: string;
    todayBookedCount: number;
    upcomingBookedCount: number;
    todayByLocation: LocationFillRateDto[];
    upcomingByLocation: LocationFillRateDto[];
}

export interface ProblemDetailsResponse {
    title?: string;
    status?: number;
    errorCode?: string;
    detail?: string;
}
