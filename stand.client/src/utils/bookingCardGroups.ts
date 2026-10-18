import type { BookingAdminDto, MyShiftDto } from '../api/types';

type BookingTimeRange = Pick<MyShiftDto, 'date' | 'startTime' | 'endTime'>;

// Keep the API order and original bookings; these groups only control card styling.
function groupConsecutiveCards<T extends BookingTimeRange>(
    bookings: T[],
    sameUserAndLocation: (previous: T, next: T) => boolean,
): T[][] {
    const groups: T[][] = [];

    for (const booking of bookings) {
        const group = groups.at(-1);
        const previous = group?.at(-1);
        const canJoin = previous
            && previous.date === booking.date
            && sameUserAndLocation(previous, booking)
            && (previous.endTime === booking.startTime || booking.endTime === previous.startTime);

        if (group && canJoin) group.push(booking);
        else groups.push([booking]);
    }

    return groups;
}

export function groupBookingCards(bookings: BookingAdminDto[]): BookingAdminDto[][] {
    return groupConsecutiveCards(bookings, (previous, next) =>
        Boolean(previous.phone) && previous.phone === next.phone && previous.locationId === next.locationId);
}

export function groupMyShiftCards(shifts: MyShiftDto[]): MyShiftDto[][] {
    // Every shift belongs to the signed-in user; this response identifies locations by name and address.
    return groupConsecutiveCards(shifts, (previous, next) =>
        previous.locationName === next.locationName
        && (previous.locationAddress ?? '') === (next.locationAddress ?? ''));
}
