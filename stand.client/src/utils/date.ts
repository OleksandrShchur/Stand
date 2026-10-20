const WEEKDAYS_SHORT = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
export const DATE_PICKER_FORMAT = 'DD.MM.YYYY';

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
    timeZone: 'Europe/Kyiv',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

/** Parses a "yyyy-MM-dd" civil date string into a local Date (midnight, no TZ shifting). */
export function parseIsoDate(iso: string): Date {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
}

/** Formats an ISO civil date as dd.MM.yyyy without time zone conversion. */
export function formatDate(iso: string): string {
    const [year, month, day] = iso.split('-');
    return `${day}.${month}.${year}`;
}

export function formatWeekdayShort(iso: string): string {
    const date = parseIsoDate(iso);
    return WEEKDAYS_SHORT[date.getDay()];
}

/** Formats a timestamp as dd.MM.yyyy, HH:mm in Kyiv time. */
export function formatDateTime(iso: string): string {
    const parts = Object.fromEntries(dateTimeFormatter.formatToParts(new Date(iso)).map(({ type, value }) => [type, value]));
    return `${parts.day}.${parts.month}.${parts.year}, ${parts.hour}:${parts.minute}`;
}

export function dateRangeIso(startIso: string, endIso: string): string[] {
    const start = parseIsoDate(startIso);
    const end = parseIsoDate(endIso);
    const result: string[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
    return result;
}

/** Today's civil date in Kyiv, regardless of the device's time zone. */
export function todayIso(now = new Date()): string {
    const parts = Object.fromEntries(dateTimeFormatter.formatToParts(now).map(({ type, value }) => [type, value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
}
