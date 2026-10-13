import type { CalendarDayAvailabilityDto, LocationAvailabilityDto, MyShiftDto } from '../../api/types';

export const mockCalendarAvailability: CalendarDayAvailabilityDto[] = [
    { date: '2026-10-14', remaining: 2, capacity: 6 },
    { date: '2026-10-15', remaining: 5, capacity: 8 },
    { date: '2026-10-16', remaining: 1, capacity: 4 },
    { date: '2026-10-19', remaining: 3, capacity: 6 },
    { date: '2026-10-20', remaining: 0, capacity: 5 },
];

export const mockLocationAvailability: LocationAvailabilityDto[] = [
    { locationId: 1, remaining: 5, capacity: 6, isLastUsed: true },
    { locationId: 2, remaining: 2, capacity: 4 },
    { locationId: 3, remaining: 0, capacity: 3 },
];

export const mockMyShifts: MyShiftDto[] = [];
