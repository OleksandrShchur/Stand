import type { BookingAdminDto } from '../../api/types';

// Keep the API order and original bookings; these groups only control card styling.
export function groupBookingCards(bookings: BookingAdminDto[]): BookingAdminDto[][] {
    const groups: BookingAdminDto[][] = [];

    for (const booking of bookings) {
        const group = groups.at(-1);
        const previous = group?.at(-1);
        const canJoin = previous
            && previous.phone
            && previous.phone === booking.phone
            && previous.date === booking.date
            && previous.locationId === booking.locationId
            && (previous.endTime === booking.startTime || booking.endTime === previous.startTime);

        if (group && canJoin) group.push(booking);
        else groups.push([booking]);
    }

    return groups;
}
