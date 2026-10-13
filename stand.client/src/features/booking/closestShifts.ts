import type { MyShiftDto } from '../../api/types';

export function getClosestShifts(shifts: MyShiftDto[]) {
    return [...shifts].sort((a, b) =>
        a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime) || a.id - b.id).slice(0, 2);
}
