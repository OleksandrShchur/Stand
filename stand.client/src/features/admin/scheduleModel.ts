import type { ScheduleRangeDto } from '../../api/types';

export interface ScheduleRangeErrors { capacity?: string; time?: string }

export function getRangeErrors(slots: ScheduleRangeDto[], bookings: { startTime: string; endTime: string }[] = []): ScheduleRangeErrors[] {
    const errors = slots.map((slot): ScheduleRangeErrors => {
        const issue: ScheduleRangeErrors = {};
        if (!Number.isInteger(slot.capacity) || slot.capacity < 1 || slot.capacity > 2147483647)
            issue.capacity = slot.capacity > 2147483647 ? 'Кількість місць має бути не більшою за 2147483647.' : 'Вкажіть кількість місць — ціле число від 1.';
        const booked = bookings.filter(b => b.startTime === slot.startTime && b.endTime === slot.endTime).length;
        if (!issue.capacity && slot.capacity < booked)
            issue.capacity = `Вже є ${booked} записів. Щоб зменшити кількість місць, спочатку користувач або адміністратор має скасувати зайві записи.`;
        if (![slot.startTime, slot.endTime].every(time => /^([01]\d|2[0-3]):[0-5]\d$/.test(time)))
            issue.time = 'Вкажіть час у форматі ГГ:ХХ.';
        else if (slot.startTime >= slot.endTime)
            issue.time = 'Завершення має бути пізніше початку в межах одного дня.';
        return issue;
    });
    const validTimes = slots.map((slot, index) => ({ ...slot, index })).filter(slot => !errors[slot.index].time);
    for (let i = 0; i < validTimes.length; i++) {
        for (let j = i + 1; j < validTimes.length; j++) {
            const a = validTimes[i], b = validTimes[j];
            if (a.startTime < b.endTime && b.startTime < a.endTime) {
                errors[a.index].time ??= `Перетинається з інтервалом ${b.startTime}–${b.endTime}. Змініть час.`;
                errors[b.index].time ??= `Перетинається з інтервалом ${a.startTime}–${a.endTime}. Змініть час.`;
            }
        }
    }
    return errors;
}

export function validateRanges(slots: ScheduleRangeDto[], bookings: { startTime: string; endTime: string }[] = []): string | null {
    if (!slots.length) return 'Додайте хоча б один інтервал або вимкніть локацію.';
    if (slots.length > 144) return 'Для однієї локації можна додати до 144 інтервалів.';
    const errors = getRangeErrors(slots, bookings);
    const index = errors.findIndex(issue => issue.capacity || issue.time);
    if (index >= 0) return `${slots[index].startTime}–${slots[index].endTime}: ${errors[index].capacity || errors[index].time}`;
    return null;
}

export function generateRanges(start: string, end: string, minutes: number, capacity = 2): ScheduleRangeDto[] {
    const invalid = validateRanges([{ startTime: start, endTime: end, capacity }]);
    if (invalid) throw new Error(invalid);
    if (!Number.isInteger(minutes) || minutes < 1)
        throw new Error('Вкажіть правильний початок, завершення та тривалість.');
    const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
    const format = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
    const from = toMinutes(start), to = toMinutes(end);
    if ((to - from) % minutes) throw new Error('Період має ділитися на тривалість без залишку. Змініть час завершення або тривалість.');
    if ((to - from) / minutes > 144) throw new Error('За один раз можна створити до 144 інтервалів.');
    return Array.from({ length: (to - from) / minutes }, (_, index) => ({
        startTime: format(from + index * minutes), endTime: format(from + (index + 1) * minutes), capacity,
    }));
}

export function matchingDates(from: string, to: string, weekdays: number[]): string[] {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) return [];
    const cursor = new Date(`${from}T12:00:00Z`), end = new Date(`${to}T12:00:00Z`);
    if (!Number.isFinite(+cursor) || !Number.isFinite(+end) || (+end - +cursor) / 86400000 > 365) return [];
    if (cursor.toISOString().slice(0, 10) !== from || end.toISOString().slice(0, 10) !== to) return [];
    const result: string[] = [];
    for (; cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1))
        if (weekdays.includes(cursor.getUTCDay())) result.push(cursor.toISOString().slice(0, 10));
    return result;
}
